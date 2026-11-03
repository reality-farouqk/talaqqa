// All /api routes except /api/errors (its own function) go to the Hono app.
import { neon } from '@neondatabase/serverless';
import type { ExecutionContext } from 'hono';
import { createApp } from '../../src/api/app.ts';
import { makeAuth, type Env } from '../../src/api/auth.ts';
import { sqlStore } from '../../src/api/store.ts';

const app = createApp((raw) => {
  const env = raw as Env;
  if (!env.DATABASE_URL || !env.BETTER_AUTH_SECRET) return null;
  const sql = neon(env.DATABASE_URL);
  const auth = makeAuth(env);
  return {
    store: sqlStore((text, params) => sql.query(text, params) as Promise<Record<string, unknown>[]>),
    origin: new URL(env.SITE_URL ?? 'https://talaqqa.pages.dev').origin,
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    auth: {
      handler: (req) => auth.handler(req),
      userId: async (req) => (await auth.api.getSession({ headers: req.headers }))?.user.id ?? null
    }
  };
});

// Cloudflare Pages Functions context (only the parts used here).
interface Context { request: Request; env: Env; waitUntil(promise: Promise<unknown>): void; passThroughOnException(): void; }
export const onRequest = (ctx: Context) => app.fetch(ctx.request, ctx.env, ctx as unknown as ExecutionContext);
