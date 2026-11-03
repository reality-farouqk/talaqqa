import { useEffect, useState, type FormEvent } from 'react';
import { currentUser, endSession, forgetDevice, lastSync, startSession, syncNow, SYNC_EVENT, type User } from '../lib/sync';

type Health = { accounts: boolean; google: boolean };
const post = (path: string, body: unknown) =>
  fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });

// Better Auth error codes -> what to tell the learner.
const MESSAGES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Wrong email or password.',
  USER_ALREADY_EXISTS: 'An account with this email already exists. Sign in instead.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'An account with this email already exists. Sign in instead.',
  PASSWORD_TOO_SHORT: 'Use at least 8 characters.',
  INVALID_EMAIL: 'Check the email address.'
};
async function errorText(res: Response) {
  if (res.status === 429) return 'Too many attempts. Wait a minute and try again.';
  const body = await res.json().catch(() => null) as { code?: string } | null;
  return (body?.code && MESSAGES[body.code]) || 'Something went wrong. Try again.';
}

export default function Account() {
  const [health, setHealth] = useState<Health | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [synced, setSynced] = useState<number | null>(null);
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const refresh = () => { setUser(currentUser()); setSynced(lastSync()); };
    refresh();
    window.addEventListener(SYNC_EVENT, refresh);
    fetch('/api/health', { signal: AbortSignal.timeout(15000) }).then((r) => r.json()).then(setHealth).catch(() => setHealth({ accounts: false, google: false }));
    // Back from Google sign-in, or signed in on another tab: adopt the server session.
    fetch('/api/auth/get-session', { credentials: 'same-origin' }).then((r) => (r.ok ? r.json() : null)).then((s: { user?: User } | null) => {
      if (s?.user && currentUser()?.id !== s.user.id) startSession(pick(s.user)).catch(() => {});
    }).catch(() => {});
    return () => window.removeEventListener(SYNC_EVENT, refresh);
  }, []);

  if (!health) return <p className="meta">Loading…</p>;

  if (user) {
    return (
      <div className="account">
        <p><strong>{user.name || user.email}</strong><br /><span className="meta">{user.email}</span></p>
        <p className="meta" role="status">{synced ? `Synced ${new Date(synced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Syncing…'}</p>
        <div className="action-row">
          <button className="btn" type="button" onClick={() => syncNow().catch(() => {})}>Sync now</button>
          <a className="btn ghost" href="/api/me/export" download>Download my data</a>
          <button className="btn ghost" type="button" disabled={busy} onClick={async () => { setBusy(true); await endSession(); setBusy(false); }}>Sign out</button>
        </div>
        <p className="meta">Signing out clears this device.</p>
        <details className="danger" open={confirmDelete} onToggle={(e) => setConfirmDelete((e.target as HTMLDetailsElement).open)}>
          <summary>Delete account</summary>
          <p>Deletes your account and everything saved in it, on our side and on this device. This can't be undone.</p>
          <button className="btn danger" type="button" disabled={busy} onClick={async () => {
            setBusy(true); setError('');
            const res = await fetch('/api/me', { method: 'DELETE', credentials: 'same-origin', signal: AbortSignal.timeout(15000) }).catch(() => null);
            if (res?.ok) forgetDevice(); else setError('Could not delete the account. Try again.');
            setBusy(false);
          }}>Delete my account</button>
        </details>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
    );
  }

  if (!health.accounts) {
    return <p>Accounts are coming soon. Your progress is saved on this device.</p>;
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email')).trim(), password = String(f.get('password'));
    setBusy(true); setError('');
    try {
      const res = mode === 'up'
        ? await post('/api/auth/sign-up/email', { email, password, name: String(f.get('name') ?? '').trim() || email.split('@')[0] })
        : await post('/api/auth/sign-in/email', { email, password });
      if (!res.ok) { setError(await errorText(res)); return; }
      const { user: u } = await res.json() as { user: User };
      await startSession(pick(u));
    } catch {
      setError(navigator.onLine ? 'Something went wrong. Try again.' : "You're offline. Connect and try again.");
    } finally { setBusy(false); }
  }

  async function google() {
    setBusy(true); setError('');
    const res = await post('/api/auth/sign-in/social', { provider: 'google', callbackURL: '/account/' }).catch(() => null);
    const body = res?.ok ? await res.json() as { url?: string } : null;
    if (body?.url) location.href = body.url; else { setError('Google sign-in is not available right now.'); setBusy(false); }
  }

  return (
    <div className="account">
      <p>Sign in to keep your progress, saved courses, playlists and notes on every device.</p>
      {health.google && <><button className="btn" type="button" disabled={busy} onClick={google}>Continue with Google</button><p className="meta or">or</p></>}
      <form onSubmit={submit} className="account-form">
        {mode === 'up' && <label>Name <input name="name" autoComplete="name" maxLength={80} /></label>}
        <label>Email <input name="email" type="email" required autoComplete="email" maxLength={200} /></label>
        <label>Password <input name="password" type="password" required minLength={8} maxLength={128} autoComplete={mode === 'up' ? 'new-password' : 'current-password'} /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'up' ? 'Create account' : 'Sign in'}</button>
      </form>
      <p className="meta">
        {mode === 'in' ? 'New here? ' : 'Have an account? '}
        <button className="link" type="button" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(''); }}>{mode === 'in' ? 'Create an account' : 'Sign in'}</button>
      </p>
      <p className="meta">What you've done on this device is added to your account.</p>
    </div>
  );
}

const pick = (u: User): User => ({ id: u.id, email: u.email, name: u.name });
