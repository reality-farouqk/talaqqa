import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import AstroPWA from '@vite-pwa/astro';
import { readdirSync, readFileSync } from 'node:fs';

// Set SITE_URL in your environment for production (needed for sitemap + canonical URLs).
const site = process.env.SITE_URL || 'http://localhost:4321';

// Demo and draft courses are kept out of the sitemap (their pages are also noindex).
const demoCourses = readdirSync('./content/courses')
  .filter((f) => f.endsWith('.yaml') && /^(demo:\s*true|status:\s*draft)\b/m.test(readFileSync(`./content/courses/${f}`, 'utf8')))
  .map((f) => f.replace(/\.yaml$/, ''));
const hiddenFromSitemap = ['/watchlist/', '/offline/', '/404/', '/playlists/', '/search/', '/review/', '/account/'];

export default defineConfig({
  site,
  trailingSlash: 'always',
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        return !hiddenFromSitemap.includes(path) && !demoCourses.some((id) => path.startsWith(`/courses/${id}/`));
      }
    }),
    AstroPWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Talaqqa',
        short_name: 'Talaqqa',
        description: 'Free, curated Islamic courses from public sources.',
        id: '/',
        start_url: '/',
        scope: '/',
        categories: ['education', 'books'],
        display: 'standalone',
        lang: 'en',
        dir: 'ltr',
        theme_color: '#0e5a57',
        background_color: '#f6f7f5',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: null,
        // Precache the app shell only; other pages are cached as they are visited.
        globPatterns: ['**/*.{js,css,svg,woff2}', 'pwa-192.png', 'index.html', 'courses/index.html', 'offline/index.html', 'catalog.json'],
        // Only our own origin goes through the service worker. YouTube (player, thumbnails, video) is
        // never routed or cached here: the browser fetches it directly, so our CSP can't block it.
        runtimeCaching: [
          {
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === 'image',
            handler: 'CacheFirst',
            options: { cacheName: 'images', expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          },
          // Pages: fresh when online, the saved copy when offline, else the offline page.
          // /api/ (sign-in callbacks, data export) is never cached.
          {
            urlPattern: ({ request, sameOrigin, url }) => sameOrigin && request.mode === 'navigate' && !url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 200 },
              precacheFallback: { fallbackURL: '/offline/' }
            }
          }
        ]
      }
    })
  ]
});
