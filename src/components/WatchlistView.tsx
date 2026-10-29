import { useEffect, useState } from 'react';
import { readWatchlist } from './WatchlistButton';

interface Item { slug: string; title: string; summary: string; }

export default function WatchlistView({ courses }: { courses: Item[] }) {
  const [slugs, setSlugs] = useState<string[] | null>(null);
  useEffect(() => setSlugs(readWatchlist()), []);
  if (slugs === null) return <p className="meta">Loading…</p>;
  const items = courses.filter((c) => slugs.includes(c.slug));
  if (!items.length) return <p>Your watchlist is empty. <a href="/courses">Browse courses</a> and save the ones you want to take.</p>;
  return (
    <ul className="grid">
      {items.map((c) => (
        <li key={c.slug}><a className="course-card" href={`/courses/${c.slug}`}><h3>{c.title}</h3><p className="meta">{c.summary}</p></a></li>
      ))}
    </ul>
  );
}
