import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'use lowercase-with-hyphens');

const lesson = z.object({
  slug,
  title: z.string().min(1),
  youtube_id: z.string().regex(/^[A-Za-z0-9_-]{11}$/, 'YouTube IDs are 11 characters'),
  summary: z.string().optional(),
  start_seconds: z.number().int().nonnegative().optional(),
  end_seconds: z.number().int().positive().optional()
});

const courses = defineCollection({
  loader: glob({ pattern: '*.yaml', base: './content/courses' }),
  schema: z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    description: z.string().optional(),
    category: slug,
    level: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
    language: z.string().default('en'),
    status: z.enum(['draft', 'published']).default('published'),
    source: z.object({ name: z.string(), url: z.string().url().optional() }),
    modules: z
      .array(z.object({ slug, title: z.string(), lessons: z.array(lesson).min(1) }))
      .min(1)
  })
});

export const collections = { courses };
