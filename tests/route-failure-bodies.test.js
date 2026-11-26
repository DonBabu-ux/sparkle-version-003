// tests/route-failure-bodies.test.js
// Failure-path behavior for the marketplace / boost / support / AI surfaces:
// a database fault must answer a FIXED message (never a SQL fragment), and
// support tickets must be scoped to their owner. Real handlers driven by a
// fake pool.query and a mock res — no live DB, no live providers.
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-route-failures';

const pool = require('../backend/config/database');
const marketplace = require('../backend/controllers/marketplace.controller');
const boost = require('../backend/controllers/boost.controller');
const supportRouter = require('../backend/routes/api/support.routes');

const SQL_ERROR = "Table 'sparkle.media_registry' doesn't exist";
const sqlFailure = () => {
    const err = new Error(SQL_ERROR);
    err.code = 'ER_NO_SUCH_TABLE';
    return err;
};

const mockRes = () => ({
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
});

const installFakePool = (impl) => {
    const original = pool.query;
    pool.query = async (sql, params = []) => impl(String(sql).replace(/\s+/g, ' ').trim(), params);
    return { restore: () => { pool.query = original; } };
};

// Some handlers are exported as [validate, handler] arrays (the route spreads
// them); the terminal function is the one under test.
const terminal = (fn) => (Array.isArray(fn) ? fn[fn.length - 1] : fn);

const reqFor = (over = {}) => ({
    body: {}, params: {}, query: {}, headers: {}, cookies: {},
    user: { user_id: 'user-1', username: 'buyer', name: 'Buyer', email: 'b@x.co' },
    ...over,
});

const assertNoLeak = (res, label) => {
    const serialized = JSON.stringify(res.body || {});
    assert.ok(!serialized.includes(SQL_ERROR), `${label}: response must not echo the driver message`);
    assert.ok(!serialized.includes('ER_NO_SUCH_TABLE'), `${label}: response must not echo the driver code`);
};

describe('marketplace handlers — DB failures answer fixed messages', () => {
    let fake;
    beforeEach(() => {
        fake = installFakePool(() => { throw sqlFailure(); });
    });
    afterEach(() => fake.restore());

    it('createListing', async () => {
        const res = mockRes();
        await terminal(marketplace.createListing)(reqFor({ body: { title: 'X', price: 10 } }), res);
        assert.equal(res.statusCode, 500);
        assert.equal(res.body.success, false);
        assert.equal(typeof res.body.message, 'string');
        assert.notEqual(res.body.message, '');
        assertNoLeak(res, 'createListing');
    });

    it('deleteListing', async () => {
        const res = mockRes();
        await terminal(marketplace.deleteListing)(reqFor({ params: { id: 'listing-1' } }), res);
        assert.equal(res.statusCode, 500);
        assertNoLeak(res, 'deleteListing');
    });

    it('toggleFavorite', async () => {
        const res = mockRes();
        await terminal(marketplace.toggleFavorite)(reqFor({ params: { id: 'listing-1' } }), res);
        assert.equal(res.statusCode, 500);
        assertNoLeak(res, 'toggleFavorite');
    });

    it('toggleSellerFavorite', async () => {
        const res = mockRes();
        await terminal(marketplace.toggleSellerFavorite)(reqFor({ body: { sellerId: 'seller-1' } }), res);
        assert.equal(res.statusCode, 500);
        assertNoLeak(res, 'toggleSellerFavorite');
    });
});

describe('boost handlers — operational vs server fault', () => {
    it('calculateBoost is a pure path: 400 with the validation reason on bad input', async () => {
        const fake = installFakePool(() => [[], []]);
        try {
            const res = mockRes();
            await boost.calculateBoost(reqFor({ body: { budgetKes: 1, durationDays: 5 } }), res);
            assert.equal(res.statusCode, 400);
            assert.match(res.body.message, /Minimum boost budget/);
        } finally {
            fake.restore();
        }
    });

    it('calculateBoost returns the projection on valid input', async () => {
        const res = mockRes();
        await boost.calculateBoost(reqFor({ body: { budgetKes: 500, durationDays: 5 } }), res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.success, true);
        assert.ok(res.body.calculation);
    });

    it('activateBoost 500s with a fixed message on a DB fault (not a 400 echo)', async () => {
        const fake = installFakePool(() => { throw sqlFailure(); });
        try {
            const res = mockRes();
            await boost.activateBoost(reqFor({ body: { budgetKes: 500, durationDays: 5 } }), res);
            assert.equal(res.statusCode, 500);
            assertNoLeak(res, 'activateBoost');
        } finally {
            fake.restore();
        }
    });

    it('renewBoost 500s with a fixed message on a DB fault (not a 400 echo)', async () => {
        const fake = installFakePool(() => { throw sqlFailure(); });
        try {
            const res = mockRes();
            await boost.renewBoost(reqFor({ body: { boostId: 'b1', budgetKes: 500, durationDays: 5 } }), res);
            assert.equal(res.statusCode, 500);
            assertNoLeak(res, 'renewBoost');
        } finally {
            fake.restore();
        }
    });

    it('activateBoost 401s without a session', async () => {
        const res = mockRes();
        await boost.activateBoost(reqFor({ user: undefined, body: { budgetKes: 500, durationDays: 5 } }), res);
        assert.equal(res.statusCode, 401);
    });
});

