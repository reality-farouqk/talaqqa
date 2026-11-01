import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }>; }

const DISMISS_KEY = 'talaqqa:install-dismissed';

// Android/desktop Chrome: a real install button. iOS Safari: a short hint, since it has no install API.
export default function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === '1'; } catch {}
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    if (dismissed || standalone) return;
    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
    if (isIos) { setIos(true); setHidden(false); }
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BeforeInstallPromptEvent); setHidden(false); };
    const onInstalled = () => setHidden(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  if (hidden || (!evt && !ios)) return null;
  const dismiss = () => { try { localStorage.setItem(DISMISS_KEY, '1'); } catch {} setHidden(true); };

  return (
    <aside className="install" aria-label="Install the app">
      {evt ? (
        <p>Install Talaqqa on your phone for quick access and offline browsing.</p>
      ) : (
        <p>To install on iPhone or iPad: tap <strong>Share</strong> <span aria-hidden="true">⬆︎</span> then <strong>Add to Home Screen</strong>.</p>
      )}
      <div className="install-actions">
        {evt && (
          <button type="button" className="btn" onClick={async () => { await evt.prompt(); await evt.userChoice; setEvt(null); setHidden(true); }}>Install</button>
        )}
        <button type="button" className="btn ghost" onClick={dismiss}>Not now</button>
      </div>
    </aside>
  );
}
