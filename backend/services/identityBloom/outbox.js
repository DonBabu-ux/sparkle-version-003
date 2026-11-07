'use strict';

const crypto = require('crypto');
const logger = require('../../utils/logger');
const metrics = require('./metrics');
const {
    createIdentityHmac,
    assertIdentityType,
    normalizeUsername,
    normalizeEmail
} = require('../../utils/identity/identity');

let poolRef = null;
function getPool() {
    if (!poolRef) {
        poolRef = require('../../config/database');
    }
    return poolRef;
}

const TABLE = 'identity_bloom_outbox';
const STATUS = Object.freeze({
    PENDING: 'pending',
    PROCESSING: 'processing',
    PROCESSED: 'processed',
    FAILED: 'failed'
});

const MAX_ERROR_LENGTH = 500;

function sanitizeError(error) {
    const message = error && error.message ? error.message : String(error || 'unknown error');
    return message.replace(/[\r\n]+/g, ' ').slice(0, MAX_ERROR_LENGTH);
}

function buildEvent(entityType, entityId, identityType, identityHmac, operation = 'add') {
    return {
        outbox_id: crypto.randomUUID(),
        entity_type: entityType,
        entity_id: entityId,
        identity_type: identityType,
        identity_hmac: identityHmac,
        operation,
        status: STATUS.PENDING
    };
}

function canonicalize(identityType, rawValue) {
    const type = assertIdentityType(identityType);
    if (type === 'username') return normalizeUsername(rawValue);
    return normalizeEmail(rawValue);
}

/**
 * Builds the synchronization events for a set of identities.
 * Raw identity values are never persisted, only the keyed HMAC representation.
 */
function buildIdentityEvents({ entityType = 'user', entityId, identities }) {
    const events = [];
    for (const identity of identities || []) {
        if (!identity) continue;
        const identityType = assertIdentityType(identity.identityType);
        const canonical = canonicalize(identityType, identity.value);
        if (!canonical) continue;
        const hmac = identity.hmac || createIdentityHmac(identityType, canonical);
        events.push(buildEvent(entityType, entityId, identityType, hmac));
    }
    return events;
}

/**
 * Inserts the synchronization events using the caller's transaction connection
 * so the events commit and roll back together with the entity write.
 */
async function enqueueIdentityEvents(conn, events) {
    if (!conn || !Array.isArray(events) || events.length === 0) return 0;
    let inserted = 0;
    for (const event of events) {
        try {
            await conn.execute(
                `INSERT INTO ${TABLE}
                    (outbox_id, entity_type, entity_id, identity_type, identity_hmac, operation, status, attempts, created_at, next_attempt_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 0, NOW(), NOW())
                 ON DUPLICATE KEY UPDATE status = VALUES(status), next_attempt_at = NOW()`,
                [
                    event.outbox_id,
                    event.entity_type,
                    event.entity_id,
                    event.identity_type,
                    event.identity_hmac,
                    event.operation,
                    event.status
                ]
            );
            inserted += 1;
        } catch (error) {
            logger.error(`[IdentityBloom] Failed to enqueue outbox event for ${event.identity_type}: ${error.message}`);
            throw error;
        }
    }
    metrics.increment('outboxEnqueued', inserted);
    return inserted;
}

async function claimPendingEvents(workerId, limit) {
    const batchSize = Math.max(1, Math.min(1000, Number(limit) || 100));
    const conn = await getPool().getConnection();
    const claimed = [];
    try {
        await conn.beginTransaction();
        const [rows] = await conn.query(
            `SELECT outbox_id, entity_type, entity_id, identity_type, identity_hmac, operation, attempts, created_at
             FROM ${TABLE}
             WHERE status = '${STATUS.PENDING}' AND next_attempt_at <= NOW()
             ORDER BY created_at ASC
             LIMIT ${batchSize}
             FOR UPDATE SKIP LOCKED`
        );

        if (rows.length > 0) {
            const ids = rows.map((r) => r.outbox_id);
            const placeholders = ids.map(() => '?').join(', ');
            await conn.query(
                `UPDATE ${TABLE}
                 SET status = '${STATUS.PROCESSING}', claimed_by = ?, claimed_at = NOW(), attempts = attempts + 1
                 WHERE outbox_id IN (${placeholders})`,
                [workerId, ...ids]
            );
            for (const row of rows) {
                claimed.push({ ...row, attempts: Number(row.attempts || 0) + 1 });
            }
        }

        await conn.commit();
        return claimed;
    } catch (error) {
        try { await conn.rollback(); } catch (_) { /* already rolled back */ }
        throw error;
    } finally {
        conn.release();
    }
}

