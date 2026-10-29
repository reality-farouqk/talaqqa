import { useEffect, useState } from 'react';

interface Props { youtubeId?: string; title: string; start?: number; end?: number; }

// Click-to-load YouTube embed. The iframe (and YouTube's JavaScript) only loads
// after the user clicks, which keeps pages fast. Uses youtube-nocookie.com.
export default function LitePlayer({ youtubeId, title, start, end }: Props) {
  const [active, setActive] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  if (!youtubeId) {
    return (
      <div className="player player-msg" role="note">
        <p><strong>Demo lesson.</strong> No video yet. A verified lecture from an approved teacher will play here.</p>
      </div>
    );
  }

  if (offline && !active) {
    return (
      <div className="player player-msg" role="status">
        <p><strong>You're offline.</strong> Videos play from YouTube and need a connection. You can still browse courses you've opened before.</p>
      </div>
    );
  }

  const params = new URLSearchParams({ autoplay: '1', rel: '0' });
  if (start) params.set('start', String(start));
  if (end) params.set('end', String(end));
  const src = `https://www.youtube-nocookie.com/embed/${youtubeId}?${params}`;

  return (
    <div className="player">
      {active ? (
        <iframe src={src} title={title} allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      ) : (
        <>
          <img src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`} alt="" width="480" height="360" />
          <button type="button" className="play" onClick={() => setActive(true)} aria-label={`Play video: ${title}`}>
            <span className="play-icon" aria-hidden="true" />
            <span>Play lesson</span>
          </button>
        </>
      )}
    </div>
  );
}
