'use strict';

const crypto = require('crypto');
const { normalizeUsername, validateUsername } = require('../validation/username');
const { normalizeEmail, validateEmail } = require('../validation/email');

const IDENTITY_TYPES = Object.freeze({
    USERNAME: 'username',
    EMAIL: 'email'
});

const IDENTITY_TYPE_LIST = Object.freeze([IDENTITY_TYPES.USERNAME, IDENTITY_TYPES.EMAIL]);

const SECRET_ENV_VAR = 'SPARKLE_IDENTITY_BLOOM_HMAC_SECRET';
const MIN_SECRET_LENGTH = 32;

function isIdentityType(identityType) {
    return IDENTITY_TYPE_LIST.includes(String(identityType || '').trim().toLowerCase());
}

function assertIdentityType(identityType) {
    const type = String(identityType || '').trim().toLowerCase();
    if (!isIdentityType(type)) {
        throw new Error(`Unsupported identity type: ${identityType}`);
    }
    return type;
}

function getIdentityHmacSecret() {
    const secret = process.env[SECRET_ENV_VAR];
    return typeof secret === 'string' ? secret.trim() : '';
}

function isIdentityHmacConfigured() {
    return getIdentityHmacSecret().length >= MIN_SECRET_LENGTH;
}

function assertIdentityHmacConfigured() {
    if (!isIdentityHmacConfigured()) {
        throw new Error(`${SECRET_ENV_VAR} is missing or shorter than ${MIN_SECRET_LENGTH} characters`);
    }
    return getIdentityHmacSecret();
}

/**
 * Deterministic keyed representation of a normalized identity.
 * The identity type is part of the signed payload, so a username and an email
 * with the same textual value never produce the same HMAC.
 */
function createIdentityHmac(identityType, normalizedValue, secret) {
    const type = assertIdentityType(identityType);
    const key = secret ? String(secret) : assertIdentityHmacConfigured();
    const value = typeof normalizedValue === 'string' ? normalizedValue : '';
    return crypto
        .createHmac('sha256', key)
        .update(`${type}:${value}`, 'utf8')
        .digest('hex');
}

/**
 * Non-reversible fingerprint of the configured secret.
 * Stored next to a populated filter so a server running with a different
 * secret (or a rotated secret) refuses to trust that filter.
 */
function getIdentityHmacFingerprint(secret) {
    const key = secret ? String(secret) : assertIdentityHmacConfigured();
    return crypto
        .createHash('sha256')
        .update(`sparkle-identity-bloom-fingerprint:v1:${key}`, 'utf8')
        .digest('hex')
        .slice(0, 32);
}

/**
 * Canonical value + validation for an identity, using the exact same rules the
 * registration path enforces.
 */
function canonicalizeIdentity(identityType, rawValue) {
    const type = assertIdentityType(identityType);
    if (type === IDENTITY_TYPES.USERNAME) {
        const result = validateUsername(rawValue);
        if (!result.valid) return { valid: false, value: normalizeUsername(rawValue), error: result.error };
        return { valid: true, value: result.value, error: null };
    }
    const result = validateEmail(rawValue);
    if (!result.valid) return { valid: false, value: normalizeEmail(rawValue), error: result.error };
    return { valid: true, value: result.value, error: null };
}

module.exports = {
    IDENTITY_TYPES,
    IDENTITY_TYPE_LIST,
    SECRET_ENV_VAR,
    MIN_SECRET_LENGTH,
    isIdentityType,
    assertIdentityType,
    getIdentityHmacSecret,
    isIdentityHmacConfigured,
    assertIdentityHmacConfigured,
    createIdentityHmac,
    getIdentityHmacFingerprint,
    canonicalizeIdentity,
    normalizeUsername,
    normalizeEmail,
    validateUsername,
    validateEmail
};
