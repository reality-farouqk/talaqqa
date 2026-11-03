// Pure parts of account sync (no browser APIs), so they can be tested in Node.
// The device store stays the source of truth while offline. Sync compares it with a
// snapshot of what the server last confirmed: the difference is the outbox.
import type { Playlist, State } from './storage.ts';

export type Kind = 'done' | 'saved' | 'watch' | 'position' | 'note' | 'day' | 'playlist';
export interface Item { kind: Kind; key: string; value: unknown; }
export interface Change extends Item { at: number; }
export type Items = Record<string, Item>;

// Same shapes the API accepts; anything else stays on the device instead of failing the batch.
const LESSON = /^[a-z0-9-]+\/[a-z0-9-]+$/;
const COURSE = /^[a-z0-9-]+$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PLAYLIST = /^[a-z0-9]{6,20}$/;

const id = (kind: Kind, key: string) => `${kind}\u0000${key}`;

/** The synced parts of the device store, one item per (kind, key). */
export function toItems(s: State): Items {
  const out: Items = {};
  const add = (kind: Kind, key: string, value: unknown, valid: RegExp) => { if (valid.test(key) && key.length <= 200) out[id(kind, key)] = { kind, key, value }; };
  for (const k of s.done) add('done', k, true, LESSON);
  for (const k of s.savedLessons) add('saved', k, true, LESSON);
  for (const k of s.watchlist) add('watch', k, true, COURSE);
  for (const [k, v] of Object.entries(s.positions)) if (v > 0) add('position', k, Math.min(v, 86400), LESSON);
  for (const [k, v] of Object.entries(s.notes)) if (v.trim()) add('note', k, v.slice(0, 20000), LESSON);
  for (const k of s.studyDays) add('day', k, true, DAY);
  for (const p of s.playlists) add('playlist', p.id, { title: p.title || 'Playlist', visibility: p.visibility, items: p.items.filter((k) => LESSON.test(k)).slice(0, 500) }, PLAYLIST);
  return out;
}

/** What a removed item is sent as: the API keeps tombstones so other devices remove it too. */
const TOMBSTONE: Record<Kind, unknown> = { done: false, saved: false, watch: false, day: false, position: 0, note: '', playlist: null };
const isTombstone = (i: Item) => i.value === TOMBSTONE[i.kind];

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Changes that bring the server from `synced` to `current`. */
export function diff(synced: Items, current: Items, at: number): Change[] {
  const changes: Change[] = [];
  for (const [k, item] of Object.entries(current)) if (!same(synced[k]?.value, item.value)) changes.push({ ...item, at });
  for (const [k, item] of Object.entries(synced)) if (!(k in current)) changes.push({ kind: item.kind, key: item.key, value: TOMBSTONE[item.kind], at });
  return changes;
}

/**
 * Merges items pulled from the server into the device store and the snapshot.
 * An item the learner changed locally since the last sync is left alone: that newer local
 * change is still in the outbox and wins on the next push.
 */
export function merge(state: State, synced: Items, pulled: (Item & { at: number })[]): { state: State; synced: Items } {
  const local = toItems(state);
  const next = { ...synced };
  let s = state;
  for (const p of pulled) {
    const k = id(p.kind, p.key);
    if (!same(local[k]?.value, synced[k]?.value)) continue;
    s = applyItem(s, p);
    if (isTombstone(p)) delete next[k]; else next[k] = { kind: p.kind, key: p.key, value: p.value };
  }
  return { state: s, synced: next };
}

const setIn = (list: string[], key: string, on: boolean) => (on ? (list.includes(key) ? list : [...list, key]) : list.filter((x) => x !== key));
function without<T>(o: Record<string, T>, key: string) { const { [key]: _, ...rest } = o; return rest; }

function applyItem(s: State, p: Item & { at: number }): State {
  switch (p.kind) {
    case 'done': return { ...s, done: setIn(s.done, p.key, p.value === true) };
    case 'saved': return { ...s, savedLessons: setIn(s.savedLessons, p.key, p.value === true) };
    case 'watch': return { ...s, watchlist: setIn(s.watchlist, p.key, p.value === true) };
    case 'day': return { ...s, studyDays: setIn(s.studyDays, p.key, p.value === true).sort().slice(-60) };
    case 'position': {
      const v = Number(p.value);
      return { ...s, positions: v > 0 ? { ...s.positions, [p.key]: v } : without(s.positions, p.key) };
    }
    case 'note': {
      const v = typeof p.value === 'string' ? p.value : '';
      return { ...s, notes: v.trim() ? { ...s.notes, [p.key]: v } : without(s.notes, p.key) };
    }
    case 'playlist': {
      const rest = s.playlists.filter((x) => x.id !== p.key);
      if (!p.value) return { ...s, playlists: rest };
      const v = p.value as Pick<Playlist, 'title' | 'visibility' | 'items'>;
      const old = s.playlists.findIndex((x) => x.id === p.key);
      const updated: Playlist = { id: p.key, title: v.title, visibility: v.visibility, items: v.items, updatedAt: p.at };
      // Keep its place in the list when it already exists here.
      if (old === -1) return { ...s, playlists: [...rest, updated] };
      const playlists = [...s.playlists];
      playlists[old] = updated;
      return { ...s, playlists };
    }
  }
}
