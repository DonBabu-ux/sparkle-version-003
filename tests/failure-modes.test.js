// tests/failure-modes.test.js
// Failure-path coverage: what the app does when the database, the network, a
// transaction or an external provider fails. Two halves:
//   - real modules driven with fake infrastructure (circuit breaker, auth
//     middleware, transaction rollback, the shared error-shape helpers)
//   - repo-wide source contracts that keep the fixes from regressing
//     (no 5xx response echoes a driver message; docs teach the safe pattern)
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');
const jwt = require('jsonwebtoken');

const ROOT = join(__dirname, '..');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-failure-modes';
// Point the real pool at a closed port BEFORE the module is required so the
// circuit-breaker suite observes genuine network failures (no local MySQL
// exists here, and config/database pins DB_HOST at require time).
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '3306';

const db = require('../backend/config/database');
const { serverError, statusError, apiError, clientError } = require('../backend/utils/serverError');
const { respondTokenRefreshError } = require('../backend/utils/authErrors');
const { socketAuthErrorMessage } = require('../backend/utils/socketAuthError');
const { authMiddleware } = require('../backend/middleware/auth.middleware');

const mockRes = () => ({
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
});

const networkError = () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:3306');
    err.code = 'ECONNREFUSED';
    return err;
};
const aggregateNetworkError = () =>
    new AggregateError([networkError()], 'connect ECONNREFUSED 127.0.0.1:3306');

// ── error classification ────────────────────────────────────────────────────

describe('isDatabaseUnavailableError — outage vs domain failure', () => {
    it('treats network-level failures as an outage', () => {
        assert.equal(db.isDatabaseUnavailableError(networkError()), true);
        assert.equal(db.isDatabaseUnavailableError(aggregateNetworkError()), true);
        const lost = new Error('Connection lost'); lost.code = 'PROTOCOL_CONNECTION_LOST';
        assert.equal(db.isDatabaseUnavailableError(lost), true);
        const dns = new Error('getaddrinfo ENOTFOUND mysql-lilbee.alwaysdata.net'); dns.code = 'ENOTFOUND';
        assert.equal(db.isDatabaseUnavailableError(dns), true);
        const tooMany = new Error('ER_TOO_MANY_USER_CONNECTIONS'); tooMany.errno = 1203;
        assert.equal(db.isDatabaseUnavailableError(tooMany), true);
    });

    it('does not treat SQL/domain errors as an outage', () => {
        const dup = new Error("Duplicate entry 'a@b.c' for key 'users.email'"); dup.code = 'ER_DUP_ENTRY';
        assert.equal(db.isDatabaseUnavailableError(dup), false, 'a unique violation is not an outage');
        const missing = new Error("Unknown column 'x'"); missing.code = 'ER_BAD_FIELD_ERROR';
        assert.equal(db.isDatabaseUnavailableError(missing), false);
        assert.equal(db.isDatabaseUnavailableError(null), false);
        assert.equal(db.isDatabaseUnavailableError(new Error('boom')), false);
    });

    it('classifies connection-limit errors separately', () => {
        const tooMany = new Error('ER_TOO_MANY_USER_CONNECTIONS'); tooMany.errno = 1203;
        assert.equal(db.isConnectionLimitError(tooMany), true);
        const verbose = new Error('User X already has more than max_user_connections');
        assert.equal(db.isConnectionLimitError(verbose), true);
        assert.equal(db.isConnectionLimitError(new Error('boom')), false);
    });
});

// ── circuit breaker ─────────────────────────────────────────────────────────

describe('DB circuit breaker — fail fast instead of hanging', () => {
    it('opens after consecutive network failures and answers 503 fast', async () => {
        assert.equal(db.getCircuitStatus().open, false, 'fresh process starts closed');

        for (let i = 0; i < 3; i++) {
            await assert.rejects(
                () => db.query('SELECT 1'),
                (err) => db.isDatabaseUnavailableError(err),
                `failure ${i + 1} is a network failure`
            );
        }

        const status = db.getCircuitStatus();
        assert.equal(status.open, true, 'breaker is open after the threshold');
        assert.equal(typeof status.threshold, 'number');

        const t0 = Date.now();
        await assert.rejects(
            () => db.query('SELECT 1'),
            (err) => err.code === 'DB_UNAVAILABLE' && err.status === 503,
            'open breaker fails fast with DB_UNAVAILABLE'
        );
        assert.ok(Date.now() - t0 < 1000, 'fail-fast, not a 20s connectTimeout hang');
    });

    it('the fail-fast error itself is generic (no internals in the message)', async () => {
        try {
            await db.query('SELECT 1');
            assert.fail('expected a rejection');
        } catch (err) {
            assert.equal(err.code, 'DB_UNAVAILABLE');
            assert.equal(err.message, 'Database temporarily unavailable. Please retry in a moment.');
        }
    });
});

