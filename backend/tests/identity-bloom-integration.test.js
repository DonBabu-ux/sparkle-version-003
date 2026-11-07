'use strict';

require('dotenv').config();

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

const RUN_ID = `${Date.now()}${crypto.randomBytes(3).toString('hex')}`;
const TEST_VERSION = `itest${RUN_ID}`;
const TEST_SECRET = `integration-secret-${RUN_ID}-long-enough-for-hmac`;
const TEST_USERNAME = `itest_${RUN_ID}`;
const TEST_EMAIL = `itest_${RUN_ID}@sparkle.test`;

process.env.SPARKLE_IDENTITY_BLOOM_HMAC_SECRET = TEST_SECRET;
process.env.SPARKLE_IDENTITY_BLOOM_VERSION = TEST_VERSION;
process.env.SPARKLE_IDENTITY_BLOOM_TIMEOUT_MS = process.env.SPARKLE_IDENTITY_BLOOM_TIMEOUT_MS || '5000';

const pool = require('../config/database');
const identity = require('../utils/identity/identity');
const config = require('../services/identityBloom/config');
const filterStore = require('../services/identityBloom/filterStore');
const redisClient = require('../services/identityBloom/redisClient');
const identityLookup = require('../services/identityBloom/identityLookup');
const outbox = require('../services/identityBloom/outbox');
const identitySync = require('../services/identityBloom/identitySync');
const { transaction } = require('../utils/database/transaction');

const createdUserIds = [];

async function ensureOutboxTable() {
    await require('../migrations/20261107_create_identity_bloom_outbox')();
}

async function insertTestUser(overrides = {}) {
    const userId = crypto.randomUUID();
    const username = overrides.username || `${TEST_USERNAME}_${crypto.randomBytes(2).toString('hex')}`;
    const email = overrides.email || `${TEST_USERNAME}_${crypto.randomBytes(3).toString('hex')}@sparkle.test`;
    await pool.query(
        `INSERT INTO users (user_id, name, username, email, password_hash, email_verified, account_status, onboarding_step)
         VALUES (?, ?, ?, ?, 'integration-test-hash', ?, 'active', 0)`,
        [userId, 'Integration Test', username, email, overrides.emailVerified === false ? 0 : 1]
    );
    createdUserIds.push(userId);
    return { userId, username, email };
}

async function syncUserToBloom(user) {
    await filterStore.insertIdentity('username', identity.createIdentityHmac('username', user.username));
    await filterStore.insertIdentity('email', identity.createIdentityHmac('email', user.email));
    return user;
}

async function cleanup() {
    if (createdUserIds.length > 0) {
        await pool.query('DELETE FROM users WHERE user_id IN (?)', [createdUserIds]).catch(() => {});
        await pool.query('DELETE FROM identity_bloom_outbox WHERE entity_id IN (?)', [createdUserIds]).catch(() => {});
    }
    await pool.query('DELETE FROM identity_bloom_outbox WHERE entity_id LIKE ?', [`%${RUN_ID}%`]).catch(() => {});
    for (const identityType of ['username', 'email']) {
        await redisClient.del([
            config.filterBitsKey(identityType, TEST_VERSION),
            config.filterReadyKey(identityType, TEST_VERSION),
            config.filterMetaKey(identityType, TEST_VERSION)
        ], 10000).catch(() => {});
        await redisClient.del([config.pendingKey(identityType)], 10000).catch(() => {});
    }
    await redisClient.del([config.activeVersionKey()], 10000).catch(() => {});
}

test.before(async () => {
    await ensureOutboxTable();
    for (const identityType of ['username', 'email']) {
        await filterStore.preallocateFilter(identityType, TEST_VERSION);
        await filterStore.setFilterReady(identityType, TEST_VERSION, { sourceCount: 0, durationMs: 0 });
    }
    await filterStore.switchActiveVersion({ username: TEST_VERSION, email: TEST_VERSION });
});

test.after(async () => {
    await cleanup();
    await pool.end().catch(() => {});
});

test('redis is reachable and the bloom probe script honours its argument layout', async () => {
    const value = `probe_${RUN_ID}`;
    const before = await filterStore.probeIdentity('username', value);
    assert.strictEqual(before.state, filterStore.PROBE_STATE.ABSENT);

    const hmac = identity.createIdentityHmac('username', value);
    await filterStore.insertIdentity('username', hmac);

    const after = await filterStore.probeIdentity('username', value);
    assert.strictEqual(after.state, filterStore.PROBE_STATE.PRESENT);
});

