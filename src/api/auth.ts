import { betterAuth } from 'better-auth';
import { Pool } from '@neondatabase/serverless';

export interface Env {
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  SITE_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

type Options = Parameters<typeof betterAuth>[0];

/** Better Auth for one request (Neon pools must not outlive a Workers request). */
export function makeAuth(env: Env, database: Options['database'] = new Pool({ connectionString: env.DATABASE_URL })) {
  const site = env.SITE_URL ?? 'https://talaqqa.pages.dev';
  return betterAuth({
    database,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: site,
    basePath: '/api/auth',
    trustedOrigins: [site],
    emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128 },
    socialProviders: env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET } }
      : undefined,
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    // Stored in the database so limits hold across Workers isolates.
    rateLimit: {
      enabled: true,
      storage: 'database',
      window: 60,
      max: 60,
      customRules: { '/sign-in/email': { window: 60, max: 5 }, '/sign-up/email': { window: 60, max: 5 } }
    },
    advanced: { useSecureCookies: site.startsWith('https://') }
  });
}

export type Auth = ReturnType<typeof makeAuth>;
