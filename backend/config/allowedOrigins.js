/**
 * config/allowedOrigins.js
 *
 * Single source of truth for CORS origin allowlists. The REST app (server.js)
 * and the Socket.IO server (socket/index.js) each declare their own cors
 * config; when the lists drift, one channel silently rejects production
 * origins (the socket list was missing the onrender hosts — realtime
 * notifications were dead on the deployed web app while REST kept working).
 */

const ALLOWED_ORIGINS = [
    // Local development (Vite dev server + direct API testing)
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:5174',
    'http://localhost',
    'https://localhost',
    // Capacitor native shell
    'capacitor://localhost',
    // Production web (Vercel)
    'https://sparkleappweb.vercel.app',
    'https://sparkleappweb1.vercel.app',
    'https://sparklewebapp.vercel.app',
    'https://sparkleweb.app.vercel.app',
    'https://sparkleapp.vercel.app',
    // Production API (Render) — the origin users actually load the app from
    'https://sparkle-version-003-1-f4v3.onrender.com',
    'https://sparkle-app-backup.onrender.com',
];

/** Same list, but with any explicit env override appended (comma-separated). */
function resolveOrigins() {
    const extra = (process.env.EXTRA_ALLOWED_ORIGINS || '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean);
    return extra.length ? [...ALLOWED_ORIGINS, ...extra] : ALLOWED_ORIGINS;
}

module.exports = { ALLOWED_ORIGINS, resolveOrigins };