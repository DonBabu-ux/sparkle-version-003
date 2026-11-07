'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

const identity = require('../utils/identity/identity');
const { getBloomGeometry, getConfig, filterBitsKey, filterReadyKey, pendingKey } = require('../services/identityBloom/config');
const { derivePositions, buildReadyToken } = require('../services/identityBloom/geometry');
const outbox = require('../services/identityBloom/outbox');

const TEST_SECRET = 'test-secret-value-with-at-least-32-characters-long';

process.env.SPARKLE_IDENTITY_BLOOM_HMAC_SECRET = TEST_SECRET;

test('username normalization trims, lowercases and strips a leading @', () => {
    assert.strictEqual(identity.normalizeUsername('  DonBabu  '), 'donbabu');
    assert.strictEqual(identity.normalizeUsername('DONBABU'), 'donbabu');
    assert.strictEqual(identity.normalizeUsername('@donbabu'), 'donbabu');
    assert.strictEqual(identity.normalizeUsername(''), '');
    assert.strictEqual(identity.normalizeUsername(null), '');
});

test('username case variants resolve to one canonical identity', () => {
    const a = identity.normalizeUsername('DonBabu');
    const b = identity.normalizeUsername('donbabu');
    const c = identity.normalizeUsername('  DONBABU  ');
    assert.strictEqual(a, b);
    assert.strictEqual(b, c);
    assert.strictEqual(identity.createIdentityHmac('username', a), identity.createIdentityHmac('username', c));
});

test('username validation keeps the existing Sparkle rules', () => {
    assert.strictEqual(identity.validateUsername('don_babu.1').valid, true);
    assert.strictEqual(identity.validateUsername('ab').valid, false);
    assert.strictEqual(identity.validateUsername('a'.repeat(31)).valid, false);
    assert.strictEqual(identity.validateUsername('don babu').valid, false);
    assert.strictEqual(identity.validateUsername('don@babu').valid, false);
});

test('email normalization trims and lowercases without touching local part semantics', () => {
    assert.strictEqual(identity.normalizeEmail('  DonBabu@gmail.com  '), 'donbabu@gmail.com');
    assert.strictEqual(identity.normalizeEmail('DONBABU@GMAIL.COM'), 'donbabu@gmail.com');
    assert.strictEqual(identity.normalizeEmail('don+babu@gmail.com'), 'don+babu@gmail.com');
    assert.strictEqual(identity.normalizeEmail('don.babu@gmail.com'), 'don.babu@gmail.com');
    assert.strictEqual(identity.normalizeEmail('don+babu@other.example'), 'don+babu@other.example');
});

test('email case variants resolve to one canonical identity', () => {
    const variants = ['DonBabu@gmail.com', 'donbabu@gmail.com', ' DONBABU@GMAIL.COM '];
    const hmacs = variants.map((value) => identity.createIdentityHmac('email', identity.normalizeEmail(value)));
    assert.strictEqual(new Set(hmacs).size, 1);
});

test('plus addressing and local part dots are preserved and not aliased', () => {
    const plus = identity.normalizeEmail('user+tag@example.com');
    const plain = identity.normalizeEmail('user@example.com');
    const dotted = identity.normalizeEmail('us.er@example.com');
    assert.notStrictEqual(plus, plain);
    assert.notStrictEqual(dotted, plain);
    assert.notStrictEqual(
        identity.createIdentityHmac('email', plus),
        identity.createIdentityHmac('email', plain)
    );
});

test('internationalized domains normalize consistently', () => {
    const a = identity.normalizeEmail('user@BÃ¼cher.example');
    const b = identity.normalizeEmail('  USER@bÃ¼cher.example ');
    assert.strictEqual(a, b);
});

test('invalid emails are rejected by the shared validator', () => {
    assert.strictEqual(identity.validateEmail('not-an-email').valid, false);
    assert.strictEqual(identity.validateEmail('missing@tld').valid, false);
    assert.strictEqual(identity.validateEmail('').valid, false);
    assert.strictEqual(identity.validateEmail(undefined).valid, false);
});

test('identity HMAC is deterministic and equals a direct keyed computation', () => {
    const expected = crypto.createHmac('sha256', TEST_SECRET).update('username:donbabu', 'utf8').digest('hex');
    assert.strictEqual(identity.createIdentityHmac('username', 'donbabu'), expected);
    assert.strictEqual(identity.createIdentityHmac('username', 'donbabu'), identity.createIdentityHmac('username', 'donbabu'));
});

