import { Hono, type MiddlewareHandler } from 'hono';
import { changesSchema, latestPerItem, type Cursor, type Store } from './store.ts';

/** What the API needs from auth: the raw handler for /api/auth/*, and the signed-in user for a request. */
export interface AuthPort {
  handler(request: Request): Promise<Response>;
  userId(request: Request): Promise<string | null>;
}
export interface Deps { store: Store; auth: AuthPort; origin: string; google: boolean; }

const PAGE = 500;
const START: Cursor = { at: 0, kind: '', key: '' };

function parseCursor(raw: string | undefined): Cursor | null {
  if (!raw) return START;
  const [at, kind, ...key] = raw.split('|');
  return /^\d+$/.test(at) && kind ? { at: Number(at), kind, key: key.join('|') } : null;
}
const cursorOf = (i: { at: number; kind: string; key: string }) => `${i.at}|${i.kind}|${i.key}`;

/** deps is null when the database isn't configured: the site works, accounts don't yet. */
export function createApp(getDeps: (env: unknown) => Deps | null) {
  type AppEnv = { Bindings: object; Variables: { deps: Deps; userId: string } };
  const app = new Hono<AppEnv>().basePath('/api');

  app.onError((err, c) => {
    console.error(JSON.stringify({ type: 'api_error', path: c.req.path, message: err.message }));
    return c.json({ error: 'server_error' }, 500);
  });

  app.get('/health', (c) => {
    const deps = getDeps(c.env);
    return c.json({ ok: true, accounts: deps !== null, google: deps?.google ?? false });
  });

  const withDeps: MiddlewareHandler<AppEnv> = async (c, next) => {
    const deps = getDeps(c.env);
    if (!deps) return c.json({ error: 'accounts_unavailable' }, 503);
    c.set('deps', deps);
    await next();
  };
  for (const path of ['/auth/*', '/me', '/me/*']) app.use(path, withDeps);

  app.on(['GET', 'POST'], '/auth/*', (c) => c.get('deps').auth.handler(c.req.raw));

  // Signed-in routes. The user always comes from the session, never from the request (no IDOR).
  const signedIn: MiddlewareHandler<AppEnv> = async (c, next) => {
    const { auth, origin } = c.get('deps');
    if (c.req.method !== 'GET') {
      // Cookie-authenticated writes must come from our own pages (CSRF).
      if (c.req.header('origin') !== origin) return c.json({ error: 'bad_origin' }, 403);
      if (c.req.method === 'POST' && !c.req.header('content-type')?.startsWith('application/json')) return c.json({ error: 'json_required' }, 415);
    }
    const userId = await auth.userId(c.req.raw);
    if (!userId) return c.json({ error: 'not_signed_in' }, 401);
    c.set('userId', userId);
    await next();
  };
  for (const path of ['/me', '/me/*']) app.use(path, signedIn);

  // Paginated: pass `next` back as `after` until it is null.
  app.get('/me/items', async (c) => {
    const after = parseCursor(c.req.query('after'));
    if (!after) return c.json({ error: 'bad_cursor' }, 400);
    const items = await c.get('deps').store.list(c.get('userId'), after, PAGE);
    return c.json({ items, next: items.length === PAGE ? cursorOf(items[items.length - 1]) : null });
  });

  app.post('/me/items', async (c) => {
    const body = changesSchema.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'invalid_changes', issues: body.error.issues.slice(0, 5).map((i) => ({ path: i.path.join('.'), message: i.message })) }, 400);
    // Ignore clocks more than a day ahead, so a bad device clock can't pin an item forever.
    const limit = Date.now() + 86_400_000;
    const changes = latestPerItem(body.data.changes).filter((ch) => ch.at <= limit);
    const applied = await c.get('deps').store.apply(c.get('userId'), changes);
    return c.json({ applied, serverTime: Date.now() });
  });

  app.get('/me/export', async (c) => {
    const { store } = c.get('deps');
    const items = [];
    let after = START;
    for (;;) {
      const page = await store.list(c.get('userId'), after, PAGE);
      items.push(...page);
      if (page.length < PAGE) break;
      after = page[page.length - 1];
    }
    return c.json({ exportedAt: new Date().toISOString(), items }, 200, { 'Content-Disposition': 'attachment; filename="talaqqa-data.json"' });
  });

  app.delete('/me', async (c) => {
    await c.get('deps').store.deleteUser(c.get('userId'));
    return c.body(null, 204);
  });

  return app;
}
