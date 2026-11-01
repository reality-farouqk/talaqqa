import type { APIRoute } from 'astro';
import { getPublishedCourses, flattenLessons, subjectLabel } from '../lib/courses';

// One small static index for client features (search, playlists, continue watching), cached by the service worker.
export const GET: APIRoute = async () => {
  const courses = (await getPublishedCourses()).map((c) => ({
    id: c.id,
    title: c.data.title,
    summary: c.data.summary,
    lang: c.data.language,
    teacher: c.data.source.name,
    track: c.data.track,
    subject: c.data.subject,
    subjectLabel: subjectLabel(c),
    level: c.data.level,
    demo: c.data.demo,
    lessons: flattenLessons(c).map((l) => ({ slug: l.slug, title: l.title, yt: l.youtube_id }))
  }));
  return new Response(JSON.stringify({ courses }), { headers: { 'Content-Type': 'application/json' } });
};
