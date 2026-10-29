# Talaqqa

A free, open-source library of structured Islamic courses built from publicly available lectures (YouTube first). Two learning paths, **Learn Arabic** and **Learn Islam**, take learners from the foundations to advanced study. Courses are plain YAML files in `content/courses/`, so anyone can propose one with a pull request.

## Run it

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static site + PWA service worker in dist/
```

Production builds: set `SITE_URL` (for the sitemap and canonical URLs) and `CONTENT_MODE=production`, which fails the build if any demo course is still published.

## How it works

- **Astro** builds static, SEO-friendly pages for every path, course and lesson. React is used only for small interactive "islands" (player, progress, watchlist, install prompt).
- **Curriculum**: every course has a `track` (`arabic` or `islam`), a `level` (`foundations`, `beginner`, `intermediate`, `advanced`), a `subject` within that track and an `order`. The structure lives in `src/lib/taxonomy.ts`.
- **Content** is validated at build time by the Zod schema in `src/content.config.ts` plus catalog checks in `src/lib/courses.ts` (duplicate slugs or videos, missing prerequisites). A bad file fails the build.
- **Player** loads the official YouTube embed (youtube-nocookie) only after a click. Every lesson credits the teacher and links to the original video.
- **PWA** via `@vite-pwa/astro`: installable; visited pages open offline; YouTube is never cached.
- **User data** (watchlist, completed lessons, last lesson) stays in the browser's localStorage. Accounts arrive in Phase 2.

## Demo content

Until real courses are approved, `content/courses/demo-*.yaml` holds sample outlines with **no videos**. They show a "Demo" badge, are `noindex`, are left out of the sitemap, and block production builds.

## Rename the app

Edit `src/config.ts` and the `manifest` block in `astro.config.mjs`.

## Add a course

See `CONTRIBUTING.md`. Use only real, embeddable videos you have checked, and always credit the teacher.

## Progress

Development progress by phase is tracked in `docs/progress.json` (rendered by `docs/progress.html`).

## Content and licensing

Code: MIT. Videos belong to their creators and play from YouTube through the official embed. We do not download, re-host or modify them. Creators can request removal at any time from the site's Report page.
