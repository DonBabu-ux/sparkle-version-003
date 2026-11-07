'use strict';

const logger = require('../../utils/logger');
const filterStore = require('./filterStore');
const outbox = require('./outbox');
const {
    createIdentityHmac,
    assertIdentityType,
    normalizeUsername,
    normalizeEmail
} = require('../../utils/identity/identity');

function canonicalize(identityType, rawValue) {
    const type = assertIdentityType(identityType);
    if (type === 'username') return normalizeUsername(rawValue);
    return normalizeEmail(rawValue);
}

/**
 * Marks identities as pending before the authoritative MySQL write.
 *
 * The pending marker closes the window between the MySQL commit and the
 * outbox worker applying the identity to the Bloom Filter, so a Bloom
 * negative is never trusted for an identity that is already reserved.
 */
async function markIdentitiesPending(identities) {
    const entries = [];
    for (const identity of identities || []) {
        if (!identity || !identity.value) continue;
        const canonical = canonicalize(identity.identityType, identity.value);
        if (!canonical) continue;
        entries.push({
            identityType: identity.identityType,
            hmac: identity.hmac || createIdentityHmac(identity.identityType, canonical)
        });
    }
    if (entries.length === 0) return 0;
    try {
        return await filterStore.markPendingBatch(entries);
    } catch (error) {
        logger.warn(`[IdentityBloom] Could not mark identities pending: ${error.message}`);
        return 0;
    }
}

/**
 * Enqueues the Bloom synchronization events for a freshly written account
 * using the caller's transaction connection.
 */
async function enqueueIdentityEventsForUser(conn, entityId, identities, options = {}) {
    const entityType = options.entityType || 'user';
    const events = outbox.buildIdentityEvents({ entityType, entityId, identities });
    if (events.length === 0) return 0;
    try {
        return await outbox.enqueueIdentityEvents(conn, events);
    } catch (error) {
        if (error && error.code === 'ER_NO_SUCH_TABLE') {
            logger.warn('[IdentityBloom] Identity bloom outbox table is unavailable - synchronization is degraded.');
            return 0;
        }
        throw error;
    }
}

module.exports = {
    markIdentitiesPending,
    enqueueIdentityEventsForUser
};