test('identity HMAC is domain separated between identity types', () => {
    const usernameHmac = identity.createIdentityHmac('username', 'samevalue');
    const emailHmac = identity.createIdentityHmac('email', 'samevalue');
    assert.notStrictEqual(usernameHmac, emailHmac);
    assert.strictEqual(usernameHmac.length, 64);
    assert.match(usernameHmac, /^[0-9a-f]{64}$/);
});

test('identity HMAC changes when the secret changes', () => {
    const first = identity.createIdentityHmac('username', 'donbabu', 'secret-a-with-more-than-32-characters');
    const second = identity.createIdentityHmac('username', 'donbabu', 'secret-b-with-more-than-32-characters');
    assert.notStrictEqual(first, second);
});

test('identity HMAC is stable across separate module instances (two backend servers)', () => {
    const firstPath = require.resolve('../utils/identity/identity');
    delete require.cache[firstPath];
    const reloaded = require('../utils/identity/identity');
    assert.strictEqual(
        identity.createIdentityHmac('email', 'donbabu@gmail.com'),
        reloaded.createIdentityHmac('email', 'donbabu@gmail.com')
    );
});

test('missing or short HMAC secret is rejected at runtime', () => {
    const previous = process.env.SPARKLE_IDENTITY_BLOOM_HMAC_SECRET;
    delete process.env.SPARKLE_IDENTITY_BLOOM_HMAC_SECRET;
    assert.strictEqual(identity.isIdentityHmacConfigured(), false);
    assert.throws(() => identity.createIdentityHmac('username', 'donbabu'), /SPARKLE_IDENTITY_BLOOM_HMAC_SECRET/);
    process.env.SPARKLE_IDENTITY_BLOOM_HMAC_SECRET = 'too-short';
    assert.strictEqual(identity.isIdentityHmacConfigured(), false);
    process.env.SPARKLE_IDENTITY_BLOOM_HMAC_SECRET = previous;
    assert.strictEqual(identity.isIdentityHmacConfigured(), true);
});

test('HMAC fingerprint is stable for a secret and changes when the secret rotates', () => {
    const a = identity.getIdentityHmacFingerprint(TEST_SECRET);
    const b = identity.getIdentityHmacFingerprint(TEST_SECRET);
    const c = identity.getIdentityHmacFingerprint('another-secret-with-at-least-32-characters');
    assert.strictEqual(a, b);
    assert.notStrictEqual(a, c);
    assert.ok(!a.includes(TEST_SECRET));
});

test('bloom geometry matches the configured capacity and error rate', () => {
    const geometry = getBloomGeometry(1000000, 0.001);
    assert.strictEqual(geometry.capacity, 1000000);
    assert.strictEqual(geometry.errorRate, 0.001);
    assert.strictEqual(geometry.bits, 14377588);
    assert.strictEqual(geometry.hashCount, 10);
    assert.strictEqual(geometry.byteLength, Math.ceil(geometry.bits / 8));
});

test('filter keys are independent and contain no spaces', () => {
    const usernameKey = filterBitsKey('username', 'v1');
    const emailKey = filterBitsKey('email', 'v1');
    assert.strictEqual(usernameKey, 'sparkle:identity:bloom:username:v1');
    assert.strictEqual(emailKey, 'sparkle:identity:bloom:email:v1');
    assert.notStrictEqual(usernameKey, emailKey);
    for (const key of [usernameKey, emailKey, filterReadyKey('username', 'v1'), pendingKey('username')]) {
        assert.ok(!key.includes(' '), `key must not contain spaces: ${key}`);
    }
});

test('default configuration exposes the recommended capacity and error rate', () => {
    const previousCapacity = process.env.SPARKLE_IDENTITY_BLOOM_CAPACITY;
    const previousRate = process.env.SPARKLE_IDENTITY_BLOOM_ERROR_RATE;
    delete process.env.SPARKLE_IDENTITY_BLOOM_CAPACITY;
    delete process.env.SPARKLE_IDENTITY_BLOOM_ERROR_RATE;
    const config = getConfig();
    assert.strictEqual(config.capacity, 1000000);
    assert.strictEqual(config.errorRate, 0.001);
    assert.strictEqual(config.hashCount, 10);
    if (previousCapacity !== undefined) process.env.SPARKLE_IDENTITY_BLOOM_CAPACITY = previousCapacity;
    if (previousRate !== undefined) process.env.SPARKLE_IDENTITY_BLOOM_ERROR_RATE = previousRate;
});

