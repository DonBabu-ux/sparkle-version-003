'use strict';

require('dotenv').config();

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const path = require('path');
const Module = require('module');

const RUN_ID = `${Date.now()}${crypto.randomBytes(3).toString('hex')}`;
const SHORT_ID = crypto.randomBytes(4).toString('hex');
const TEST_SECRET = `signup-secret-${RUN_ID}-long-enough-for-hmac`;

process.env.SPARKLE_IDENTITY_BLOOM_HMAC_SECRET = TEST_SECRET;
process.env.SPARKLE_IDENTITY_BLOOM_VERSION = `signup${RUN_ID}`;
process.env.SPARKLE_IDENTITY_BLOOM_TIMEOUT_MS = process.env.SPARKLE_IDENTITY_BLOOM_TIMEOUT_MS || '5000';

const BACKEND = path.join(__dirname, '..');

const stub = (resolvedPath, exports) => {
    const m = new Module(resolvedPath);
    m.filename = resolvedPath;
    m.loaded = true;
    m.exports = exports;
    require.cache[resolvedPath] = m;
};

stub(path.join(BACKEND, 'services/userBootstrap.service.js'), {
    bootstrapNewUser: async () => ({ ok: true })
});
stub(path.join(BACKEND, 'services/referral.service.js'), {
    attributeSignup: async () => ({ ok: true }),
    getOrCreateUserReferralCode: async () => ({ ok: true })
});
stub(path.join(BACKEND, 'config/email.js'), {
    sendEmail: async () => ({ ok: true }),
    initializeEmail: () => {}
});

const pool = require('../config/database');
const identity = require('../utils/identity/identity');
const config = require('../services/identityBloom/config');
const filterStore = require('../services/identityBloom/filterStore');
const redisClient = require('../services/identityBloom/redisClient');
const outbox = require('../services/identityBloom/outbox');
const authService = require('../services/auth.service');

const createdUserIds = [];
const createdUsernames = [];
const createdEmails = [];

function signupPayload(overrides = {}) {
    const suffix = overrides.suffix || crypto.randomBytes(4).toString('hex');
    const username = overrides.username || `sgn_${SHORT_ID}_${suffix}`;
    const email = overrides.email || `sgn_${SHORT_ID}_${suffix}@example.invalid`;
    return {
        name: 'Signup Test',
        username,
        email,
        password: 'CorrectHorse1!',
        user_type: 'student',
        campus: 'Test Campus',
        major: 'Testing',
        year: '3',
        phone_number: '+254700000001',
        ...overrides.payload
    };
}

async function cleanup() {
    if (createdUserIds.length > 0) {
        const placeholders = createdUserIds.map(() => '?').join(', ');
        await pool.query(`DELETE FROM notifications WHERE user_id IN (${placeholders})`, createdUserIds).catch(() => {});
        await pool.query(`DELETE FROM email_verifications WHERE user_id IN (${placeholders})`, createdUserIds).catch(() => {});
        await pool.query(`DELETE FROM user_legal_consents WHERE user_id IN (${placeholders})`, createdUserIds).catch(() => {});
        await pool.query(`DELETE FROM refresh_tokens WHERE user_id IN (${placeholders})`, createdUserIds).catch(() => {});
        await pool.query(`DELETE FROM identity_bloom_outbox WHERE entity_id IN (${placeholders})`, createdUserIds).catch(() => {});
        await pool.query(`DELETE FROM users WHERE user_id IN (${placeholders})`, createdUserIds).catch(() => {});
    }
    for (const identityType of ['username', 'email']) {
        await redisClient.del([
            config.filterBitsKey(identityType, process.env.SPARKLE_IDENTITY_BLOOM_VERSION),
            config.filterReadyKey(identityType, process.env.SPARKLE_IDENTITY_BLOOM_VERSION),
            config.filterMetaKey(identityType, process.env.SPARKLE_IDENTITY_BLOOM_VERSION)
        ], 10000).catch(() => {});
        await redisClient.del([config.pendingKey(identityType)], 10000).catch(() => {});
    }
    await redisClient.del([config.activeVersionKey()], 10000).catch(() => {});
}

test.before(async () => {
    await require('../migrations/20261107_create_identity_bloom_outbox')();
    for (const identityType of ['username', 'email']) {
        await filterStore.preallocateFilter(identityType, process.env.SPARKLE_IDENTITY_BLOOM_VERSION);
        await filterStore.setFilterReady(identityType, process.env.SPARKLE_IDENTITY_BLOOM_VERSION, { sourceCount: 0, durationMs: 0 });
    }
    await filterStore.switchActiveVersion({
        username: process.env.SPARKLE_IDENTITY_BLOOM_VERSION,
        email: process.env.SPARKLE_IDENTITY_BLOOM_VERSION
    });
});

test.after(async () => {
    await cleanup();
    await pool.end().catch(() => {});
});

