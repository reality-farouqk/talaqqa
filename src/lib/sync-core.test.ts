import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diff, merge, toItems, type Items } from './sync-core.ts';
import { changesSchema, memoryStore } from '../api/store.ts';
import type { State } from './storage.ts';

const empty = (): State => ({ v: 1, watchlist: [], savedLessons: [], playlists: [], notes: {}, studyDays: [], done: [], lastByCourse: {}, settings: { autoplay: true, autoNext: true, speed: 1 }, positions: {} });
const T = Date.UTC(2026, 10, 3);

test('first sign-in uploads everything on the device', () => {
  const s: State = { ...empty(), done: ['arabic-101/lesson-1'], watchlist: ['arabic-101'], notes: { 'arabic-101/lesson-1': 'alif' }, positions: { 'arabic-101/lesson-2': 95 }, studyDays: ['2026-11-03'],
    playlists: [{ id: 'abc12345', title: 'Revision', visibility: 'private', items: ['arabic-101/lesson-1'], updatedAt: T }] };
  const changes = diff({}, toItems(s), T);
  assert.equal(changesSchema.parse({ changes }).changes.length, 6);
  assert.deepEqual(changes.map((c) => `${c.kind}:${c.key}`).sort(), ['day:2026-11-03', 'done:arabic-101/lesson-1', 'note:arabic-101/lesson-1', 'playlist:abc12345', 'position:arabic-101/lesson-2', 'watch:arabic-101']);
  assert.ok(changes.every((c) => c.at === T));
});

test('only differences are sent, and removals as tombstones', () => {
  const before: State = { ...empty(), done: ['a/b'], notes: { 'a/b': 'x' }, positions: { 'a/c': 10 } };
  const after: State = { ...before, done: [], notes: { 'a/b': 'x' }, positions: { 'a/c': 20 } };
  const changes = diff(toItems(before), toItems(after), T);
  assert.deepEqual(changes.map(({ kind, key, value }) => ({ kind, key, value })), [
    { kind: 'position', key: 'a/c', value: 20 },
    { kind: 'done', key: 'a/b', value: false }
  ]);
});

test('keys the API would reject stay on the device', () => {
  const s: State = { ...empty(), done: ['Bad Key', 'a/b'], playlists: [{ id: 'x1', title: 't', visibility: 'private', items: [], updatedAt: T }] };
  assert.deepEqual(Object.values(toItems(s)).map((i) => i.key), ['a/b']);
});

test('two devices end up with the same progress through the API store', async () => {
  const server = memoryStore();
  const start = { at: 0, kind: '', key: '' };
  // Parsing with the API's schema also proves the client only sends what the API accepts.
  const valid = (changes: unknown[]) => changesSchema.parse({ changes }).changes;
  const pull = async () => (await server.list('u1', start, 500)).map(({ kind, key, value, at }) => ({ kind, key, value, at }));

  // Phone: finishes a lesson, saves a course and writes a note, then syncs.
  const phone: State = { ...empty(), done: ['c/l1'], watchlist: ['c'], notes: { 'c/l1': 'review' } };
  await server.apply('u1', valid(diff({}, toItems(phone), T)));

  // Laptop: had its own guest progress before signing in.
  let laptop: State = { ...empty(), done: ['c/l2'] };
  await server.apply('u1', valid(diff({}, toItems(laptop), T + 1)));
  let synced: Items = toItems(laptop);
  ({ state: laptop, synced } = merge(laptop, synced, await pull()));
  assert.deepEqual([...laptop.done].sort(), ['c/l1', 'c/l2']);
  assert.deepEqual(laptop.watchlist, ['c']);
  assert.equal(laptop.notes['c/l1'], 'review');

  // Laptop un-marks l1; the phone sees it go.
  const edited = { ...laptop, done: ['c/l2'] };
  await server.apply('u1', valid(diff(synced, toItems(edited), T + 2)));
  const onPhone = merge(phone, toItems(phone), await pull());
  assert.deepEqual([...onPhone.state.done].sort(), ['c/l2']);
  assert.ok(!('done\u0000c/l1' in onPhone.synced), 'tombstone is not kept as a synced item');
});

test('a pull never overwrites a local change that is still waiting to be pushed', () => {
  const synced = toItems({ ...empty(), notes: { 'a/b': 'old' } });
  const local: State = { ...empty(), notes: { 'a/b': 'typed offline' } };
  const { state } = merge(local, synced, [{ kind: 'note', key: 'a/b', value: 'from other device', at: T }]);
  assert.equal(state.notes['a/b'], 'typed offline');
  assert.equal(diff(synced, toItems(state), T + 1)[0].value, 'typed offline');
});

test('playlists sync with their place in the list', () => {
  const a = { id: 'aaaaaa', title: 'A', visibility: 'private' as const, items: [], updatedAt: T };
  const b = { id: 'bbbbbb', title: 'B', visibility: 'private' as const, items: [], updatedAt: T };
  const s: State = { ...empty(), playlists: [a, b] };
  const { state } = merge(s, toItems(s), [{ kind: 'playlist', key: 'aaaaaa', value: { title: 'A2', visibility: 'public', items: ['c/l1'] }, at: T + 5 }]);
  assert.deepEqual(state.playlists.map((p) => p.title), ['A2', 'B']);
  const gone = merge(state, toItems(state), [{ kind: 'playlist', key: 'bbbbbb', value: null, at: T + 6 }]);
  assert.deepEqual(gone.state.playlists.map((p) => p.id), ['aaaaaa']);
});