test('derived positions are deterministic, in range and never negative', () => {
    const hmac = identity.createIdentityHmac('username', 'donbabu');
    const bits = 14377588;
    const hashCount = 10;
    const first = derivePositions(hmac, bits, hashCount);
    const second = derivePositions(hmac, bits, hashCount);
    assert.deepStrictEqual(first, second);
    assert.strictEqual(first.length, hashCount);
    for (const position of first) {
        assert.ok(Number.isInteger(position));
        assert.ok(position >= 0 && position < bits);
    }
});

test('derived positions differ across identity values and identity types', () => {
    const bits = 14377588;
    const usernameA = derivePositions(identity.createIdentityHmac('username', 'donbabu'), bits, 10);
    const usernameB = derivePositions(identity.createIdentityHmac('username', 'donbabuz'), bits, 10);
    const emailA = derivePositions(identity.createIdentityHmac('email', 'donbabu'), bits, 10);
    assert.notDeepStrictEqual(usernameA, usernameB);
    assert.notDeepStrictEqual(usernameA, emailA);
});

test('ready token binds the filter to the secret fingerprint and geometry', () => {
    const fingerprint = identity.getIdentityHmacFingerprint(TEST_SECRET);
    const token = buildReadyToken(fingerprint, 14377588, 10);
    assert.strictEqual(token, `${fingerprint}.14377588.10`);
    assert.notStrictEqual(token, buildReadyToken(fingerprint, 14377588, 9));
    assert.notStrictEqual(token, buildReadyToken('otherfingerprint', 14377588, 10));
});

test('outbox events store only keyed HMAC representations, never raw identities', () => {
    const events = outbox.buildIdentityEvents({
        entityType: 'user',
        entityId: 'user-1',
        identities: [
            { identityType: 'username', value: '  DonBabu  ' },
            { identityType: 'email', value: ' DONBABU@GMAIL.COM ' }
        ]
    });

    assert.strictEqual(events.length, 2);
    const serialized = JSON.stringify(events);
    assert.ok(!serialized.includes('DonBabu'));
    assert.ok(!serialized.includes('donbabu'));
    assert.ok(!serialized.includes('GMAIL'));

    const usernameEvent = events.find((e) => e.identity_type === 'username');
    const emailEvent = events.find((e) => e.identity_type === 'email');
    assert.strictEqual(usernameEvent.identity_hmac, identity.createIdentityHmac('username', 'donbabu'));
    assert.strictEqual(emailEvent.identity_hmac, identity.createIdentityHmac('email', 'donbabu@gmail.com'));
    assert.match(usernameEvent.identity_hmac, /^[0-9a-f]{64}$/);
    assert.strictEqual(usernameEvent.status, outbox.STATUS.PENDING);
});

test('outbox events normalise identities the same way lookups do', () => {
    const [event] = outbox.buildIdentityEvents({
        entityType: 'user',
        entityId: 'user-2',
        identities: [{ identityType: 'email', value: ' User.Name+tag@Example.COM ' }]
    });
    assert.strictEqual(event.identity_hmac, identity.createIdentityHmac('email', 'user.name+tag@example.com'));
});

test('outbox event builder rejects unsupported identity types', () => {
    assert.throws(() => outbox.buildIdentityEvents({
        entityType: 'user',
        entityId: 'user-3',
        identities: [{ identityType: 'phone', value: '+254700000000' }]
    }), /Unsupported identity type/);
});

test('canonicalizeIdentity applies the shared validation rules', () => {
    const username = identity.canonicalizeIdentity('username', ' DonBabu ');
    assert.strictEqual(username.valid, true);
    assert.strictEqual(username.value, 'donbabu');

    const email = identity.canonicalizeIdentity('email', ' DonBabu@Gmail.com ');
    assert.strictEqual(email.valid, true);
    assert.strictEqual(email.value, 'donbabu@gmail.com');

    const invalid = identity.canonicalizeIdentity('username', 'ab');
    assert.strictEqual(invalid.valid, false);
    assert.strictEqual(invalid.error.code, 'USERNAME_TOO_SHORT');
});
