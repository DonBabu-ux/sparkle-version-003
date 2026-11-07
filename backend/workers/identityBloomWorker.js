'use strict';

const crypto = require('crypto');
const logger = require('../utils/logger');
const filterStore = require('../services/identityBloom/filterStore');
const outbox = require('../services/identityBloom/outbox');
const metrics = require('../services/identityBloom/metrics');
const redisClient = require('../services/identityBloom/redisClient');
const { getConfig } = require('../services/identityBloom/config');
const { isIdentityHmacConfigured } = require('../utils/identity/identity');

const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;
const STALE_CLAIM_SECONDS = 300;

class IdentityBloomWorker {
    constructor() {
        this.workerId = `${process.env.INSTANCE_ID || 'local'}-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
        this.intervalHandle = null;
        this.isProcessing = false;
        this.started = false;
    }

    start(intervalMs) {
        if (this.started) return;
        const config = getConfig();
        const interval = intervalMs || config.workerIntervalMs;

        if (!redisClient.isConfigured()) {
            logger.warn('[IdentityBloomWorker] Redis is not configured - identity bloom worker will not start.');
            return;
        }
        if (!isIdentityHmacConfigured()) {
            logger.error('[IdentityBloomWorker] SPARKLE_IDENTITY_BLOOM_HMAC_SECRET is missing - identity bloom worker will not start.');
            return;
        }

        this.started = true;
        logger.info(`[IdentityBloomWorker] Starting identity synchronization worker (interval ${interval}ms, id ${this.workerId})`);

        this.runCycle().catch((err) => {
            logger.error('[IdentityBloomWorker] Initial cycle error:', err.message);
        });

        this.intervalHandle = setInterval(() => {
            this.runCycle().catch((err) => {
                logger.error('[IdentityBloomWorker] Cycle error:', err.message);
            });
        }, interval);

        if (typeof this.intervalHandle.unref === 'function') this.intervalHandle.unref();
    }

    stop() {
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
        }
        this.started = false;
        logger.info('[IdentityBloomWorker] Stopped.');
    }

    async runCycle() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        const config = getConfig();

        try {
            const requeued = await outbox.requeueStaleClaims(STALE_CLAIM_SECONDS);
            if (requeued > 0) {
                logger.warn(`[IdentityBloomWorker] Requeued ${requeued} stale claimed event(s).`);
            }

            const claimed = await outbox.claimPendingEvents(this.workerId, config.workerBatchSize);
            if (claimed.length > 0) {
                await this.processEvents(claimed);
            }

            await outbox.getBacklog();
            await this.cleanupStalePending();
        } catch (error) {
            logger.error(`[IdentityBloomWorker] Cycle failure: ${error.message}`);
        } finally {
            this.isProcessing = false;
        }
    }

    async processEvents(events) {
        for (const event of events) {
            try {
                await filterStore.insertIdentity(event.identity_type, event.identity_hmac, {
                    forceVersionRefresh: true
                });
                await outbox.markProcessed(event.outbox_id);

                const createdAt = event.created_at ? new Date(event.created_at).getTime() : Date.now();
                const delay = Math.max(0, Date.now() - createdAt);
                metrics.observeLatency('outboxSyncDelay', delay);
            } catch (error) {
                const permanent = Number(event.attempts || 0) >= getMaxAttempts();
                const backoff = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, Math.max(0, Number(event.attempts || 1) - 1)));
                logger.error(`[IdentityBloomWorker] Failed to sync ${event.identity_type} identity event ${event.outbox_id}: ${error.message}`);
                try {
                    await outbox.markFailed(event.outbox_id, error, permanent, backoff);
                } catch (markError) {
                    logger.error(`[IdentityBloomWorker] Could not record failure for event ${event.outbox_id}: ${markError.message}`);
                }
            }
        }
    }

    async cleanupStalePending() {
        const config = getConfig();
        try {
            await filterStore.clearStalePending('username', config.pendingTtlMs);
            await filterStore.clearStalePending('email', config.pendingTtlMs);
        } catch (error) {
            logger.warn(`[IdentityBloomWorker] Pending cleanup skipped: ${error.message}`);
        }
    }
}

function getMaxAttempts() {
    return getConfig().workerMaxAttempts;
}

const workerInstance = new IdentityBloomWorker();
module.exports = workerInstance;
module.exports.IdentityBloomWorker = IdentityBloomWorker;