test('username and email filters are independent', async () => {
    const value = `independent_${RUN_ID}`;
    await filterStore.insertIdentity('username', identity.createIdentityHmac('username', value));

    assert.strictEqual((await filterStore.probeIdentity('username', value)).state, filterStore.PROBE_STATE.PRESENT);
    assert.strictEqual((await filterStore.probeIdentity('email', value)).state, filterStore.PROBE_STATE.ABSENT);
});

test('a pending outbox identity is never reported as definitely absent', async () => {
    const value = `pending_${RUN_ID}`;
    const hmac = identity.createIdentityHmac('email', value);
    await filterStore.markPending('email', hmac);

    const probe = await filterStore.probeIdentity('email', value);
    assert.strictEqual(probe.state, filterStore.PROBE_STATE.PENDING);

    await filterStore.insertIdentity('email', hmac);
    assert.strictEqual((await filterStore.probeIdentity('email', value)).state, filterStore.PROBE_STATE.PRESENT);
});

test('reserving an identity makes it present for later lookups', async () => {
    const value = `reserved_${RUN_ID}`;
    const first = await filterStore.probeIdentity('username', value, { reserve: true });
    assert.strictEqual(first.state, filterStore.PROBE_STATE.ABSENT);
    assert.strictEqual(first.reserved, true);
    assert.strictEqual((await filterStore.probeIdentity('username', value)).state, filterStore.PROBE_STATE.PRESENT);
});

test('an uninitialised filter is reported as not ready instead of absent', async () => {
    const versions = await filterStore.resolveActiveVersions(true);
    const previous = versions.username;
    await filterStore.switchActiveVersion({
        username: `${TEST_VERSION}_missing`,
        email: `${TEST_VERSION}_missing`
    });
    const probe = await filterStore.probeIdentity('username', `missing_${RUN_ID}`);
    assert.strictEqual(probe.state, filterStore.PROBE_STATE.NOT_READY);
    await filterStore.switchActiveVersion({ username: previous, email: previous });
});

test('a filter built with a different HMAC secret is rejected', async () => {
    const previousSecret = process.env.SPARKLE_IDENTITY_BLOOM_HMAC_SECRET;
    process.env.SPARKLE_IDENTITY_BLOOM_HMAC_SECRET = `${TEST_SECRET}-rotated`;
    const probe = await filterStore.probeIdentity('username', `rotated_${RUN_ID}`);
    assert.strictEqual(probe.state, filterStore.PROBE_STATE.HMAC_MISMATCH);
    process.env.SPARKLE_IDENTITY_BLOOM_HMAC_SECRET = previousSecret;
});

test('a user row and its outbox events commit atomically', async () => {
    const user = await insertTestUser();
    const events = outbox.buildIdentityEvents({
        entityType: 'user',
        entityId: user.userId,
        identities: [
            { identityType: 'username', value: user.username },
            { identityType: 'email', value: user.email }
        ]
    });

    await transaction(async (conn) => {
        await conn.execute('UPDATE users SET bio = ? WHERE user_id = ?', ['atomic-commit', user.userId]);
        await outbox.enqueueIdentityEvents(conn, events);
    });

    const [rows] = await pool.query('SELECT identity_type, identity_hmac, status FROM identity_bloom_outbox WHERE entity_id = ?', [user.userId]);
    assert.strictEqual(rows.length, 2);
    assert.deepStrictEqual(rows.map((r) => r.identity_type).sort(), ['email', 'username']);
    for (const row of rows) {
        assert.strictEqual(row.status, outbox.STATUS.PENDING);
        assert.match(row.identity_hmac, /^[0-9a-f]{64}$/);
    }
});

test('a rolled back transaction removes the user row and the outbox events together', async () => {
    const userId = crypto.randomUUID();
    const username = `${TEST_USERNAME}_rb${crypto.randomBytes(2).toString('hex')}`;
    const email = `${TEST_USERNAME}_rb${crypto.randomBytes(3).toString('hex')}@sparkle.test`;
    const events = outbox.buildIdentityEvents({
        entityType: 'user',
        entityId: userId,
        identities: [
            { identityType: 'username', value: username },
            { identityType: 'email', value: email }
        ]
    });

    try {
        await transaction(async (conn) => {
            await conn.execute(
                `INSERT INTO users (user_id, name, username, email, password_hash, email_verified, account_status)
                 VALUES (?, 'Rollback Test', ?, ?, 'hash', 0, 'active')`,
                [userId, username, email]
            );
            await outbox.enqueueIdentityEvents(conn, events);
            throw new Error('forced rollback');
        });
        assert.fail('transaction should have rolled back');
    } catch (error) {
        assert.strictEqual(error.message, 'forced rollback');
    }

    const [users] = await pool.query('SELECT user_id FROM users WHERE user_id = ?', [userId]);
    const [events2] = await pool.query('SELECT outbox_id FROM identity_bloom_outbox WHERE entity_id = ?', [userId]);
    assert.strictEqual(users.length, 0);
    assert.strictEqual(events2.length, 0);
});

