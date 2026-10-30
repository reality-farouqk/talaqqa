import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { LEVEL_IDS, TRACKS, getSubject } from './lib/taxonomy';

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'use lowercase-with-hyphens');

const lesson = z.object({
  slug,
  title: z.string().min(1),
  // Required for real courses. Demo lessons have no video: never invent an ID.
  youtube_id: z.string().regex(/^[A-Za-z0-9_-]{11}$/, 'YouTube IDs are 11 characters').optional(),
  summary: z.string().optional(),
  start_seconds: z.number().int().nonnegative().optional(),
  end_seconds: z.number().int().positive().optional()
});

const courses = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './content/courses' }),
  schema: z
    .object({
      title: z.string().min(1),
      summary: z.string().min(1),
      description: z.string().optional(),
      // "What you'll learn": short outcome statements shown on the course page.
      outcomes: z.array(z.string().min(1)).max(8).default([]),
      featured: z.boolean().default(false),
      track: z.enum(TRACKS.map((t) => t.id) as [string, ...string[]]),
      subject: slug,
      level: z.enum(LEVEL_IDS),
      // Position within its track + level (1 = take first). Ties sort by title.
      order: z.number().int().positive().default(99),
      // Courses a learner should finish first (course file names without .yaml).
      prerequisites: z.array(slug).default([]),
      language: z.string().default('en'),
      status: z.enum(['draft', 'published']).default('published'),
      // Demo courses show a banner, are hidden from search engines and block production builds.
      demo: z.boolean().default(false),
      // Date a maintainer last checked every video is real, public and embeddable.
      verified_at: z.coerce.date().optional(),
      source: z.object({
        name: z.string().min(1),
        url: z.string().url().optional(),
        // Where the series lives on YouTube (playlist or channel), shown as "Original source".
        playlist_url: z.string().url().optional()
      }),
      modules: z
        .array(z.object({ slug, title: z.string(), lessons: z.array(lesson).min(1) }))
        .min(1)
    })
    .superRefine((c, ctx) => {
      if (!getSubject(c.track, c.subject)) {
        const valid = TRACKS.find((t) => t.id === c.track)!.subjects.map((s) => s.id).join(', ');
        ctx.addIssue({ code: 'custom', path: ['subject'], message: `"${c.subject}" is not a subject of track "${c.track}". Use one of: ${valid}` });
      }
      if (c.demo) return;
      if (!c.source.url) ctx.addIssue({ code: 'custom', path: ['source', 'url'], message: 'real courses must link to the teacher or channel' });
      if (!c.verified_at) ctx.addIssue({ code: 'custom', path: ['verified_at'], message: 'real courses need the date their videos were verified' });
      c.modules.forEach((m, mi) =>
        m.lessons.forEach((l, li) => {
          if (!l.youtube_id) ctx.addIssue({ code: 'custom', path: ['modules', mi, 'lessons', li, 'youtube_id'], message: 'real lessons need a verified YouTube ID' });
        })
      );
    })
});

export const collections = { courses };
