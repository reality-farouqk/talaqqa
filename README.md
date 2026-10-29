# Talaqqa 

A free, open-source library of structured Islamic courses built from publicly available lectures (YouTube first). Courses are plain YAML files in `content/courses/`, so anyone can add one with a pull request.

## Run it

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static site + PWA service worker in dist/
```

## How it works

- **Astro** builds static, SEO-friendly pages for every course and lesson. React is used only for small interactive "islands" (player, watchlist, complete button).
- **Content** lives in `content/courses/*.yaml` and is validated at build time by the Zod schema in `src/content.config.ts`. A bad YouTube ID or missing field fails the build.
- **PWA** via `@vite-pwa/astro`: installable, catalog pages cached for offline browsing. YouTube is never cached.
- **Player** loads the official YouTube embed (youtube-nocookie) only after a click.
- **User data** (watchlist, completed lessons) is stored in the browser's localStorage for now. The next step is accounts + Neon Postgres + a Hono API (see `db/`).

## Rename the app

Edit `src/config.ts` and the `manifest` block in `astro.config.mjs`.

## Add a course

Copy `content/courses/seerah-intro.yaml`, change the details, and use real YouTube video IDs. Always credit the teacher in `source`. See `CONTRIBUTING.md`.

## Roadmap

1. Database + sync script (YouTube Data API: titles, durations, dead-video checks)
2. Auth (Better Auth), progress and watchlist saved to the API
3. Search (Pagefind), notes, quizzes
4. Creator submissions with a review queue

## Content and licensing

Code: MIT. Videos belong to their creators and play from YouTube through the official embed. We do not download, re-host or modify them. Creators can request removal at any time.
