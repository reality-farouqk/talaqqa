import { clearAll, useStore } from '../lib/storage';
import { useState } from 'react';

interface Item { id: string; title: string; summary: string; lang: string; teacher: string; lessons: { slug: string; title: string }[]; }

export default function MyCourses({ courses }: { courses: Item[] }) {
  const s = useStore();
  const [confirming, setConfirming] = useState(false);
  if (!s) return <p className="meta">Loading your courses…</p>;

  const doneIn = (c: Item) => c.lessons.filter((l) => s.done.includes(`${c.id}/${l.slug}`)).length;
  const started = courses.filter((c) => doneIn(c) > 0 || s.lastByCourse[c.id]);
  const saved = courses.filter((c) => s.watchlist.includes(c.id));

  const card = (c: Item) => {
    const d = doneIn(c);
    const pct = Math.round((d / c.lessons.length) * 100);
    return (
      <li key={c.id}>
        <a className="course-card" href={`/courses/${c.id}/`}>
          <h3 lang={c.lang} dir="auto">{c.title}</h3>
          <p lang={c.lang} dir="auto">{c.summary}</p>
          <span className="meta"><bdi>{c.teacher}</bdi> · {d} of {c.lessons.length} done</span>
          <span className="bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
        </a>
      </li>
    );
  };

  return (
    <>
      <section aria-labelledby="started-h">
        <h2 id="started-h">In progress</h2>
        {started.length ? <ul className="grid">{started.map(card)}</ul> : <p className="meta">Courses you start appear here.</p>}
      </section>
      <section aria-labelledby="saved-h">
        <h2 id="saved-h">Saved for later</h2>
        {saved.length ? <ul className="grid">{saved.map(card)}</ul> : <p>Nothing saved yet. <a href="/courses/">Browse courses</a> and tap "Save to watchlist".</p>}
      </section>
      <section aria-labelledby="device-h" className="note">
        <h2 id="device-h" className="eyebrow">Stored on this device</h2>
        <p>Your watchlist and progress are saved in this browser only. Nothing is sent to us. Clearing your browser data removes them.</p>
        {confirming ? (
          <p className="actions">
            <button type="button" className="btn danger" onClick={() => { clearAll(); setConfirming(false); }}>Yes, clear everything</button>
            <button type="button" className="btn ghost" onClick={() => setConfirming(false)}>Cancel</button>
          </p>
        ) : (
          <p><button type="button" className="btn ghost" onClick={() => setConfirming(true)}>Clear my progress on this device</button></p>
        )}
      </section>
    </>
  );
}
