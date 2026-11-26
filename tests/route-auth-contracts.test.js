// tests/route-auth-contracts.test.js
// Repo-wide safety net: every API route must require authentication unless it
// is deliberately public (HMAC-verified webhooks, share links, public read
// feeds, recovery flows). A new route that forgets the middleware fails here.
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join, sep } = require('node:path');

const ROUTES_DIR = join(__dirname, '..', 'backend', 'routes');

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return walk(full);
    return e.name.endsWith('.js') ? [full] : [];
});

// Routes that are public on purpose. Key: "<relative file>::<path>".
// Everything else must carry authMiddleware (or optionalAuthMiddleware).
const PUBLIC_BY_DESIGN = new Set([
    // Paystack calls this server-to-server; signature verified in the handler.
    'api/wallet.routes.js::/webhook/paystack',
    // Public key material for the web push subscription.
    'api/notifications.routes.js::/vapid-public-key',
    // Share links must render without a session; privacy gates live in the handler
    // (covered by tests/story-privacy-gaps.test.js and share tests).
    'api/share.routes.js::/:id',
    // Recovery controllers are token/OTP-gated by design.
    'api/recovery.routes.js::/challenge',
    'api/recovery.routes.js::/verify',
    'api/recovery.routes.js::/cancel-deletion',
    'api/recovery.routes.js::/appeal',
    'api/recovery.routes.js::/emergency-export',
    'api/recovery.routes.js::/appeal/status',
    // Support centre: FAQs + AI assistant are public; ticket endpoints run
    // optionalAuth because anonymous tickets exist.
    'api/support.routes.js::/faqs',
    'api/support.routes.js::/faqs/:id/helpful',
    'api/support.routes.js::/ai/chat',
    'api/support.routes.js::/tickets',
    'api/support.routes.js::/ticket',
    'api/support.routes.js::/',
    // Public read-only reference/config endpoints.
    'api/giphy.routes.js::/trending',
    'api/giphy.routes.js::/search',
    'api/universities.routes.js::/',
    'api/universities.routes.js::/search',
    'api/legal.routes.js::/documents',
    'api/link-preview.routes.js::/preview',
    // OTA manifest + app-update channels are public (signed bundles).
    'api/ota.routes.js::/check',
    'api/ota.routes.js::/manifest',
    'api/ota.routes.js::/download',
]);

// A file-level `router.use(authMiddleware...)` protects every route below it.
const hasFileLevelAuth = (src) => /router\.use\(\s*(optionalAuthMiddleware|authMiddleware|ejsAuthMiddleware)/.test(src);

// Matches authMiddleware AND optionalAuthMiddleware (and any casing).
const AUTH_PATTERN = /authmiddleware/i;

const routesOf = (src, file) => {
    const found = [];
    const re = /router\.(get|post|put|patch|delete|all)\(\s*'([^']+)'\s*,([\s\S]*?)\)\s*;/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        found.push({ method: m[1].toUpperCase(), path: m[2], middleware: m[3] });
    }
    return found;
};

