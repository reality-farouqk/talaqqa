import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import AstroPWA from '@vite-pwa/astro';

// Set SITE_URL in your environment for production (needed for sitemap + canonical URLs).
const site = process.env.SITE_URL || 'http://localhost:4321';

export default defineConfig({
  site,
  integrations: [
    react(),
    sitemap(),
    AstroPWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Talaqqa',
        short_name: 'Talaqqa',
        description: 'Free, curated Islamic courses from public sources.',
        start_url: '/',
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
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          // Never cache YouTube: iframe, thumbnails of the player, or video.
          {
            urlPattern: ({ url }) => /(^|\.)(youtube|youtube-nocookie|ytimg|googlevideo)\.com$/.test(url.hostname),
            handler: 'NetworkOnly'
          },
          // Images (e.g. covers served from R2): cache-first with expiry.
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: { cacheName: 'images', expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 } }
          },
          // Catalog pages: instant load, quiet update.
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'pages' }
          }
        ]
      }
    })
  ]
});