// ── error response shapes ──────────────────────────────────────────────────

describe('shared error helpers — fixed messages, full logs', () => {
    const driver = new Error("Table 'sparkle.users' doesn't exist");

    it('serverError/statusError/apiError never echo the driver message', () => {
        for (const fn of [serverError, statusError, apiError]) {
            const res = mockRes();
            fn(res, driver);
            assert.equal(res.statusCode, 500);
            assert.equal(res.body.error, 'Something went wrong. Please try again.');
            assert.ok(!JSON.stringify(res.body).includes("sparkle.users"), 'no schema in the body');
        }
    });

    it('statusError/apiError keep their response envelope', () => {
        const a = mockRes(); statusError(a, driver);
        assert.equal(a.body.status, 'error');
        const b = mockRes(); apiError(b, driver);
        assert.equal(b.body.success, false);
    });

    it('clientError echoes only operational (user-caused) reasons', () => {
        const operational = new Error('You cannot block yourself'); operational.isOperational = true;
        const ok = mockRes(); clientError(ok, operational, 'fallback');
        assert.equal(ok.body.error, 'You cannot block yourself');

        const notOperational = new Error("Unknown column 'x' in 'where clause'");
        const res = mockRes(); clientError(res, notOperational, 'fallback');
        assert.equal(res.body.error, 'fallback', 'unmapped errors fall back');
    });

    it('honours a caller-supplied status for clientError (400/409)', () => {
        const operational = new Error('Already following'); operational.isOperational = true;
        const res = mockRes(); clientError(res, operational, 'fallback', 409);
        assert.equal(res.statusCode, 409);
    });
});

describe('token-refresh + socket auth failures keep a DB blip from logging users out', () => {
    it('maps a DB outage to 503 with a stable code', () => {
        const res = mockRes();
        respondTokenRefreshError(res, aggregateNetworkError());
        assert.equal(res.statusCode, 503);
        assert.equal(res.body.code, 'DATABASE_TEMPORARILY_UNAVAILABLE');
    });

    it('maps a dead refresh token to 401 and an unknown fault to a generic 500', () => {
        const dead = mockRes();
        respondTokenRefreshError(dead, new Error('Invalid or expired refresh token'));
        assert.equal(dead.statusCode, 401);

        const unknown = mockRes();
        respondTokenRefreshError(unknown, new Error("Unknown column 'x'"));
        assert.equal(unknown.statusCode, 500);
        assert.equal(unknown.body.message, 'Internal error refreshing session');
    });

    it('keeps a DB blip from masquerading as an invalid socket token', () => {
        assert.equal(socketAuthErrorMessage(networkError()), 'ServiceUnavailable');
        const expired = new Error('jwt expired'); expired.name = 'TokenExpiredError';
        assert.equal(socketAuthErrorMessage(expired), 'Token expired');
        assert.equal(socketAuthErrorMessage(new Error('invalid signature')), 'Invalid token');
    });
});

// ── background jobs under total failure ─────────────────────────────────────

