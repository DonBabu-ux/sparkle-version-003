// workers/accountLifecycleWorker.js - Sparkle Account Lifecycle Worker
'use strict';

const pool = require('../config/database');
const logger = require('../utils/logger');
const accountLifecycleService = require('../services/accountLifecycle.service');

class AccountLifecycleWorker {
    constructor() {
        this.intervalHandle = null;
        this.isProcessing = false;
    }

    /**
     * Start background lifecycle processing cycle (Default 1 hour)
     */
    start(intervalMs = 60 * 60 * 1000) {
        if (this.intervalHandle) return;
        logger.info('[AccountLifecycleWorker] Starting account lifecycle background worker...');

        // Initial cycle execution
        this.runMaintenanceCycle().catch(err => {
            logger.error('[AccountLifecycleWorker] Initial cycle error:', err);
        });

        this.intervalHandle = setInterval(() => {
            this.runMaintenanceCycle().catch(err => {
                logger.error('[AccountLifecycleWorker] Periodic cycle error:', err);
            });
        }, intervalMs);
    }

    /**
     * Stop background worker
     */
    stop() {
        if (this.intervalHandle) {
            clearInterval(this.intervalHandle);
            this.intervalHandle = null;
            logger.info('[AccountLifecycleWorker] Stopped worker.');
        }
    }

    /**
     * Run a single maintenance cycle
     */
    async runMaintenanceCycle() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            // 1. Process Pending Deletions whose 30-day grace period has elapsed
            await this.processExpiredDeletions();

            // 2. Process Expired Suspensions (only accounts with status = 'suspended' and non-null expiry)
            await this.processExpiredSuspensions();

            // 3. Process Expired Data Exports and purge physical files
            await this.processExpiredExports();
        } catch (err) {
            logger.error('[AccountLifecycleWorker] Maintenance cycle failure:', err);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Find and permanently wipe accounts that completed 30-day pending deletion
     */
    async processExpiredDeletions() {
        try {
            const [eligible] = await pool.query(`
                SELECT user_id, deletion_scheduled_at 
                FROM users 
                WHERE account_status = 'pending_deletion' 
                  AND (
                    (deletion_scheduled_at IS NOT NULL AND deletion_scheduled_at <= NOW())
                    OR
                    (deletion_scheduled_at IS NULL AND deletion_marked_at IS NOT NULL AND deletion_marked_at <= DATE_SUB(NOW(), INTERVAL 30 DAY))
                  )
                LIMIT 50
            `);

            if (eligible.length > 0) {
                logger.info(`[AccountLifecycleWorker] Found ${eligible.length} account(s) ready for permanent data deletion.`);
                for (const row of eligible) {
                    try {
                        await accountLifecycleService.processHardDelete(row.user_id);
                    } catch (itemErr) {
                        logger.error(`[AccountLifecycleWorker] Failed hard delete for user ${row.user_id}:`, itemErr.message);
                    }
                }
            }
        } catch (err) {
            logger.error('[AccountLifecycleWorker] Error processing expired deletions:', err.message);
        }
    }

    /**
     * Find and lift suspensions whose scheduled expiry timestamp has passed
     * CRITICAL: Strictly checks account_status = 'suspended'. Never restores terminated or deleted accounts.
     */
    async processExpiredSuspensions() {
        try {
            const [eligible] = await pool.query(`
                SELECT user_id, suspension_expires_at 
                FROM users 
                WHERE account_status = 'suspended' 
                  AND suspension_expires_at IS NOT NULL 
                  AND suspension_expires_at <= NOW()
                LIMIT 50
            `);

            if (eligible.length > 0) {
                logger.info(`[AccountLifecycleWorker] Found ${eligible.length} account(s) with expired suspensions.`);
                for (const row of eligible) {
                    try {
                        await accountLifecycleService.reactivateAccount({
                            userId: row.user_id,
                            actorId: 'system_expiry_worker',
                            actorRole: 'system'
                        });
                    } catch (itemErr) {
                        logger.error(`[AccountLifecycleWorker] Failed to lift suspension for user ${row.user_id}:`, itemErr.message);
                    }
                }
            }
        } catch (err) {
            logger.error('[AccountLifecycleWorker] Error processing expired suspensions:', err.message);
        }
    }

    /**
     * Purge physical export files whose download token has expired
     */
    async processExpiredExports() {
        const fs = require('fs');
        try {
            const [expired] = await pool.query(`
                SELECT job_id, file_path 
                FROM data_export_jobs 
                WHERE status = 'READY' 
                  AND token_expires_at IS NOT NULL 
                  AND token_expires_at <= NOW()
                LIMIT 50
            `);

            for (const row of expired) {
                try {
                    if (row.file_path && fs.existsSync(row.file_path)) {
                        await fs.promises.unlink(row.file_path);
                    }
                    await pool.query('UPDATE data_export_jobs SET status = "EXPIRED", file_path = NULL WHERE job_id = ?', [row.job_id]);
                    logger.info(`[AccountLifecycleWorker] Purged expired export file for job ${row.job_id}`);
                } catch (e) {
                    logger.warn(`[AccountLifecycleWorker] Failed to purge export file for job ${row.job_id}: ${e.message}`);
                }
            }
        } catch (err) {
            logger.error('[AccountLifecycleWorker] Error cleaning expired export jobs:', err.message);
        }
    }
}

const workerInstance = new AccountLifecycleWorker();
module.exports = workerInstance;