describe('route authentication contract', () => {
    const files = walk(ROUTES_DIR).map((f) => {
        const parts = f.split(sep);
        return { full: f, rel: parts.slice(parts.length - 2).join('/') };
    });

    // Routes that are public on purpose beyond the per-file list below.
const PUBLIC_BY_DESIGN2 = new Set([
    // Auth bootstrap: login/signup/refresh/2FA/reset/verify — token-gated by
    // their own handlers, not the session middleware.
    ...['signup', 'login', 'refresh', 'verify-2fa', 'resend-2fa', 'request-2fa-recovery',
        'check-username', 'check-email', 'verify-email', 'verify-sms', 'forgot-password',
        'reset-password', 'resend-verification', 'reactivate', 'cancel-deletion',
        'otp/verify/sync', 'switch-account'].map((p) => `api/auth.routes.js::/${p}`),
    // Public campus content.
    'api/campus.routes.js::/polls', 'api/campus.routes.js::/polls/:id/results',
    'api/campus.routes.js::/polls/:id/share', 'api/campus.routes.js::/events',
    'api/campus.routes.js::/events/:id/share', 'api/campus.routes.js::/streams',
    'api/campus.routes.js::/streams/active', 'api/campus.routes.js::/streams/active-users',
    'api/campus.routes.js::/streams/:id/comments', 'api/campus.routes.js::/streams/:id/stats',
    'api/clubs.routes.js::/category/:category', 'api/clubs.routes.js::/:id/leadership',
    'api/clubs.routes.js::/:id/announcements',
    'api/confession.routes.js::/', 'api/confession.routes.js::/community/:campus',
    'api/confession.routes.js::/:id', 'api/confession.routes.js::/:id/comments',
    // Public reference/config surfaces.
    'api/index.js::/csrf-token', 'api/index.js::/health',
    'api/legal.routes.js::/documents', 'api/legal.routes.js::/documents/:id',
    'api/legal.routes.js::/documents/:id/download', 'api/legal.routes.js::/inquiries',
    'api/legal.routes.js::/inquiries/track/:reference',
    'api/location.routes.js::/resolve', 'api/location.routes.js::/nearby',
    'api/location.routes.js::/search',
    'api/music.routes.js::/search', 'api/music.routes.js::/trending',
    'api/music.routes.js::/categories', 'api/music.routes.js::/preview-proxy',
    'api/skill-market.routes.js::/offers', 'api/skill-market.routes.js::/offers/:id',
    'api/skill-market.routes.js::/offers/:id/reviews',
    'api/universities.routes.js::/', 'api/universities.routes.js::/countries',
    'api/lost-found.routes.js::/', 'api/lost-found.routes.js::/:id',
    // Referral invite links are public by design (code-gated handlers).
    'api/referral.routes.js::/validate/:code', 'api/referral.routes.js::/click',
    'api/referral.routes.js::/resolve', 'api/referral.routes.js::/:code',
    'api/referral.routes.js::/leaderboard', 'api/referral.routes.js::/rewards',
    // OTA manifest reads are public; writes are admin-gated in the handler.
    'api/ota.routes.js::/info', 'api/ota.routes.js::/version',
    // Telegram bot endpoints are verified by bot token inside the handler.
    'api/telegram.routes.js::/webhook', 'api/telegram.routes.js::/status',
    'routes/telegram.routes.js::/webhook', 'routes/telegram.routes.js::/status',
    // OTA deploy is authenticated inside the handler against
    // OTA_DEPLOY_TOKEN and fails closed when that env var is unset
    // (covered behaviorally below).
    'api/ota.routes.js::/deploy-ota',
    // User data-centre downloads are scoped by an unguessable token.
    'api/user.routes.js::/data-centre/download/:token',
]);

    for (const { full, rel } of files) {
        it(`${rel}: every route requires auth unless public by design`, () => {
            const src = readFileSync(full, 'utf8');
            const fileLevel = hasFileLevelAuth(src);
            const unprotected = [];

            for (const route of routesOf(src)) {
                if (AUTH_PATTERN.test(route.middleware)) continue;
                if (fileLevel) continue;
                if (PUBLIC_BY_DESIGN.has(`${rel}::${route.path}`)) continue;
                if (PUBLIC_BY_DESIGN2.has(`${rel}::${route.path}`)) continue;
                unprotected.push(`${route.method} ${route.path}`);
            }

            assert.deepEqual(
                unprotected,
                [],
                `${rel} has routes with no auth middleware — add authMiddleware or list them as public by design`
            );
        });
    }

    it('finds the route files', () => {
        assert.ok(files.length >= 40, `expected the full route surface, got ${files.length}`);
    });

    // The one public-by-design route with money/security semantics gets
    // behavioral coverage, not just an allow-list entry.
    it('ota deploy: inline token check fails closed', async () => {
        const otaRouter = require('../backend/routes/api/ota.routes');
        const layer = otaRouter.stack.find(
            (l) => l.route && l.route.path === '/deploy-ota'
                && Object.keys(l.route.methods)[0].toUpperCase() === 'POST'
        );
        const handler = layer.route.stack[layer.route.stack.length - 1].handle;

        const res = () => ({
            statusCode: 200, body: null,
            status(code) { this.statusCode = code; return this; },
            json(payload) { this.body = payload; return this; }
        });

        // 1. No token configured on the server → 503 (fail closed).
        const saved = process.env.OTA_DEPLOY_TOKEN;
        delete process.env.OTA_DEPLOY_TOKEN;
        let r = res();
        await handler({ headers: { authorization: 'Bearer anything' }, body: {} }, r);
        assert.equal(r.statusCode, 503);

        // 2. Token configured: missing header → 401.
        process.env.OTA_DEPLOY_TOKEN = 'deploy-secret';
        r = res();
        await handler({ headers: {}, body: {} }, r);
        assert.equal(r.statusCode, 401);

        // 3. Wrong token → 401.
        r = res();
        await handler({ headers: { authorization: 'Bearer nope' }, body: {} }, r);
        assert.equal(r.statusCode, 401);

        // 4. Correct token, incomplete payload → 400 (never reaches the DB).
        r = res();
        await handler({ headers: { authorization: 'Bearer deploy-secret' }, body: { version: '1' } }, r);
        assert.equal(r.statusCode, 400);

        if (saved === undefined) delete process.env.OTA_DEPLOY_TOKEN;
        else process.env.OTA_DEPLOY_TOKEN = saved;
    });
});