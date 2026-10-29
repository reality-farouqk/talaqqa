import { getCollection, type CollectionEntry } from 'astro:content';
import { TRACKS, getSubject, getLevel, levelIndex } from './taxonomy';

export type Course = CollectionEntry<'courses'>;

let cache: Promise<Course[]> | undefined;

export function getPublishedCourses(): Promise<Course[]> {
  cache ??= getCollection('courses', (c) => c.data.status === 'published').then((list) => {
    checkCatalog(list);
    return list.sort(byPath);
  });
  return cache;
}

// Cross-file checks the per-file Zod schema can't do. Runs once per build.
function checkCatalog(list: Course[]) {
  const errors: string[] = [];
  const seenVideo = new Map<string, string>();
  const ids = new Set(list.map((c) => c.id));
  for (const c of list) {
    for (const p of c.data.prerequisites) if (!ids.has(p)) errors.push(`${c.id}: prerequisite "${p}" is not a published course`);
    const lessonSlugs = new Set<string>();
    const moduleSlugs = new Set<string>();
    for (const m of c.data.modules) {
      if (moduleSlugs.has(m.slug)) errors.push(`${c.id}: duplicate module slug "${m.slug}"`);
      moduleSlugs.add(m.slug);
      for (const l of m.lessons) {
        if (lessonSlugs.has(l.slug)) errors.push(`${c.id}: duplicate lesson slug "${l.slug}"`);
        lessonSlugs.add(l.slug);
        if (l.youtube_id) {
          const where = `${c.id}/${l.slug}`;
          if (seenVideo.has(l.youtube_id)) errors.push(`video ${l.youtube_id} used twice: ${seenVideo.get(l.youtube_id)} and ${where}`);
          seenVideo.set(l.youtube_id, where);
        }
      }
    }
  }
  if (process.env.CONTENT_MODE === 'production') {
    for (const c of list) if (c.data.demo) errors.push(`${c.id}: demo courses can't be published in a production build`);
  }
  if (errors.length) throw new Error(`Course content check failed:\n- ${errors.join('\n- ')}`);
}

export function flattenLessons(course: Course) {
  return course.data.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title })));
}

export const courseUrl = (id: string) => `/courses/${id}/`;
export const lessonUrl = (id: string, lesson: string) => `/courses/${id}/${lesson}/`;
export const youtubeWatchUrl = (id: string, start?: number) =>
  `https://www.youtube.com/watch?v=${id}${start ? `&t=${start}s` : ''}`;

const RTL = new Set(['ar', 'fa', 'ur', 'he', 'ps', 'ku', 'dv', 'yi']);
export const dirFor = (lang: string): 'rtl' | 'ltr' => (RTL.has(lang.split('-')[0]) ? 'rtl' : 'ltr');
export const languageName = (lang: string) => ({ en: 'English', ar: 'Arabic', ur: 'Urdu' } as Record<string, string>)[lang] ?? lang;

// Learning-path order: track, then level, then order, then title.
export function byPath(a: Course, b: Course) {
  return (
    TRACKS.findIndex((t) => t.id === a.data.track) - TRACKS.findIndex((t) => t.id === b.data.track) ||
    levelIndex(a.data.level) - levelIndex(b.data.level) ||
    a.data.order - b.data.order ||
    a.data.title.localeCompare(b.data.title)
  );
}

export const subjectLabel = (c: Course) => getSubject(c.data.track, c.data.subject)?.label ?? c.data.subject;
export const levelLabel = (id: string) => getLevel(id)?.label ?? id;

// The course after this one in its track's path, if any.
export function nextInPath(course: Course, all: Course[]) {
  const path = all.filter((c) => c.data.track === course.data.track);
  return path[path.findIndex((c) => c.id === course.id) + 1];
}
