import { useStore } from '../lib/storage';

interface Item { id: string; title: string; lang: string; lessons: { slug: string; title: string }[]; }

export default function ContinueCard({ courses }: { courses: Item[] }) {
  const s = useStore();
  if (!s?.last) return null;
  const course = courses.find((c) => c.id === s.last!.course);
  const lesson = course?.lessons.find((l) => l.slug === s.last!.lesson);
  if (!course || !lesson) return null;
  const done = course.lessons.filter((l) => s.done.includes(`${course.id}/${l.slug}`)).length;
  return (
    <section className="continue" aria-labelledby="continue-h">
      <h2 id="continue-h" className="eyebrow">Continue where you left off</h2>
      <a className="continue-link" href={`/courses/${course.id}/${lesson.slug}/`}>
        <span className="continue-title" lang={course.lang} dir="auto">{lesson.title}</span>
        <span className="meta"><span lang={course.lang} dir="auto">{course.title}</span> · {done} of {course.lessons.length} done</span>
      </a>
    </section>
  );
}
