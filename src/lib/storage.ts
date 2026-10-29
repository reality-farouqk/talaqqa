import { useEffect, useState } from 'react';

// Everything a learner saves lives here, on their device only. One versioned
// key keeps it easy to import into an account later (Phase 2).
export interface LastLesson { course: string; lesson: string; at: number; }
export interface Settings { autoplay: boolean; autoNext: boolean; speed: number; }
export interface State {
  v: 1;
  settings: Settings;
  positions: Record<string, number>; // "course/lesson" -> seconds watched, cleared when done
  watchlist: string[]; // course ids
  done: string[]; // "course/lesson"
  last?: LastLesson; // most recently opened lesson anywhere
  lastByCourse: Record<string, string>; // course id -> lesson slug
}

const KEY = 'talaqqa:v1';
const EVENT = 'talaqqa:change';
const DEFAULT_SETTINGS: Settings = { autoplay: true, autoNext: true, speed: 1 };
const empty = (): State => ({ v: 1, watchlist: [], done: [], lastByCourse: {}, settings: DEFAULT_SETTINGS, positions: {} });

function parse<T>(raw: string | null, fallback: T): T {
  try { return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}

export function read(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = parse<Partial<State>>(raw, {});
      return { ...empty(), ...saved, settings: { ...DEFAULT_SETTINGS, ...saved.settings } };
    }
    // One-time migration from the starter's separate keys.
    const migrated: State = {
      ...empty(),
      watchlist: parse<string[]>(localStorage.getItem('talaqqa:watchlist'), []),
      done: parse<string[]>(localStorage.getItem('talaqqa:done'), [])
    };
    if (migrated.watchlist.length || migrated.done.length) write(migrated);
    return migrated;
  } catch {
    return empty();
  }
}

function write(s: State) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function update(fn: (s: State) => State) { write(fn(read())); }

const toggle = (list: string[], item: string) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);
export const toggleWatchlist = (course: string) => update((s) => ({ ...s, watchlist: toggle(s.watchlist, course) }));
export const toggleDone = (key: string) => update((s) => ({ ...s, done: toggle(s.done, key) }));
export const markDone = (key: string) =>
  update((s) => ({ ...s, done: s.done.includes(key) ? s.done : [...s.done, key], positions: omit(s.positions, key) }));
export const savePosition = (key: string, seconds: number) =>
  update((s) => ({ ...s, positions: { ...s.positions, [key]: Math.floor(seconds) } }));
export const saveSettings = (patch: Partial<Settings>) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
const omit = (o: Record<string, number>, key: string) => { const { [key]: _, ...rest } = o; return rest; };
export const markOpened = (course: string, lesson: string) =>
  update((s) => ({ ...s, last: { course, lesson, at: Date.now() }, lastByCourse: { ...s.lastByCourse, [course]: lesson } }));
export const clearAll = () => write(empty());

// Returns null on the server and before the first client render, so islands
// can avoid a flash of wrong state.
export function useStore(): State | null {
  const [state, setState] = useState<State | null>(null);
  useEffect(() => {
    const sync = () => setState(read());
    sync();
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) sync(); };
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', onStorage); };
  }, []);
  return state;
}