test('signup creates the account, the synchronization events and keeps the response contract', async () => {
    const payload = signupPayload();
    const result = await authService.signup(payload, 'test-device');

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, 'success');
    assert.strictEqual(result.message, 'Account created! Please verify your email.');
    assert.ok(result.token);
    assert.ok(result.refreshToken);
    assert.strictEqual(result.user.username, payload.username.toLowerCase());
    assert.strictEqual(result.user.email, payload.email.toLowerCase());
    assert.strictEqual(result.user.email_verified, false);
    assert.strictEqual(result.next.route, '/onboarding');
    assert.strictEqual(result.next.reason, 'ONBOARDING_REQUIRED');

    createdUserIds.push(result.user.user_id);
    createdUsernames.push(payload.username.toLowerCase());
    createdEmails.push(payload.email.toLowerCase());

    const [events] = await pool.query('SELECT identity_type, identity_hmac, status FROM identity_bloom_outbox WHERE entity_id = ?', [result.user.user_id]);
    assert.strictEqual(events.length, 2);
    assert.deepStrictEqual(events.map((e) => e.identity_type).sort(), ['email', 'username']);
    for (const event of events) {
        assert.strictEqual(event.status, outbox.STATUS.PENDING);
        assert.match(event.identity_hmac, /^[0-9a-f]{64}$/);
    }
});

test('an unverified email is still taken on the next registration attempt', async () => {
    const first = signupPayload();
    const created = await authService.signup(first, 'test-device');
    createdUserIds.push(created.user.user_id);

    const second = signupPayload({ email: first.email, suffix: 'other' });
    await assert.rejects(
        () => authService.signup(second, 'test-device'),
        (error) => {
            assert.ok(Array.isArray(error.validationErrors));
            const emailError = error.validationErrors.find((e) => e.field === 'email');
            assert.ok(emailError, 'the duplicate email must be reported');
            assert.strictEqual(emailError.code, 'EMAIL_TAKEN');
            assert.strictEqual(emailError.message, 'Email address is already registered.');
            return true;
        }
    );
});

test('an email with different case and surrounding whitespace resolves to the same identity', async () => {
    const first = signupPayload();
    const created = await authService.signup(first, 'test-device');
    createdUserIds.push(created.user.user_id);

    const variant = `  ${first.email.toUpperCase()}  `;
    const second = signupPayload({ email: variant, suffix: 'case' });
    await assert.rejects(
        () => authService.signup(second, 'test-device'),
        (error) => {
            const emailError = error.validationErrors.find((e) => e.field === 'email');
            assert.ok(emailError);
            assert.strictEqual(emailError.code, 'EMAIL_TAKEN');
            return true;
        }
    );
});

test('an existing username is taken and suggestions are returned', async () => {
    const first = signupPayload();
    const created = await authService.signup(first, 'test-device');
    createdUserIds.push(created.user.user_id);

    const second = signupPayload({ username: ` ${first.username.toUpperCase()} `, suffix: 'user' });
    await assert.rejects(
        () => authService.signup(second, 'test-device'),
        (error) => {
            const usernameError = error.validationErrors.find((e) => e.field === 'username');
            assert.ok(usernameError, 'the duplicate username must be reported');
            assert.strictEqual(usernameError.code, 'USERNAME_TAKEN');
            assert.strictEqual(usernameError.message, 'Username is already taken.');
            assert.ok(Array.isArray(usernameError.suggestions));
            return true;
        }
    );
});

test('plus addressing and local part dots are not treated as the same identity', async () => {
    const first = signupPayload();
    const created = await authService.signup(first, 'test-device');
    createdUserIds.push(created.user.user_id);

    const plusVariant = first.email.replace('@example.invalid', '+tag@example.invalid');
    const second = signupPayload({ email: plusVariant, suffix: 'plus' });
    const result = await authService.signup(second, 'test-device');
    createdUserIds.push(result.user.user_id);
    assert.strictEqual(result.success, true);
});

test('two concurrent registrations with the same username cannot both succeed', async () => {
    const payload = signupPayload();
    const attempt = async () => {
        try {
            const result = await authService.signup(payload, 'test-device');
            createdUserIds.push(result.user.user_id);
            return 'created';
        } catch (error) {
            const duplicate = (error.validationErrors || []).find((e) => e.code === 'DUPLICATE_ENTRY');
            return duplicate ? 'DUPLICATE_ENTRY' : (error.code || 'error');
        }
    };

    const results = await Promise.all([attempt(), attempt()]);
    assert.strictEqual(results.filter((r) => r === 'created').length, 1);
    assert.ok(results.includes('DUPLICATE_ENTRY'));

    const [rows] = await pool.query('SELECT user_id FROM users WHERE username_normalized = ?', [payload.username.toLowerCase()]);
    assert.strictEqual(rows.length, 1);
});

test('a duplicate registration keeps the existing duplicate identity response format', async () => {
    const payload = signupPayload();
    const created = await authService.signup(payload, 'test-device');
    createdUserIds.push(created.user.user_id);

    let caught = null;
    try {
        await authService.signup(payload, 'test-device');
    } catch (error) {
        caught = error;
    }
    assert.ok(caught);
    assert.ok(Array.isArray(caught.validationErrors));
    const emailError = caught.validationErrors.find((e) => e.code === 'EMAIL_TAKEN');
    const usernameError = caught.validationErrors.find((e) => e.code === 'USERNAME_TAKEN');
    assert.ok(emailError, 'the duplicate email must be reported');
    assert.ok(usernameError, 'the duplicate username must be reported');
    assert.strictEqual(emailError.message, 'Email address is already registered.');
    assert.strictEqual(usernameError.message, 'Username is already taken.');
});
