import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { createApp, type AuthPort, type Deps } from './app.ts';
import { makeAuth } from './auth.ts';
import { memoryStore, sqlStore, type Query, type Store } from './store.ts';

const ORIGIN = 'https://talaqqa.test';
const T = Date.UTC(2026, 0, 1);

// Test auth: the user id comes from a header.
const headerAuth: AuthPort = {
  handler: async () => new Response(null, { status: 404 }),
  userId: async (req) => req.headers.get('x-test-user')
};
const appWith = (store: Store) => createApp(() => ({ store, auth: headerAuth, origin: ORIGIN }));
const post = (body: unknown, user = 'u1', headers: Record<string, string> = {}) => ({
  method: 'POST', body: JSON.stringify(body),
  headers: { 'content-type': 'application/json', origin: ORIGIN, 'x-test-user': user, ...headers }
});
const get = (user = 'u1') => ({ headers: { 'x-test-user': user } });

// The same contract runs against the in-memory store and, when available, real Postgres.
function contract(name: string, makeStore: () => Promise<Store>) {
  describe(`API with ${name}`, () => {
    let app: ReturnType<typeof appWith>;
    before(async () => { app = appWith(await makeStore()); });

    test('rejects signed-out, cross-site and non-JSON writes', async () => {
      assert.equal((await app.request('/api/me/items')).status, 401);
      assert.equal((await app.request('/api/me/items', post({ changes: [] }, 'u1', { origin: 'https://evil.test' }))).status, 403);
      assert.equal((await app.request('/api/me/items', { ...post({}), headers: { origin: ORIGIN, 'x-test-user': 'u1', 'content-type': 'text/plain' } })).status, 415);
    });

    test('validates changes', async () => {
      for (const bad of [{ changes: [] }, { changes: [{ kind: 'nope', key: 'a/b', value: true, at: T }] }, { changes: [{ kind: 'done', key: 'not a key', value: true, at: T }] }, { changes: [{ kind: 'note', key: 'a/b', value: 'x'.repeat(20001), at: T }] }]) {
        assert.equal((await app.request('/api/me/items', post(bad))).status, 400);
      }
    });

    test('last write wins, replays are harmless, batches are deduplicated', async () => {
      const r1 = await (await app.request('/api/me/items', post({ changes: [
        { kind: 'done', key: 'c/l1', value: true, at: T + 10 },
        { kind: 'note', key: 'c/l1', value: "it's \"fine\" \\ ok", at: T + 10 },
        { kind: 'note', key: 'c/l1', value: 'older in same batch', at: T + 5 }
      ] }))).json();
      assert.equal(r1.applied, 2);
      const replay = await (await app.request('/api/me/items', post({ changes: [{ kind: 'done', key: 'c/l1', value: true, at: T + 10 }] }))).json();
      assert.equal(replay.applied, 0);
      const older = await (await app.request('/api/me/items', post({ changes: [{ kind: 'done', key: 'c/l1', value: false, at: T + 1 }] }))).json();
      assert.equal(older.applied, 0);
      const { items } = await (await app.request('/api/me/items', get())).json();
      assert.deepEqual(items.map((i: { kind: string; value: unknown }) => [i.kind, i.value]), [['done', true], ['note', "it's \"fine\" \\ ok"]]);
    });

    test('users never see each other\'s data', async () => {
      const { items } = await (await app.request('/api/me/items', get('u2'))).json();
      assert.equal(items.length, 0);
    });

    test('pages through long lists', async () => {
      const changes = Array.from({ length: 501 }, (_, i) => ({ kind: 'day', key: new Date(T + i * 86_400_000).toISOString().slice(0, 10), value: true, at: T + 100 + i }));
      // Batches are capped at 500 changes.
      assert.equal((await app.request('/api/me/items', post({ changes }, 'u3'))).status, 400);
      assert.equal((await (await app.request('/api/me/items', post({ changes: changes.slice(0, 500) }, 'u3'))).json()).applied, 500);
      assert.equal((await (await app.request('/api/me/items', post({ changes: changes.slice(500) }, 'u3'))).json()).applied, 1);
      const p1 = await (await app.request('/api/me/items', get('u3'))).json();
      assert.equal(p1.items.length, 500);
      const p2 = await (await app.request(`/api/me/items?after=${encodeURIComponent(p1.next)}`, get('u3'))).json();
      assert.equal(p2.items.length, 1);
      assert.equal(p2.next, null);
      assert.equal((await app.request('/api/me/items?after=garbage', get('u3'))).status, 400);
    });

    test('export and account deletion', async () => {
      const exp = await (await app.request('/api/me/export', get('u3'))).json();
      assert.equal(exp.items.length, 501);
      const del = await app.request('/api/me', { method: 'DELETE', headers: { origin: ORIGIN, 'x-test-user': 'u3' } });
      assert.equal(del.status, 204);
      assert.equal((await (await app.request('/api/me/items', get('u3'))).json()).items.length, 0);
    });
  });
}

