import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import type { ServerResponse } from 'http'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: false
      },
      workbox: {
        // Main bundle is ~5.2 MB; must exceed it or `vite build` fails and
        // the app shell never reaches precache (broke Android sync too).
        maximumFileSizeToCacheInBytes: 7500000,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Notifications must be live. Workbox evaluates routes in order, so
          // this more specific rule wins over the api-cache below: a cached
          // empty array used to be served for up to 24h (and after a slow or
          // failed request), which reads as "no notifications" forever even
          // while new ones arrive. These never hit the cache.
          {
            urlPattern: /\/(api\/)?notifications(\/.*)?(\?.*)?$/i,
            handler: 'NetworkOnly',
            options: {
              cacheName: 'notifications-live'
            }
          },
          {
            urlPattern: /\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              expiration: {
                maxEntries: 50,
                // 5 minutes, not 24h: a NetworkFirst fallback should cover a
                // dropped request, not serve day-old data.
                maxAgeSeconds: 5 * 60
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      manifest: {
        name: 'Sparkle Campus Network',
        short_name: 'Sparkle',
        description: 'Connect with your campus community instantly.',
        theme_color: '#ff3d6d',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/favicon.ico',
            sizes: '64x64',
            type: 'image/x-icon'
          },
          {
            src: '/logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/logo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    }),
  ],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['faith-clanless-lena.ngrok-free.dev', '.ngrok-free.dev', 'localhost', '127.0.0.1'],
    cors: true,
    proxy: {
      // ── Music: always hit local backend so new route is available ──
      '/api/music': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
        proxyTimeout: 10000,
        timeout: 10000,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            console.warn('[Vite Proxy] Backend not ready:', err.message);
            const response = res as ServerResponse;
            if (!response.headersSent) {
              response.writeHead(503, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify({ success: false, message: 'Backend is restarting, please retry.' }));
            }
          });
        },
      },
      '/socket.io': {
        target: 'http://127.0.0.1:3000',
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.warn('[Vite Proxy] WebSocket error:', err.message);
          });
        },
      },
      '/uploads': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/images': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})

