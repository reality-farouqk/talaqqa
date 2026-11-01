import { useEffect, useState } from 'react';

// Everything a learner saves lives here, on their device only. One versioned
// key keeps it easy to import into an account later (Phase 2).
export interface LastLesson { course: string; lesson: string; at: number; }
export interface Settings { autoplay: boolean; autoNext: boolean; speed: number; }
export interface Playlist { id: string; title: string; visibility: 'private' | 'public'; items: string[]; updatedAt: number; } // items: "course/lesson"
export interface State {
  v: 1;
  settings: Settings;
  positions: Record<string, number>; // "course/lesson" -> seconds watched, cleared when done
  watchlist: string[]; // course ids
  savedLessons: string[]; // "course/lesson" saved for later
  playlists: Playlist[];
  notes: Record<string, string>; // "course/lesson" -> text
  studyDays: string[]; // YYYY-MM-DD days with a completed lesson, for the streak
  done: string[]; // "course/lesson"
  last?: LastLesson; // most recently opened lesson anywhere
  lastByCourse: Record<string, string>; // course id -> lesson slug
}

const KEY = 'talaqqa:v1';
const EVENT = 'talaqqa:change';
const DEFAULT_SETTINGS: Settings = { autoplay: true, autoNext: true, speed: 1 };
const empty = (): State => ({ v: 1, watchlist: [], savedLessons: [], playlists: [], notes: {}, studyDays: [], done: [], lastByCourse: {}, settings: DEFAULT_SETTINGS, positions: {} });

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
const today = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD
// Keep ~2 months of days: enough for the streak, small in storage.
const addStudyDay = (days: string[]) => (days.includes(today()) ? days : [...days, today()].slice(-60));
export const toggleDone = (key: string) =>
  update((s) => (s.done.includes(key) ? { ...s, done: s.done.filter((k) => k !== key) } : { ...s, done: [...s.done, key], studyDays: addStudyDay(s.studyDays) }));
export const markDone = (key: string) =>
  update((s) => ({ ...s, done: s.done.includes(key) ? s.done : [...s.done, key], positions: omit(s.positions, key), studyDays: addStudyDay(s.studyDays) }));
export const toggleSavedLesson = (key: string) => update((s) => ({ ...s, savedLessons: toggle(s.savedLessons, key) }));
export const saveNote = (key: string, text: string) =>
  update((s) => ({ ...s, notes: text.trim() ? { ...s.notes, [key]: text } : omit(s.notes, key) }));

/** Consecutive days up to today (or yesterday, so the streak survives until today's lesson). */
export function streak(days: string[]) {
  const set = new Set(days);
  const d = new Date();
  if (!set.has(today())) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(d.toLocaleDateString('en-CA'))) { n++; d.setDate(d.getDate() - 1); }
  return { days: n, doneToday: set.has(today()) };
}

const newId = () => Math.random().toString(36).slice(2, 10);
export const createPlaylist = (title: string, first?: string) => {
  const id = newId();
  update((s) => ({ ...s, playlists: [...s.playlists, { id, title: title.trim().slice(0, 120), visibility: 'private', items: first ? [first] : [], updatedAt: Date.now() }] }));
  return id;
};
const editPlaylist = (id: string, fn: (p: Playlist) => Playlist) =>
  update((s) => ({ ...s, playlists: s.playlists.map((p) => (p.id === id ? { ...fn(p), updatedAt: Date.now() } : p)) }));
export const renamePlaylist = (id: string, title: string) => editPlaylist(id, (p) => ({ ...p, title: title.trim().slice(0, 120) || p.title }));
export const setPlaylistVisibility = (id: string, visibility: Playlist['visibility']) => editPlaylist(id, (p) => ({ ...p, visibility }));
export const togglePlaylistItem = (id: string, key: string) => editPlaylist(id, (p) => ({ ...p, items: toggle(p.items, key) }));
export const movePlaylistItem = (id: string, from: number, to: number) =>
  editPlaylist(id, (p) => {
    if (to < 0 || to >= p.items.length) return p;
    const items = [...p.items];
    items.splice(to, 0, items.splice(from, 1)[0]);
    return { ...p, items };
  });
export const deletePlaylist = (id: string) => update((s) => ({ ...s, playlists: s.playlists.filter((p) => p.id !== id) }));
export const savePosition = (key: string, seconds: number) =>
  update((s) => ({ ...s, positions: { ...s.positions, [key]: Math.floor(seconds) } }));
export const saveSettings = (patch: Partial<Settings>) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
function omit<T>(o: Record<string, T>, key: string) { const { [key]: _, ...rest } = o; return rest; }
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
