import { getCollection, type CollectionEntry } from 'astro:content';

export type Course = CollectionEntry<'courses'>;

export async function getPublishedCourses(): Promise<Course[]> {
  return (await getCollection('courses', (c) => c.data.status === 'published')).sort((a, b) =>
    a.data.title.localeCompare(b.data.title)
  );
}

export function flattenLessons(course: Course) {
  return course.data.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title })));
}

export const CATEGORY_LABELS: Record<string, string> = {
  aqeedah: 'Aqeedah',
  fiqh: 'Fiqh',
  seerah: 'Seerah',
  quran: 'Quran & Tafsir',
  hadith: 'Hadith',
  arabic: 'Arabic',
  tazkiyah: 'Tazkiyah'
};

export const categoryLabel = (slug: string) => CATEGORY_LABELS[slug] ?? slug;

export const formatLevel = (l: string) => l.charAt(0).toUpperCase() + l.slice(1);
