import { useEffect, useRef, useState } from 'react';
import { markDone, read, savePosition, saveSettings, useStore } from '../lib/storage';

interface Props { youtubeId?: string; title: string; start?: number; end?: number; lessonKey: string; nextUrl?: string; nextTitle?: string; }

declare global { interface Window { YT?: any; onYouTubeIframeAPIReady?: () => void; } }

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const COUNTDOWN = 5;

// YouTube's official IFrame API, loaded once and only when a video is about to play.
let apiReady: Promise<any> | undefined;
function loadApi() {
  apiReady ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.append(s);
  });
  return apiReady;
}

const clock = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

// Inside a playlist (?list=id) the next item comes from the playlist instead of the course.
// Returns undefined outside a playlist, null at the playlist's end.
function playlistNext(lessonKey: string) {
  const id = new URLSearchParams(location.search).get('list');
  const list = id && read().playlists.find((p) => p.id === id);
  if (!list) return undefined;
  const next = list.items[list.items.indexOf(lessonKey) + 1];
  return next ? { url: `/courses/${next}/?list=${id}`, title: `Next in “${list.title}”` } : null;
}
const withPlay = (url: string) => `${url}${url.includes('?') ? '&' : '?'}play`;

export default function Player({ youtubeId, title, start, end, lessonKey, nextUrl: courseNextUrl, nextTitle: courseNextTitle }: Props) {
  const store = useStore();
  const [upNext, setUpNext] = useState(courseNextUrl ? { url: courseNextUrl, title: courseNextTitle } : undefined);
  useEffect(() => { const p = playlistNext(lessonKey); if (p !== undefined) setUpNext(p ?? undefined); }, [lessonKey]);
  const nextUrl = upNext?.url;
  const nextTitle = upNext?.title;
  const [active, setActive] = useState(false);
  const [offline, setOffline] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [resumedAt, setResumedAt] = useState(0);
  const mount = useRef<HTMLDivElement>(null);
  const player = useRef<any>(null);
  // The YouTube callbacks are created once, so they read the latest up-next through a ref.
  const nextRef = useRef(nextUrl);
  nextRef.current = nextUrl;

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    // Arriving from auto-next, or autoplay on: start straight away.
    const s = read().settings;
    if (youtubeId && navigator.onLine && (s.autoplay || new URLSearchParams(location.search).has('play'))) setActive(true);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, [youtubeId]);

  useEffect(() => {
    if (!active || !youtubeId) return;
    const saved = read().positions[lessonKey] ?? 0;
    const from = saved > 10 ? saved : start ?? 0;
    if (saved > 10) setResumedAt(saved);
    let timer: number | undefined;
    let cancelled = false;
    loadApi().then((YT) => {
      if (cancelled || !mount.current) return;
      // YouTube replaces the element it is given, so give it one React doesn't own.
      const el = document.createElement('div');
      mount.current.replaceChildren(el);
      player.current = new YT.Player(el, {
        host: 'https://www.youtube-nocookie.com',
        videoId: youtubeId,
        playerVars: { autoplay: 1, rel: 0, playsinline: 1, start: Math.floor(from), ...(end && { end }) },
        events: {
          onReady: (e: any) => { e.target.setPlaybackRate(read().settings.speed); e.target.playVideo(); },
          onPlaybackRateChange: (e: any) => saveSettings({ speed: e.data }),
          onStateChange: (e: any) => {
            window.clearInterval(timer);
            if (e.data === YT.PlayerState.PLAYING) {
              timer = window.setInterval(() => savePosition(lessonKey, player.current.getCurrentTime()), 10000);
            } else if (e.data === YT.PlayerState.PAUSED) {
              savePosition(lessonKey, player.current.getCurrentTime());
            } else if (e.data === YT.PlayerState.ENDED) {
              markDone(lessonKey);
              if (nextRef.current && read().settings.autoNext) setCountdown(COUNTDOWN);
            }
          }
        }
      });
    });
    return () => { cancelled = true; window.clearInterval(timer); player.current?.destroy?.(); };
  }, [active, youtubeId, lessonKey]);

  useEffect(() => {
    if (countdown === null || !nextUrl) return;
    if (countdown === 0) { location.href = withPlay(nextUrl); return; }
    const t = window.setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdown, nextUrl]);

  const setSpeed = (speed: number) => { saveSettings({ speed }); player.current?.setPlaybackRate?.(speed); };
  const restart = () => { player.current?.seekTo?.(start ?? 0, true); setResumedAt(0); };
  const settings = store?.settings;

  let screen;
  if (!youtubeId) {
    screen = <div className="player player-msg" role="note"><p><strong>Demo lesson</strong>: no video yet.</p></div>;
  } else if (offline && !active) {
    screen = <div className="player player-msg" role="status"><p><strong>You're offline.</strong> Videos need a connection.</p></div>;
  } else {
    screen = (
      <div className="player">
        {active ? <div ref={mount} className="yt-mount" /> : (
          <>
            <img src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`} alt="" width="480" height="360" />
            <button type="button" className="play" onClick={() => setActive(true)} aria-label={`Play video: ${title}`}>
              <span className="play-icon" aria-hidden="true" />
            </button>
          </>
        )}
        {countdown !== null && (
          <div className="up-next" role="status">
            <p className="meta">Up next in {countdown}</p>
            <p className="up-next-title" dir="auto">{nextTitle}</p>
            <p className="actions" style={{ justifyContent: 'center' }}>
              <a className="btn" href={withPlay(nextUrl!)}>Play now</a>
              <button type="button" className="btn ghost" onClick={() => setCountdown(null)}>Cancel</button>
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="player-wrap">
      {screen}
      {youtubeId && settings && (
        <div className="controls">
          <label>Speed{' '}
            <select value={settings.speed} onChange={(e) => setSpeed(Number(e.target.value))}>
              {SPEEDS.map((s) => <option key={s} value={s}>{s === 1 ? 'Normal' : `${s}×`}</option>)}
            </select>
          </label>
          <label><input type="checkbox" checked={settings.autoplay} onChange={(e) => saveSettings({ autoplay: e.target.checked })} /> Autoplay</label>
          <label><input type="checkbox" checked={settings.autoNext} onChange={(e) => saveSettings({ autoNext: e.target.checked })} /> Auto-next</label>
          {resumedAt > 0 && <button type="button" className="linkish" onClick={restart}>Resumed at {clock(resumedAt)} · Start over</button>}
          <span className="meta">Quality &amp; captions: ⚙ in the player</span>
        </div>
      )}
    </div>
  );
}
