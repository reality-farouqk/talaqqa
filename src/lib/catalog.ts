import { useEffect, useState } from 'react';

export interface CatalogLesson { slug: string; title: string; yt?: string; }
export interface CatalogCourse {
  id: string; title: string; summary: string; lang: string; teacher: string;
  track: string; subject: string; subjectLabel: string; level: string; demo: boolean; lessons: CatalogLesson[];
}

let request: Promise<CatalogCourse[]> | undefined;

/** null while loading, [] if it could not be loaded (e.g. offline and never cached). */
export function useCatalog(): CatalogCourse[] | null {
  const [courses, setCourses] = useState<CatalogCourse[] | null>(null);
  useEffect(() => {
    request ??= fetch('/catalog.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`catalog ${r.status}`))))
      .then((d) => d.courses)
      .catch((err) => { console.error(err); request = undefined; return []; });
    request.then(setCourses);
  }, []);
  return courses;
}

/** "course/lesson" key -> its course and lesson, if both still exist. */
export function findLesson(courses: CatalogCourse[], key: string) {
  const [courseId, slug] = key.split('/');
  const course = courses.find((c) => c.id === courseId);
  const lesson = course?.lessons.find((l) => l.slug === slug);
  return course && lesson ? { course, lesson, url: `/courses/${courseId}/${slug}/` } : undefined;
}

export const thumb = (yt?: string) => (yt ? `https://i.ytimg.com/vi/${yt}/mqdefault.jpg` : undefined);
