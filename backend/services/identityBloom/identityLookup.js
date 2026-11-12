'use strict';

const { safeQuery } = require('../../config/database');
const logger = require('../../utils/logger');
const metrics = require('./metrics');
const filterStore = require('./filterStore');
const { PROBE_STATE } = require('./filterStore');
const { assertIdentityType, normalizeUsername, normalizeEmail } = require('../../utils/identity/identity');

const ABSENT_STATES = new Set([PROBE_STATE.ABSENT]);

function canonicalize(identityType, value) {
    const raw = typeof value === 'string' ? value : '';
    return identityType === 'username' ? normalizeUsername(raw) : normalizeEmail(raw);
}

async function verifyIdentityInDatabase(identityType, value) {
    const type = assertIdentityType(identityType);
    const canonicalValue = canonicalize(type, value);
    const sql = type === 'username'
        ? 'SELECT user_id FROM users WHERE username_normalized = ? LIMIT 1'
        : 'SELECT user_id FROM users WHERE email = ? LIMIT 1';
    const rows = await safeQuery(sql, [canonicalValue]);
    return rows.length > 0;
}

/**
 * Determines whether an identity is already reserved in MySQL.
 *
 * A Bloom Filter negative is only honoured when the filter reports the
 * identity as definitely absent AND the filter is healthy, initialized and
 * synchronized. Every other outcome falls back to the authoritative MySQL
 * lookup, which matches every identity-reserving record regardless of the
 * account's verification, onboarding or lifecycle status.
 */
async function checkIdentity(identityType, value, options = {}) {
    const type = assertIdentityType(identityType);
    const canonicalValue = canonicalize(type, value);
    const probe = await filterStore.probeIdentity(type, canonicalValue, {
        reserve: options.reserve === true
    });

    if (ABSENT_STATES.has(probe.state) && options.forceDatabaseCheck !== true) {
        metrics.increment('mysqlSelectsAvoided');
        return { taken: false, source: 'bloom', probeState: probe.state };
    }

    let taken;
    try {
        taken = await verifyIdentityInDatabase(type, canonicalValue);
    } catch (error) {
        logger.error(`[IdentityBloom] MySQL verification failed for ${type}: ${error.message}`);
        throw error;
    }

    metrics.increment('mysqlVerifications');
    if (!taken && probe.state === PROBE_STATE.PRESENT) {
        metrics.increment('falsePositives');
    }

    let source = 'mysql';
    if (probe.state === PROBE_STATE.PRESENT || probe.state === PROBE_STATE.PENDING) {
        source = 'bloom+mysql';
    }

    return { taken, source, probeState: probe.state };
}

/**
 * Evaluates username and email independently and concurrently.
 */
async function checkIdentities(identities, options = {}) {
    const list = (identities || []).filter((entry) => entry && entry.identityType && entry.value);
    const results = await Promise.all(
        list.map(async (entry) => {
            const outcome = await checkIdentity(entry.identityType, entry.value, {
                reserve: options.reserve === true,
                forceDatabaseCheck: entry.forceDatabaseCheck === true
            });
            return { identityType: entry.identityType, value: entry.value, ...outcome };
        })
    );

    const byType = {};
    for (const result of results) {
        byType[result.identityType] = result;
    }
    return byType;
}

module.exports = {
    verifyIdentityInDatabase,
    checkIdentity,
    checkIdentities
};