contract('memory store', async () => memoryStore());

// Real Postgres (CI service, or a local server): PG_TEST_URL=postgresql://... with db/ migrations applied.
const PG = process.env.PG_TEST_URL;
const quote = (v: unknown) => `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
function parseCsv(text: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch;
  }
  return rows;
}
const psqlQuery: Query = async (text, params) => {
  const out = execFileSync('psql', [PG!, '-X', '-q', '--csv', '-v', 'ON_ERROR_STOP=1'], { input: `${text} \\bind ${params.map(quote).join(' ')} \\g\n`, encoding: 'utf8' });
  const [header, ...rows] = parseCsv(out);
  return (rows ?? []).map((r) => Object.fromEntries((header ?? []).map((h, i) => [h, h === 'value' ? JSON.parse(r[i]) : r[i]])));
};
if (PG) {
  contract('Postgres', async () => {
    execFileSync('psql', [PG, '-X', '-q', '-c', `delete from "user"; insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt") select id, id, id || '@test', false, now(), now() from unnest(array['u1','u2','u3']) id`]);
    return sqlStore(psqlQuery);
  });
}

describe('Better Auth wiring (in-memory database)', () => {
  const db = { user: [], session: [], account: [], verification: [], rateLimit: [] };
  const auth = makeAuth({ BETTER_AUTH_SECRET: 'test-secret-at-least-32-characters-long', SITE_URL: 'http://localhost' }, memoryAdapter(db));
  const store = memoryStore();
  const deps: Deps = {
    store, origin: 'http://localhost',
    auth: { handler: (r) => auth.handler(r), userId: async (r) => (await auth.api.getSession({ headers: r.headers }))?.user.id ?? null }
  };
  const app = createApp(() => deps);
  const json = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', origin: 'http://localhost' } });

  test('sign up, use the session cookie, reject a forged one', async () => {
    const res = await app.request('http://localhost/api/auth/sign-up/email', json({ email: 'learner@test.org', password: 'correct horse battery', name: 'Learner' }));
    assert.equal(res.status, 200);
    const cookie = res.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie?.includes('session_token'), 'session cookie set');
    assert.match(res.headers.get('set-cookie') ?? '', /HttpOnly/i);
    const ok = await app.request('http://localhost/api/me/items', { headers: { cookie: cookie! } });
    assert.equal(ok.status, 200);
    const forged = await app.request('http://localhost/api/me/items', { headers: { cookie: 'better-auth.session_token=forged.value' } });
    assert.equal(forged.status, 401);
  });

  test('rate-limits repeated sign-in attempts', async () => {
    const codes = [];
    for (let i = 0; i < 7; i++) codes.push((await app.request('http://localhost/api/auth/sign-in/email', { ...json({ email: 'learner@test.org', password: 'wrong password!' }), headers: { 'content-type': 'application/json', origin: 'http://localhost', 'x-forwarded-for': '203.0.113.7' } })).status);
    assert.ok(codes.includes(429), `expected a 429 in ${codes}`);
  });
});

describe('without a database', () => {
  const app = createApp(() => null);
  test('the API reports accounts unavailable', async () => {
    assert.deepEqual(await (await app.request('/api/health')).json(), { ok: true, accounts: false });
    assert.equal((await app.request('/api/me/items')).status, 503);
    assert.equal((await app.request('/api/auth/get-session')).status, 503);
  });
});
