import { useEffect, useState } from 'react';
import { useCatalog, thumb, type CatalogCourse } from '../lib/catalog';

const LEVELS = ['foundations', 'beginner', 'intermediate', 'advanced'];
const LANGS: Record<string, string> = { en: 'English', ar: 'Arabic' };
const FILTERS = ['q', 'topic', 'teacher', 'lang', 'level'] as const;
type Filters = Record<(typeof FILTERS)[number], string>;

// Lowercase and drop Arabic vowel marks so "العقيدة" matches "العَقِيدَة".
const norm = (s: string) => s.toLowerCase().replace(/[ً-ْـ]/g, '');
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function Search() {
  const courses = useCatalog();
  const [f, setF] = useState<Filters>({ q: '', topic: '', teacher: '', lang: '', level: '' });

  useEffect(() => {
    const p = new URLSearchParams(location.search);
    setF(Object.fromEntries(FILTERS.map((k) => [k, p.get(k) ?? ''])) as Filters);
  }, []);
  // Keep the URL shareable without adding history entries on every keystroke.
  const set = (k: keyof Filters, v: string) => {
    const next = { ...f, [k]: v };
    setF(next);
    const p = new URLSearchParams(Object.entries(next).filter(([, val]) => val));
    history.replaceState(null, '', p.size ? `?${p}` : location.pathname);
  };

  if (!courses) return <p className="meta">Loading…</p>;
  if (!courses.length) return <p>Search isn't available offline yet. Open it once while connected.</p>;

  const topics = [...new Map(courses.map((c) => [`${c.track}/${c.subject}`, c.subjectLabel])).entries()];
  const teachers = [...new Set(courses.map((c) => c.teacher))].sort();
  const q = norm(f.q.trim());
  const matchesFilters = (c: CatalogCourse) =>
    (!f.topic || `${c.track}/${c.subject}` === f.topic) && (!f.teacher || c.teacher === f.teacher) &&
    (!f.lang || c.lang === f.lang) && (!f.level || c.level === f.level);
  const pool = courses.filter(matchesFilters);
  const lessonHits = q ? pool.flatMap((c) => c.lessons.filter((l) => norm(l.title).includes(q)).map((l) => ({ c, l }))) : [];
  // A course also matches when one of its lessons does.
  const courseHits = pool.filter((c) => !q || norm(`${c.title} ${c.summary} ${c.teacher} ${c.subjectLabel}`).includes(q) || lessonHits.some((h) => h.c === c));

  const select = (k: keyof Filters, label: string, options: [string, string][]) => (
    <label className="filter">{label}
      <select value={f[k]} onChange={(e) => set(k, e.target.value)}>
        <option value="">All</option>
        {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );

  return (
    <>
      <div className="search-box">
        <label htmlFor="q" className="sr-only">Search</label>
        <input id="q" type="search" value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="Search courses, lessons, teachers" autoFocus dir="auto" />
      </div>
      <div className="filters">
        {select('topic', 'Topic', topics)}
        {select('teacher', 'Teacher', teachers.map((t) => [t, t]))}
        {select('lang', 'Language', [...new Set(courses.map((c) => c.lang))].map((l) => [l, LANGS[l] ?? l]))}
        {select('level', 'Level', LEVELS.map((l) => [l, cap(l)]))}
      </div>
      <p className="meta" role="status">{courseHits.length} {courseHits.length === 1 ? 'course' : 'courses'}{q && `, ${lessonHits.length} lessons`}</p>
      {courseHits.length > 0 && (
        <ul className="grid">
          {courseHits.map((c) => {
            const yt = c.lessons.find((l) => l.yt)?.yt;
            return (
              <li key={c.id}>
                <a className="course-card" href={`/courses/${c.id}/`}>
                  <span className="card-thumb">{yt ? <img className="thumb" src={thumb(yt)} alt="" width={320} height={180} loading="lazy" /> : <span className="thumb thumb-empty" aria-hidden="true">{c.subjectLabel}</span>}<span className="count">{c.lessons.length} videos</span></span>
                  <span className="card-body">
                    <h3 lang={c.lang} dir="auto">{c.title}</h3>
                    <span className="meta"><bdi>{c.teacher}</bdi> · {cap(c.level)}{c.demo && <> <span className="badge">Demo</span></>}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
      {lessonHits.length > 0 && (
        <section aria-labelledby="lh">
          <h2 id="lh">Lessons</h2>
          <ol className="lesson-list">
            {lessonHits.slice(0, 30).map(({ c, l }) => (
              <li key={`${c.id}/${l.slug}`}>
                <a href={`/courses/${c.id}/${l.slug}/`}>
                  {l.yt ? <img className="thumb" src={thumb(l.yt)} alt="" width={320} height={180} loading="lazy" /> : <span className="thumb thumb-empty" aria-hidden="true" />}
                  <span className="lt"><span dir="auto">{l.title}</span><br /><span className="meta" dir="auto">{c.title}</span></span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}
      {!courseHits.length && !lessonHits.length && <p>No results. Try fewer words or clear a filter.</p>}
    </>
  );
}
