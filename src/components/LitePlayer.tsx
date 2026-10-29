import { useEffect, useState } from 'react';

interface Props { youtubeId: string; title: string; start?: number; end?: number; lessonKey: string; }

// Click-to-load YouTube embed. The iframe (and YouTube's JavaScript) only loads
// after the user clicks, which keeps pages fast. Uses youtube-nocookie.com.
export default function LitePlayer({ youtubeId, title, start, end, lessonKey }: Props) {
  const [active, setActive] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  if (offline) {
    return <div className="player" role="status" style={{ display: 'grid', placeItems: 'center', color: '#fff', padding: '1rem', textAlign: 'center' }}>You're offline. This lesson needs a connection to play.</div>;
  }

  const params = new URLSearchParams({ autoplay: '1', rel: '0', modestbranding: '1' });
  if (start) params.set('start', String(start));
  if (end) params.set('end', String(end));
  const src = `https://www.youtube-nocookie.com/embed/${youtubeId}?${params}`;

  return (
    <div className="player">
      {active ? (
        <iframe src={src} title={title} allow="accelerometer; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
      ) : (
        <>
          <img src={`https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`} alt="" loading="lazy" />
          <button className="play" onClick={() => { setActive(true); try { localStorage.setItem('talaqqa:last', lessonKey); } catch {} }}>
            Play lesson
          </button>
        </>
      )}
    </div>
  );
}