describe('support tickets — scoped to the owner', () => {
    let fake;
    const routeHandler = (router, method, path) => {
        const layer = router.stack.find(
            (l) => l.route && l.route.path === path
                && Object.keys(l.route.methods)[0].toUpperCase() === method.toUpperCase()
        );
        return layer.route.stack[layer.route.stack.length - 1].handle;
    };

    const OWNER_ROW = { ticket_id: 't-1', user_id: 'user-1' };
    const TICKET_ROW = {
        ticket_id: 't-1', user_id: 'user-1', subject: 'Help', category: 'account',
        status: 'open', message: '{"description":"Cannot login"}', created_at: '2026-11-01T00:00:00Z',
    };

    beforeEach(() => {
        fake = installFakePool((text, params) => {
            if (text.includes('FROM support_requests')) {
                if (text.includes('user_id = ?')) {
                    // Emulate the ownership predicate: only the owner matches.
                    return [params.includes('user-1') ? [TICKET_ROW] : []];
                }
                if (text.includes('user_id IS NULL')) return [[]]; // this store has no anonymous tickets
                return [[TICKET_ROW]]; // admin scope
            }
            if (text.startsWith('INSERT INTO support_ticket_messages')) return [{ insertId: 1 }, []];
            if (text.startsWith('UPDATE support_requests')) return [{ affectedRows: 1 }, []];
            return [[], []];
        });
    });
    afterEach(() => fake.restore());

    it('404s a ticket belonging to someone else', async () => {
        const res = mockRes();
        await routeHandler(supportRouter, 'GET', '/tickets/:ticketId')(
            { params: { ticketId: 't-1' }, user: { user_id: 'attacker' } }, res
        );
        assert.equal(res.statusCode, 404);
    });

    it('200s the owner their own ticket', async () => {
        const res = mockRes();
        await routeHandler(supportRouter, 'GET', '/tickets/:ticketId')(
            { params: { ticketId: 't-1' }, user: { user_id: 'user-1' } }, res
        );
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.ticket.ticket_id, 't-1');
    });

    it('404s an authenticated attacker posing as anonymous against a user-owned ticket', async () => {
        const res = mockRes();
        await routeHandler(supportRouter, 'GET', '/tickets/:ticketId')(
            { params: { ticketId: 't-1' } }, res
        );
        // No requester id: the handler scopes to `user_id IS NULL`, and the
        // emulated store only has a user-owned ticket.
        assert.equal(res.statusCode, 404);
    });

    it('200s an anonymous reader for their own anonymous ticket', async () => {
        // Switch the store so the ticket has no owner.
        fake.restore();
        fake = installFakePool((text) => {
            if (text.includes('user_id IS NULL')) {
                return [[{ ...TICKET_ROW, user_id: null }]];
            }
            return [[], []];
        });
        const res = mockRes();
        await routeHandler(supportRouter, 'GET', '/tickets/:ticketId')(
            { params: { ticketId: 't-1' } }, res
        );
        assert.equal(res.statusCode, 200);
    });

    it('lets an admin read any ticket', async () => {
        const res = mockRes();
        await routeHandler(supportRouter, 'GET', '/tickets/:ticketId')(
            { params: { ticketId: 't-1' }, user: { user_id: 'admin-1', role: 'admin' } }, res
        );
        assert.equal(res.statusCode, 200);
    });

    it('refuses to post a reply to someone else\u2019s ticket', async () => {
        const res = mockRes();
        await routeHandler(supportRouter, 'POST', '/tickets/:ticketId/messages')(
            { params: { ticketId: 't-1' }, body: { message: 'I am not the owner' }, user: { user_id: 'attacker', username: 'attacker' } },
            res
        );
        assert.equal(res.statusCode, 404);
    });

    it('posts a reply to your own ticket', async () => {
        const res = mockRes();
        await routeHandler(supportRouter, 'POST', '/tickets/:ticketId/messages')(
            { params: { ticketId: 't-1' }, body: { message: 'Still broken' }, user: { user_id: 'user-1', username: 'buyer' } },
            res
        );
        assert.equal(res.statusCode, 201);
        assert.equal(OWNER_ROW.user_id, 'user-1');
    });
});