test('the worker claims pending events, applies them and marks them processed', async () => {
    const user = await insertTestUser();
    const events = outbox.buildIdentityEvents({
        entityType: 'user',
        entityId: user.userId,
        identities: [
            { identityType: 'username', value: user.username },
            { identityType: 'email', value: user.email }
        ]
    });
    await transaction(async (conn) => {
        await outbox.enqueueIdentityEvents(conn, events);
    });

    const claimed = await outbox.claimPendingEvents('worker-a', 50);
    assert.ok(claimed.length >= 2);

    for (const event of claimed) {
        await filterStore.insertIdentity(event.identity_type, event.identity_hmac);
        await outbox.markProcessed(event.outbox_id);
    }

    const [rows] = await pool.query('SELECT status FROM identity_bloom_outbox WHERE entity_id = ?', [user.userId]);
    assert.ok(rows.length >= 2);
    assert.ok(rows.every((row) => row.status === outbox.STATUS.PROCESSED));
});

test('reprocessing an already applied event is idempotent', async () => {
    const value = `idempotent_${RUN_ID}`;
    const hmac = identity.createIdentityHmac('email', value);

    await filterStore.insertIdentity('email', hmac);
    const first = await filterStore.probeIdentity('email', value);
    await filterStore.insertIdentity('email', hmac);
    const second = await filterStore.probeIdentity('email', value);

    assert.strictEqual(first.state, filterStore.PROBE_STATE.PRESENT);
    assert.strictEqual(second.state, filterStore.PROBE_STATE.PRESENT);
});

test('two workers never claim the same event', async () => {
    const user = await insertTestUser();
    const events = outbox.buildIdentityEvents({
        entityType: 'user',
        entityId: user.userId,
        identities: [
            { identityType: 'username', value: user.username },
            { identityType: 'email', value: user.email }
        ]
    });
    await transaction(async (conn) => {
        await outbox.enqueueIdentityEvents(conn, events);
    });

    const [first, second] = await Promise.all([
        outbox.claimPendingEvents('worker-x', 50),
        outbox.claimPendingEvents('worker-y', 50)
    ]);
    const firstIds = new Set(first.map((e) => e.outbox_id));
    const secondIds = new Set(second.map((e) => e.outbox_id));
    for (const id of firstIds) {
        assert.ok(!secondIds.has(id), 'an event was claimed by two workers');
    }

    for (const event of [...first, ...second]) {
        await outbox.markProcessed(event.outbox_id);
    }
});

test('an unverified account still reserves its email address', async () => {
    const user = await insertTestUser({ emailVerified: false });
    await syncUserToBloom(user);
    const result = await identityLookup.checkIdentity('email', user.email);
    assert.strictEqual(result.taken, true);
    assert.strictEqual(result.source, 'bloom+mysql');
});

test('a verified account reserves its email address', async () => {
    const user = await insertTestUser({ emailVerified: true });
    await syncUserToBloom(user);
    const result = await identityLookup.checkIdentity('email', user.email);
    assert.strictEqual(result.taken, true);
});

test('a non existent email is reported as available', async () => {
    const result = await identityLookup.checkIdentity('email', `free_${RUN_ID}@sparkle.test`);
    assert.strictEqual(result.taken, false);
});

test('a pending outbox event prevents a false negative after the database commit', async () => {
    const user = await insertTestUser();
    const hmac = identity.createIdentityHmac('email', user.email);
    await identitySync.markIdentitiesPending([{ identityType: 'email', value: user.email }]);

    const result = await identityLookup.checkIdentity('email', user.email);
    assert.strictEqual(result.taken, true);
    assert.notStrictEqual(result.source, 'bloom');
    await filterStore.insertIdentity('email', hmac);
});

