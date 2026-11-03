// Account sync in the browser: pushes the outbox, pulls other devices' changes.
// Runs on every page (Base layout) but does nothing until someone signs in.
import { CHANGE_EVENT, clearAll, read, update } from './storage';
import { diff, merge, toItems, type Items } from './sync-core';

export interface User { id: string; email: string; name: string; }
interface Meta { user: User | null; synced: Items; cursor: string | null; lastSync: number | null; }

const META = 'talaqqa:sync';
export const SYNC_EVENT = 'talaqqa:sync';
const BATCH = 500; // the API's limit per request
const TIMEOUT = 15000;

function readMeta(): Meta {
  try {
    const m = JSON.parse(localStorage.getItem(META) ?? 'null');
    if (m && typeof m === 'object') return { user: null, synced: {}, cursor: null, lastSync: null, ...m };
  } catch {}
  return { user: null, synced: {}, cursor: null, lastSync: null };
}
function writeMeta(m: Meta) {
  try { localStorage.setItem(META, JSON.stringify(m)); } catch {}
  window.dispatchEvent(new Event(SYNC_EVENT));
}

export const currentUser = () => readMeta().user;
export const lastSync = () => readMeta().lastSync;

const api = (path: string, init: RequestInit = {}) =>
  fetch(path, { credentials: 'same-origin', signal: AbortSignal.timeout(TIMEOUT), ...init, headers: { 'Content-Type': 'application/json', ...init.headers } });

let running: Promise<void> | null = null;
let again = false;

/** Push local changes, then pull. Safe to call often: calls made while one runs are folded into one more run. */
export function syncNow(): Promise<void> {
  if (running) { again = true; return running; }
  running = (async () => {
    try {
      do { again = false; await syncOnce(); } while (again);
    } finally { running = null; }
  })();
  return running;
}

async function syncOnce() {
  let meta = readMeta();
  if (!meta.user || !navigator.onLine) return;

  // Push: everything that differs from what the server last confirmed.
  const current = toItems(read());
  const changes = diff(meta.synced, current, Date.now());
  for (let i = 0; i < changes.length; i += BATCH) {
    const res = await api('/api/me/items', { method: 'POST', body: JSON.stringify({ changes: changes.slice(i, i + BATCH) }) });
    if (res.status === 401) return signedOutElsewhere();
    if (!res.ok) throw new Error(`sync push failed: ${res.status}`);
  }
  // Only what was pushed counts as synced; edits made meanwhile stay in the outbox.
  const synced = { ...meta.synced };
  for (const c of changes) {
    const k = `${c.kind}\u0000${c.key}`;
    if (k in current) synced[k] = current[k]; else delete synced[k];
  }
  meta = { ...meta, synced };
  writeMeta(meta);

  // Pull: items changed on the server since the last pull (including other devices').
  let cursor = meta.cursor;
  const pulled = [];
  for (;;) {
    const res = await api(`/api/me/items${cursor ? `?after=${encodeURIComponent(cursor)}` : ''}`);
    if (res.status === 401) return signedOutElsewhere();
    if (!res.ok) throw new Error(`sync pull failed: ${res.status}`);
    const page = (await res.json()) as { items: { kind: never; key: string; value: unknown; at: number }[]; next: string | null };
    pulled.push(...page.items);
    const last = page.items.at(-1);
    if (last) cursor = `${last.at}|${last.kind}|${last.key}`;
    if (!page.next) break;
  }
  const merged = merge(read(), readMeta().synced, pulled);
  if (pulled.length) update(() => merged.state);
  writeMeta({ ...readMeta(), synced: merged.synced, cursor, lastSync: Date.now() });
}

function signedOutElsewhere() {
  // The session expired or was revoked: keep the device data, stop syncing.
  writeMeta({ ...readMeta(), user: null, synced: {}, cursor: null });
}

/** After sign-in or sign-up: the device's data (guest progress included) is uploaded, then merged with the account's. */
export async function startSession(user: User) {
  writeMeta({ user, synced: {}, cursor: null, lastSync: null });
  await syncNow();
}

/** Final push, sign out, then clear this device so the next person starts fresh. */
export async function endSession() {
  await syncNow().catch(() => {});
  await api('/api/auth/sign-out', { method: 'POST', body: '{}' }).catch(() => {});
  clearAll();
  try { localStorage.removeItem(META); } catch {}
  window.dispatchEvent(new Event(SYNC_EVENT));
}

/** After the account is deleted on the server. */
export function forgetDevice() {
  clearAll();
  try { localStorage.removeItem(META); } catch {}
  window.dispatchEvent(new Event(SYNC_EVENT));
}

/** Wires sync to the page: on load, after changes (debounced), when back online and when the tab is shown again. */
export function startSync() {
  if (!currentUser()) {
    // Signed in on another tab later: pick it up then.
    window.addEventListener('storage', (e) => { if (e.key === META && currentUser()) startSync(); }, { once: true });
    return;
  }
  const run = () => { syncNow().catch((err) => console.warn(err)); };
  let timer: ReturnType<typeof setTimeout> | undefined;
  window.addEventListener(CHANGE_EVENT, () => { clearTimeout(timer); timer = setTimeout(run, 1500); });
  window.addEventListener('online', run);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') run(); });
  run();
}
