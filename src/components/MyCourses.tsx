import { useState } from 'react';
import { clearAll, toggleSavedLesson, useStore } from '../lib/storage';
import { findLesson, thumb, useCatalog, type CatalogCourse } from '../lib/catalog';

export default function MyCourses() {
  const s = useStore();
  const courses = useCatalog();
  const [confirming, setConfirming] = useState(false);
  if (!s || !courses) return <p className="meta">Loading your library…</p>;

  const doneIn = (c: CatalogCourse) => c.lessons.filter((l) => s.done.includes(`${c.id}/${l.slug}`)).length;
  const started = courses.filter((c) => doneIn(c) > 0 || s.lastByCourse[c.id]);
  const saved = courses.filter((c) => s.watchlist.includes(c.id));
  const lessons = s.savedLessons.map((k) => ({ key: k, found: findLesson(courses, k) })).filter((x) => x.found);

  const card = (c: CatalogCourse) => {
    const d = doneIn(c);
    const yt = c.lessons.find((l) => l.yt)?.yt;
    return (
      <li key={c.id}>
        <a className="course-card" href={`/courses/${c.id}/`}>
          <span className="card-thumb">{yt ? <img className="thumb" src={thumb(yt)} alt="" width={320} height={180} loading="lazy" /> : <span className="thumb thumb-empty" aria-hidden="true">{c.subjectLabel}</span>}</span>
          <span className="bar" aria-hidden="true"><i style={{ width: `${Math.round((d / c.lessons.length) * 100)}%` }} /></span>
          <span className="card-body">
            <h3 lang={c.lang} dir="auto">{c.title}</h3>
            <span className="meta"><bdi>{c.teacher}</bdi> · {d} of {c.lessons.length} done</span>
          </span>
        </a>
      </li>
    );
  };

  return (
    <>
      <p><a href="/playlists/">Your playlists ({s.playlists.length}) →</a></p>
      <section aria-labelledby="started-h">
        <h2 id="started-h">In progress</h2>
        {started.length ? <ul className="grid">{started.map(card)}</ul> : <p className="meta">Courses you start appear here.</p>}
      </section>
      <section aria-labelledby="later-h">
        <h2 id="later-h">Watch later</h2>
        {lessons.length ? (
          <ol className="lesson-list">
            {lessons.map(({ key, found }) => (
              <li key={key} className="pl-row">
                <a href={found!.url}>
                  {found!.lesson.yt ? <img className="thumb" src={thumb(found!.lesson.yt)} alt="" width={320} height={180} loading="lazy" /> : <span className="thumb thumb-empty" aria-hidden="true" />}
                  <span className="lt"><span dir="auto">{found!.lesson.title}</span><br /><span className="meta" dir="auto">{found!.course.title}</span></span>
                </a>
                <span className="pl-ctrl"><button type="button" aria-label="Remove from Watch later" onClick={() => toggleSavedLesson(key)}>✕</button></span>
              </li>
            ))}
          </ol>
        ) : <p className="meta">Tap “Watch later” under any lesson to save it here.</p>}
      </section>
      <section aria-labelledby="saved-h">
        <h2 id="saved-h">Saved courses</h2>
        {saved.length ? <ul className="grid">{saved.map(card)}</ul> : <p>Nothing saved yet. <a href="/courses/">Browse courses</a> and tap “Save to watchlist”.</p>}
      </section>
      <section aria-labelledby="device-h" className="note">
        <h2 id="device-h" className="eyebrow">Stored on this device</h2>
        <p>Your progress, playlists and notes are saved in this browser only. Nothing is sent to us. Clearing your browser data removes them.</p>
        {confirming ? (
          <p className="actions">
            <button type="button" className="btn danger" onClick={() => { clearAll(); setConfirming(false); }}>Yes, clear everything</button>
            <button type="button" className="btn ghost" onClick={() => setConfirming(false)}>Cancel</button>
          </p>
        ) : <p><button type="button" className="btn ghost" onClick={() => setConfirming(true)}>Clear my data on this device</button></p>}
      </section>
    </>
  );
}
