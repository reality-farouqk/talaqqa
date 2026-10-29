import { useStore } from '../lib/storage';

interface Props { course: string; lessons: { slug: string; title: string }[]; }

// Start / Continue button with the course progress bar. Before hydration (and for new learners) it is a plain "Start" link.
export default function CourseProgress({ course, lessons }: Props) {
  const s = useStore();
  const isDone = (slug: string) => !!s?.done.includes(`${course}/${slug}`);
  const done = lessons.filter((l) => isDone(l.slug)).length;
  const last = lessons.find((l) => l.slug === s?.lastByCourse[course]);
  const started = done > 0 || !!last;
  const resume = (last && !isDone(last.slug) ? last : lessons.find((l) => !isDone(l.slug))) ?? lessons[0];
  const pct = Math.round((done / lessons.length) * 100);
  const label = !started ? '▶ Start course' : done === lessons.length ? '↺ Watch again' : '▶ Continue';

  return (
    <div className="progress">
      <a className="btn big" href={`/courses/${course}/${(started ? resume : lessons[0]).slug}/`}>
        {label}{started && done < lessons.length && <span className="btn-sub" dir="auto">{resume.title}</span>}
      </a>
      {started && (
        <>
          <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress"><i style={{ width: `${pct}%` }} /></div>
          <span className="meta num">{done} of {lessons.length} lessons · {pct}%</span>
        </>
      )}
    </div>
  );
}
