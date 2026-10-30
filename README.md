# Talaqqa

A free, open-source video library for learning Arabic and Islam, from the foundations to advanced study. Lessons are public lectures (YouTube first) organised into courses; we never host or download video. Installable as a PWA; a native app comes later.

## Features (v1)

- **Learning paths**: *Learn Arabic* and *Learn Islam*, each Foundations → Beginner → Intermediate → Advanced, plus topic pages (Aqeedah, Fiqh, Seerah, Quran, Hadith, Character, Arabic grammar…).
- **Home**: search, Continue Watching row, a light daily streak, featured courses and category rows.
- **Course page**: what you'll learn, expandable outline (sections → lessons), progress, Start/Continue, save to watchlist.
- **Lesson page**: official YouTube player (youtube-nocookie) with resume position, speed, autoplay and auto-next; mark complete; next/previous; Watch later; add to playlist; notes.
- **Playlists**: create, rename, reorder, remove, play in order. **Library**: in progress, Watch later, saved courses.
- **Search**: courses and lessons, filtered by topic, teacher, language and level.
- **PWA**: installable, offline shell, visited pages work offline, video never cached.
- **SEO**: static pages, sitemap, canonical URLs, Open Graph, Course / VideoObject / Breadcrumb / CollectionPage JSON-LD.

The catalog starts with 15 courses chosen from the discovery engine's first run. Progress, playlists, notes and the watchlist are stored on the device for now. Accounts and sync arrive in Phase 2 (`db/0001_init.sql` already has the tables).

## Run it

```bash
npm install
npm run dev      # http://localhost:4321
npm test         # discovery engine tests
npm run build    # static site + service worker in dist/
```

Copy `.env.example` to `.env` for local settings. Production builds use `SITE_URL` and `CONTENT_MODE=production` (fails if a demo course is still published).

## How it is built

| Part | Choice | Why |
|---|---|---|
| Site and app | Astro + React islands (Vite under the hood) | Static, SEO-friendly pages; React only where the page is interactive. One app, one build. |
| Content | YAML files in `content/courses/`, validated by Zod (`src/content.config.ts`) | Anyone can propose a course with a pull request; a bad file fails the build. |
| Curriculum | `src/lib/taxonomy.ts` | Tracks, levels and subjects in one place. |
| Device data | `src/lib/storage.ts` | One versioned localStorage key, ready to import into an account. |
| Client index | `/catalog.json` | One cached file for search, playlists and Continue Watching. |
| Database (Phase 2) | Neon Postgres, `db/0001_init.sql` | Courses, sections, lessons, videos, creators, playlists, watchlist, progress, notes. |
| Hosting | Cloudflare Pages (`.github/workflows/deploy.yml`) | Free static hosting with PR previews. |
| Discovery | `scripts/discover/` + weekly workflow | Finds and scores YouTube series; drafts go to a review PR. |

### Project structure

```
content/courses/      one YAML file per course (sections = "modules", lessons)
content/discovery/    discovery engine settings (seed searches, trusted channels)
db/                   Postgres schema
scripts/discover/     discovery engine (YouTube Data API) + tests
src/components/       Astro components and React islands (Player, Search, Playlists…)
src/lib/              taxonomy, course helpers, device storage, catalog hook
src/pages/            routes: /, /learn/{track}/{subject}/, /courses/{course}/{lesson}/, /search/, /playlists/…
docs/progress.json    development progress tracker
```

## Data model

`creators` own `courses`; a course has `sections` with ordered `lessons`; each lesson points at a `videos` row (provider + external id + cached metadata). `teachers` are the scholars/channels credited; `topics` are the subjects. Per user: `playlists` + `playlist_items`, `watchlist_items` (a course or a lesson), `lesson_progress`, `lesson_notes`, `study_days`. See `db/README.md`.

## Roadmap for creator contributions

1. **Now**: anyone can suggest a course (issue template) or open a PR with a course file. Maintainers review against the content guidelines.
2. **Phase 2**: accounts (Better Auth) and sync. Every course already has an owner (`creators`), today the Talaqqa curators.
3. **Phase 5**: creator accounts: a creator links their YouTube channel, builds courses from their own playlists, and submits them to a review queue (`status: in_review`). Verified creators get a badge and a dashboard; maintainers keep the final say.

See `docs/progress.json` for all phases.

## Content and licensing

Code: MIT. Videos belong to their creators and play from YouTube through the official embed. We do not download, re-host or modify them. Creators can request removal at any time from the site's Report page.