test('mysql rejects a duplicate username and a duplicate email', async () => {
    const user = await insertTestUser();
    let duplicateUsername = null;
    let duplicateEmail = null;

    try {
        await pool.query(
            `INSERT INTO users (user_id, name, username, email, password_hash) VALUES (?, 'Dup', ?, ?, 'hash')`,
            [crypto.randomUUID(), user.username, `dup_${RUN_ID}@sparkle.test`]
        );
    } catch (error) {
        duplicateUsername = error;
    }
    try {
        await pool.query(
            `INSERT INTO users (user_id, name, username, email, password_hash) VALUES (?, 'Dup', ?, ?, 'hash')`,
            [crypto.randomUUID(), `dup_${RUN_ID}`, user.email]
        );
    } catch (error) {
        duplicateEmail = error;
    }

    assert.ok(duplicateUsername, 'duplicate username must be rejected');
    assert.strictEqual(duplicateUsername.code, 'ER_DUP_ENTRY');
    assert.ok(duplicateEmail, 'duplicate email must be rejected');
    assert.strictEqual(duplicateEmail.code, 'ER_DUP_ENTRY');
});

test('concurrent registrations cannot create duplicate identities', async () => {
    const username = `${TEST_USERNAME}_cc${crypto.randomBytes(2).toString('hex')}`;
    const email = `${TEST_USERNAME}_cc${crypto.randomBytes(3).toString('hex')}@sparkle.test`;

    const attempt = async () => {
        try {
            const userId = crypto.randomUUID();
            await transaction(async (conn) => {
                await conn.execute(
                    `INSERT INTO users (user_id, name, username, email, password_hash) VALUES (?, 'Concurrent', ?, ?, 'hash')`,
                    [userId, username, email]
                );
            });
            return 'created';
        } catch (error) {
            return error.code || 'error';
        }
    };

    const results = await Promise.all([attempt(), attempt()]);
    assert.strictEqual(results.filter((r) => r === 'created').length, 1);
    assert.ok(results.includes('ER_DUP_ENTRY'));

    const [rows] = await pool.query('SELECT user_id FROM users WHERE username_normalized = ?', [username]);
    assert.strictEqual(rows.length, 1);
    createdUserIds.push(rows[0].user_id);
});

test('redis unavailability falls back to the authoritative mysql lookup', async () => {
    const user = await insertTestUser();
    const originalRun = Object.getPrototypeOf(redisClient).run;
    Object.getPrototypeOf(redisClient).run = async () => {
        throw new Error('simulated redis outage');
    };
    try {
        const result = await identityLookup.checkIdentity('email', user.email);
        assert.strictEqual(result.taken, true);
        assert.strictEqual(result.source, 'mysql');
    } finally {
        Object.getPrototypeOf(redisClient).run = originalRun;
    }
});

test('a redis timeout falls back to the authoritative mysql lookup', async () => {
    const user = await insertTestUser();
    const previousTimeout = process.env.SPARKLE_IDENTITY_BLOOM_TIMEOUT_MS;
    process.env.SPARKLE_IDENTITY_BLOOM_TIMEOUT_MS = '1';
    try {
        const result = await identityLookup.checkIdentity('email', user.email);
        assert.strictEqual(result.taken, true);
        assert.strictEqual(result.source, 'mysql');
    } finally {
        process.env.SPARKLE_IDENTITY_BLOOM_TIMEOUT_MS = previousTimeout;
    }
});

test('the availability endpoints never leak internal filter state', async () => {
    const user = await insertTestUser();
    await syncUserToBloom(user);
    const result = await identityLookup.checkIdentity('username', user.username);
    assert.strictEqual(result.taken, true);
    assert.ok(!('hmac' in result));
    assert.ok(!('positions' in result));
    assert.ok(!('probe' in result));
});

test('a rebuild validates its filter before it is marked ready', async () => {
    const version = `${TEST_VERSION}_rebuild`;
    const pairs = [];
    for (let i = 0; i < 5; i++) {
        pairs.push({ value: `rebuild_${RUN_ID}_${i}`, hmac: identity.createIdentityHmac('username', `rebuild_${RUN_ID}_${i}`) });
    }

    await filterStore.preallocateFilter('username', version);
    await filterStore.insertIdentityBatch('username', version, pairs.map((p) => p.hmac));

    for (const pair of pairs) {
        const present = await filterStore.probeBitsAtVersion('username', pair.value, version);
        assert.strictEqual(present, true);
    }

    const meta = await filterStore.readFilterMeta('username', version);
    assert.strictEqual(meta, null);

    await filterStore.setFilterReady('username', version, { sourceCount: pairs.length, durationMs: 1 });
    const readyMeta = await filterStore.readFilterMeta('username', version);
    assert.strictEqual(readyMeta.sourceCount, pairs.length);
    assert.strictEqual(readyMeta.hmacFingerprint, identity.getIdentityHmacFingerprint());

    await redisClient.del([
        config.filterBitsKey('username', version),
        config.filterReadyKey('username', version),
        config.filterMetaKey('username', version)
    ], 10000).catch(() => {});
});