async function markProcessed(outboxId) {
    await getPool().query(
        `UPDATE ${TABLE}
         SET status = '${STATUS.PROCESSED}', processed_at = NOW(), last_error = NULL, claimed_by = NULL, claimed_at = NULL
         WHERE outbox_id = ?`,
        [outboxId]
    );
    metrics.increment('outboxProcessed');
    metrics.setGauge('lastOutboxProcessedAt', new Date().toISOString());
}

async function markFailed(outboxId, error, permanent, nextAttemptDelayMs) {
    const status = permanent ? STATUS.FAILED : STATUS.PENDING;
    const delay = Math.max(0, Number(nextAttemptDelayMs) || 0);
    if (permanent) {
        await getPool().query(
            `UPDATE ${TABLE}
             SET status = '${STATUS.FAILED}', last_error = ?, claimed_by = NULL, claimed_at = NULL
             WHERE outbox_id = ?`,
            [sanitizeError(error), outboxId]
        );
        metrics.increment('outboxFailed');
    } else {
        await getPool().query(
            `UPDATE ${TABLE}
             SET status = '${STATUS.PENDING}', last_error = ?, claimed_by = NULL, claimed_at = NULL,
                 next_attempt_at = DATE_ADD(NOW(), INTERVAL ? SECOND)
             WHERE outbox_id = ?`,
            [sanitizeError(error), Math.ceil(delay / 1000), outboxId]
        );
        metrics.increment('outboxRetried');
    }
}

async function requeueStaleClaims(staleAfterSeconds) {
    const seconds = Math.max(30, Math.min(3600, Number(staleAfterSeconds) || 300));
    const [result] = await getPool().query(
        `UPDATE ${TABLE}
         SET status = '${STATUS.PENDING}', claimed_by = NULL, claimed_at = NULL, next_attempt_at = NOW()
         WHERE status = '${STATUS.PROCESSING}' AND claimed_at < DATE_SUB(NOW(), INTERVAL ${seconds} SECOND)`
    );
    return result && result.affectedRows ? result.affectedRows : 0;
}

async function getBacklog() {
    const [rows] = await getPool().query(
        `SELECT status, COUNT(*) AS total, MIN(created_at) AS oldest_created_at
         FROM ${TABLE}
         WHERE status IN ('${STATUS.PENDING}', '${STATUS.PROCESSING}', '${STATUS.FAILED}')
         GROUP BY status`
    );
    const backlog = { pending: 0, processing: 0, failed: 0, oldestCreatedAt: null };
    for (const row of rows) {
        backlog[row.status] = Number(row.total || 0);
        if (row.oldest_created_at && (!backlog.oldestCreatedAt || new Date(row.oldest_created_at) < new Date(backlog.oldestCreatedAt))) {
            backlog.oldestCreatedAt = row.oldest_created_at;
        }
    }
    metrics.setGauge('outboxBacklog', backlog.pending + backlog.processing + backlog.failed);
    return backlog;
}

async function getEventStats() {
    const [rows] = await getPool().query(
        `SELECT status, COUNT(*) AS total FROM ${TABLE} GROUP BY status`
    );
    const stats = { pending: 0, processing: 0, processed: 0, failed: 0 };
    for (const row of rows) {
        if (stats[row.status] !== undefined) stats[row.status] = Number(row.total || 0);
    }
    return stats;
}

module.exports = {
    TABLE,
    STATUS,
    buildIdentityEvents,
    enqueueIdentityEvents,
    claimPendingEvents,
    markProcessed,
    markFailed,
    requeueStaleClaims,
    getBacklog,
    getEventStats,
    sanitizeError
};
