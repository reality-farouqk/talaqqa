import { streak, useStore } from '../lib/storage';
import { useCatalog, findLesson, thumb } from '../lib/catalog';

// Home: streak nudge + "Continue watching" row. Shows nothing for first-time visitors.
export default function ContinueRow() {
  const s = useStore();
  const courses = useCatalog();
  if (!s || !courses) return null;

  const items = Object.entries(s.lastByCourse)
    .map(([course, lesson]) => findLesson(courses, `${course}/${lesson}`))
    .filter((x): x is NonNullable<typeof x> => !!x)
    .map((x) => {
      const isDone = (slug: string) => s.done.includes(`${x.course.id}/${slug}`);
      // A finished lesson isn't worth resuming: point at the next unfinished one.
      const lesson = isDone(x.lesson.slug) ? x.course.lessons.find((l) => !isDone(l.slug)) ?? x.lesson : x.lesson;
      return { ...x, lesson, url: `/courses/${x.course.id}/${lesson.slug}/`, done: x.course.lessons.filter((l) => isDone(l.slug)).length };
    })
    .filter((x) => x.done < x.course.lessons.length)
    // Most recent course first.
    .sort((a, b) => Number(b.course.id === s.last?.course) - Number(a.course.id === s.last?.course));
  const { days, doneToday } = streak(s.studyDays);
  if (!items.length && !days) return null;

  return (
    <section aria-labelledby="cw-h" className="row-section">
      <div className="row-head">
        <h2 id="cw-h">Continue watching</h2>
        {days > 0 && <span className="streak">{days}-day streak{doneToday ? ' ✓' : ' · watch one lesson today to keep it'}</span>}
      </div>
      {items.length > 0 && (
        <ul className="row-scroll">
          {items.map(({ course, lesson, url, done }) => (
            <li key={course.id}>
              <a className="tile" href={url}>
                {lesson.yt ? <img className="thumb" src={thumb(lesson.yt)} alt="" width={320} height={180} loading="lazy" /> : <span className="thumb thumb-empty" aria-hidden="true">{course.subjectLabel}</span>}
                <span className="bar" aria-hidden="true"><i style={{ width: `${Math.round((done / course.lessons.length) * 100)}%` }} /></span>
                <span className="tile-title" lang={course.lang} dir="auto">{lesson.title}</span>
                <span className="meta" lang={course.lang} dir="auto">{course.title}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
