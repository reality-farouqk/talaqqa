import { useStore } from '../lib/storage';

interface Props { course: string; lessons: { slug: string; title: string }[]; showResume?: boolean; }

// Progress bar + "Resume" link for one course. Renders nothing until the learner has started.
export default function CourseProgress({ course, lessons, showResume = false }: Props) {
  const s = useStore();
  if (!s) return null;
  const done = lessons.filter((l) => s.done.includes(`${course}/${l.slug}`)).length;
  const lastSlug = s.lastByCourse[course];
  const last = lessons.find((l) => l.slug === lastSlug);
  if (!done && !last) return null;
  const pct = Math.round((done / lessons.length) * 100);
  const next = lessons.find((l) => !s.done.includes(`${course}/${l.slug}`));
  const resume = last && !s.done.includes(`${course}/${last.slug}`) ? last : next;
  return (
    <div className="progress">
      <div className="progress-row">
        <span className="meta">{done} of {lessons.length} lessons complete</span>
        <span className="meta num">{pct}%</span>
      </div>
      <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress"><i style={{ width: `${pct}%` }} /></div>
      {showResume && resume && (
        <p><a className="btn" href={`/courses/${course}/${resume.slug}/`}>Resume: <span dir="auto">{resume.title}</span></a></p>
      )}
    </div>
  );
}
