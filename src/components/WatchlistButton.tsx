import { toggleWatchlist, useStore } from '../lib/storage';

export default function WatchlistButton({ courseSlug }: { courseSlug: string }) {
  const s = useStore();
  const saved = !!s?.watchlist.includes(courseSlug);
  return (
    <button type="button" className={saved ? 'btn' : 'btn ghost'} onClick={() => toggleWatchlist(courseSlug)} aria-pressed={saved} disabled={!s}>
      {saved ? 'Saved to watchlist' : 'Save to watchlist'}
    </button>
  );
}