describe('media health job — total DB outage is surfaced, not swallowed', () => {
    it('rejects with the availability error so the cron wrapper can log and continue', async () => {
        const { runHealthCheck } = require('../backend/jobs/media-health.job');
        const originalQuery = db.query;
        db.query = async () => { throw aggregateNetworkError(); };
        const realFetch = globalThis.fetch;
        globalThis.fetch = async () => { throw new Error('offline'); };
        try {
            await assert.rejects(
                () => runHealthCheck(),
                (err) => db.isDatabaseUnavailableError(err),
                'the job surfaces the outage instead of pretending it probed'
            );
        } finally {
            db.query = originalQuery;
            globalThis.fetch = realFetch;
        }
    });

    it('the cron wrapper catches it, so a failing sweep never kills the server', () => {
        const src = readFileSync(join(ROOT, 'backend/jobs/media-health.job.js'), 'utf8');
        assert.match(src, /cron\.schedule\('30 \* \* \* \*', async \(\) => \{[\s\S]*?try \{[\s\S]*?await runHealthCheck\(\);[\s\S]*?\} catch/);
    });
});

describe('auth middleware — failure responses', () => {
    it('401s when no token is provided', async () => {
        const res = mockRes();
        await authMiddleware({ headers: {}, cookies: {} }, res, () => {});
        assert.equal(res.statusCode, 401);
        assert.match(res.body.error, /No token provided/i);
    });

    it('401s on a malformed/expired token without touching the DB', async () => {
        const res = mockRes();
        await authMiddleware({ headers: { authorization: 'Bearer not-a-real-jwt' }, cookies: {} }, res, () => {});
        assert.equal(res.statusCode, 401);
        assert.match(res.body.error, /Invalid or expired/i);
    });

    it('answers 503 (not 401) when the user lookup fails on a DB outage', async () => {
        const original = db.query;
        db.query = async () => { throw aggregateNetworkError(); };
        try {
            const res = mockRes();
            const token = jwt.sign({ id: 'user-1' }, process.env.JWT_SECRET);
            await authMiddleware({ headers: { authorization: `Bearer ${token}` }, cookies: {} }, res, () => {});
            assert.equal(res.statusCode, 503, 'a valid session must survive a DB blip');
            assert.equal(res.body.code, 'DATABASE_TEMPORARILY_UNAVAILABLE');
        } finally {
            db.query = original;
        }
    });

    it('optional auth continues anonymously on a malformed token (never 401s)', async () => {
        const { optionalAuthMiddleware } = require('../backend/middleware/auth.middleware');
        let nextCalled = false;
        const res = mockRes();
        await optionalAuthMiddleware(
            { headers: { authorization: 'Bearer not-a-real-jwt' }, cookies: {} },
            res,
            () => { nextCalled = true; }
        );
        assert.equal(nextCalled, true, 'an unauthenticated viewer is not a failure');
        assert.notEqual(res.statusCode, 401);
    });
});

// ── transaction rollback ────────────────────────────────────────────────────

describe('createMoment — a failing insert rolls back and answers generically', () => {
    it('rolls back and returns the generic 500 when the INSERT rejects', async () => {
        const moments = require('../backend/controllers/moments.controller');
        const originalQuery = db.query;
        const originalGetConnection = db.getConnection;

        let rolledBack = false;
        const conn = {
            async beginTransaction() {},
            async commit() { assert.fail('must not commit a failed transaction'); },
            async release() {},
            async rollback() { rolledBack = true; },
            async query(sql) {
                if (String(sql).includes('INSERT INTO moments')) {
                    throw new Error("Table 'sparkle.moments' doesn't exist");
                }
                return [[], []];
            }
        };
        db.query = async () => [[], []];
        db.getConnection = async () => conn;

        const realFetch = globalThis.fetch;
        globalThis.fetch = async () => ({ status: 200, headers: { get: (k) => (k === 'content-length' ? '2048' : 'video/mp4') } });

        try {
            const res = mockRes();
            await moments.createMoment(
                { body: { media_url: 'https://cdn/reel.mp4', caption: 'reel' }, user: { user_id: 'author-1' } },
                res
            );
            assert.equal(rolledBack, true, 'transaction rolled back');
            assert.equal(res.statusCode, 500);
            assert.equal(res.body.error, 'Something went wrong. Please try again.');
            assert.ok(!JSON.stringify(res.body).includes('moments'), 'no schema in the body');
        } finally {
            db.query = originalQuery;
            db.getConnection = originalGetConnection;
            globalThis.fetch = realFetch;
        }
    });
});

// ── repo-wide contracts ─────────────────────────────────────────────────────

const walkJs = (dir) => readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return entry === 'node_modules' ? [] : walkJs(full);
    return entry.endsWith('.js') ? [full] : [];
});

const stripComments = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join('\n');

describe('repo-wide failure contracts', () => {
    it('no 5xx response echoes a driver message to the client', () => {
        const offenders = [];
        for (const file of walkJs(join(ROOT, 'backend'))) {
            const src = stripComments(readFileSync(file, 'utf8'));
            // A dynamic value follows `error:`/`message:` after the whitespace. The
            // lookahead must swallow the whitespace too, or it tests the space
            // itself and every static message matches.
            const leak = /res\s*\.\s*status\(\s*5\d{2}\s*\)\s*\.\s*json\(\s*\{[^{}]*?(error|message):\s*(?!\s*['"`])/;
            if (leak.test(src)) offenders.push(file.slice(ROOT.length + 1));
        }
        assert.deepEqual(offenders, [], `5xx responses must answer a fixed message: ${offenders.join(', ')}`);
    });

    it('docs teach the safe 500 pattern, not the leaking one', () => {
        const doc = readFileSync(join(ROOT, 'docs/agent.md'), 'utf8');
        assert.ok(
            !doc.includes('res.status(500).json({ error: error.message })'),
            'the driver-message echo must not be taught as the canonical pattern'
        );
        assert.ok(doc.includes("res.status(500).json({ error: 'Something went wrong. Please try again.' })"));
    });
});