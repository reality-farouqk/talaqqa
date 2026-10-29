import { useEffect, useState } from 'react';

const KEY = 'talaqqa:watchlist';
export const readWatchlist = (): string[] => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const write = (v: string[]) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} };

// Stored on the device for now. Swap for the API once accounts exist.
export default function WatchlistButton({ courseSlug }: { courseSlug: string }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => setSaved(readWatchlist().includes(courseSlug)), [courseSlug]);
  const toggle = () => {
    const list = readWatchlist();
    const next = list.includes(courseSlug) ? list.filter((s) => s !== courseSlug) : [...list, courseSlug];
    write(next); setSaved(next.includes(courseSlug));
  };
  return <button className={saved ? 'btn' : 'btn ghost'} onClick={toggle} aria-pressed={saved}>{saved ? 'Saved to watchlist' : 'Save to watchlist'}</button>;
}
