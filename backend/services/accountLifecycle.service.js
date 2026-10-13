// services/accountLifecycle.service.js - Production Account Lifecycle Service
'use strict';

const crypto = require('crypto');
const pool = require('../config/database');
const logger = require('../utils/logger');
const emailService = require('./email.service');
const { invalidateUserCache } = require('../middleware/auth.middleware');

// Safe socket disconnect helper (handles cyclic requires gracefully)
function safeDisconnectSockets(userId, reason) {
    try {
        const socketModule = require('../socket');
        if (socketModule && typeof socketModule.disconnectUserSockets === 'function') {
            socketModule.disconnectUserSockets(userId, reason);
        }
    } catch (err) {
        logger.warn(`[AccountLifecycle] Socket disconnect warning for ${userId}: ${err.message}`);
    }
}

// Audit logger helper
async function recordAudit(conn, { userId, action, previousStatus, newStatus, initiatedBy, actorRole, reason, ipAddress, userAgent, metadata }) {
    try {
        const auditId = crypto.randomUUID();
        const client = conn || pool;
        await client.query(`
            INSERT INTO account_lifecycle_audit (
                id, user_id, action, previous_status, new_status, initiated_by, actor_role, reason, ip_address, user_agent, metadata, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, [
            auditId,
            userId,
            action,
            previousStatus || null,
            newStatus,
            initiatedBy || 'system',
            actorRole || 'user',
            reason ? String(reason).slice(0, 255) : null,
            ipAddress ? String(ipAddress).slice(0, 45) : null,
            userAgent ? String(userAgent).slice(0, 255) : null,
            metadata ? (typeof metadata === 'string' ? metadata : JSON.stringify(metadata)) : null
        ]);
    } catch (err) {
        logger.error(`[AccountLifecycle] Failed to record audit log: ${err.message}`);
    }
}

class AccountLifecycleService {
    /**
     * Suspend Account (Reversible temporary restriction)
     */
    async suspendAccount({ userId, reason = 'Taking a break', expiresAt = null, actorId = 'self', actorRole = 'user', req = null }) {
        if (!userId) throw new Error('User ID is required');

        const [users] = await pool.query('SELECT user_id, name, email, account_status, suspended_by FROM users WHERE user_id = ?', [userId]);
        if (users.length === 0) {
            throw new Error('User not found');
        }

        const user = users[0];
        const currentStatus = (user.account_status || 'active').toLowerCase();

        // Already suspended -> idempotent success
        if (currentStatus === 'suspended') {
            return {
                success: true,
                status: 'suspended',
                message: 'Account is already suspended',
                alreadySuspended: true
            };
        }

        // Cannot suspend terminated or deleted accounts
        if (currentStatus === 'terminated') {
            throw new Error('Cannot suspend an account that has already been terminated');
        }
        if (currentStatus === 'deleted') {
            throw new Error('Cannot suspend a deleted account');
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // 1. Update user state
            await conn.query(`
                UPDATE users SET 
                    account_status = 'suspended',
                    suspended_at = NOW(),
                    suspension_reason = ?,
                    suspended_by = ?,
                    suspension_expires_at = ?,
                    is_online = 0,
                    token_version = token_version + 1,
                    last_seen_at = NOW()
                WHERE user_id = ?
            `, [reason, actorId, expiresAt || null, userId]);

            // 2. Invalidate sessions and tokens
            await conn.query('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
            await conn.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);

            // 3. Record audit log
            await recordAudit(conn, {
                userId,
                action: 'SUSPEND',
                previousStatus: currentStatus,
                newStatus: 'suspended',
                initiatedBy: actorId,
                actorRole,
                reason,
                ipAddress: req?.ip,
                userAgent: req?.headers ? req.headers['user-agent'] : null,
                metadata: { expiresAt }
            });

            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

        // 4. Invalidate memory cache and disconnect active sockets
        invalidateUserCache(userId);
        safeDisconnectSockets(userId, 'suspended');

        // 5. Send notification email asynchronously
        if (user.email) {
            emailService.send({
                to: user.email,
                subject: 'Sparkle Account Suspended',
                templateName: 'account-suspended',
                templateData: {
                    name: user.name,
                    reason,
                    expiresAt: expiresAt ? new Date(expiresAt).toLocaleDateString() : null,
                    canReactivate: actorId === 'self' || actorId === userId
                }
            }).catch(e => logger.warn(`[AccountLifecycle] Failed to send suspend email: ${e.message}`));
        }

        logger.info(`[AccountLifecycle] User ${userId} suspended successfully (by: ${actorId}, reason: ${reason})`);
        return {
            success: true,
            status: 'suspended',
            message: 'Account suspended successfully'
        };
    }

    /**
     * Reactivate Account (Lift suspension)
     */
    async reactivateAccount({ userId, actorId = 'self', actorRole = 'user', req = null }) {
        if (!userId) throw new Error('User ID is required');

        const [users] = await pool.query('SELECT user_id, name, email, account_status, suspended_by FROM users WHERE user_id = ?', [userId]);
        if (users.length === 0) {
            throw new Error('User not found');
        }

        const user = users[0];
        const currentStatus = (user.account_status || 'active').toLowerCase();

        if (currentStatus === 'active') {
            return { success: true, status: 'active', message: 'Account is already active' };
        }

        if (currentStatus !== 'suspended') {
            throw new Error(`Cannot reactivate account with status '${currentStatus}'`);
        }

        // If suspension was by admin/moderator, ordinary users cannot lift it
        if (user.suspended_by && user.suspended_by !== 'self' && user.suspended_by !== userId) {
            if (actorRole !== 'admin' && actorRole !== 'moderator') {
                throw new Error('This account was suspended by administration. If this waas a mistake..Please contact support to appeal.');
            }
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            await conn.query(`
                UPDATE users SET 
                    account_status = 'active',
                    suspended_at = NULL,
                    suspension_reason = NULL,
                    suspended_by = NULL,
                    suspension_expires_at = NULL
                WHERE user_id = ?
            `, [userId]);

            await recordAudit(conn, {
                userId,
                action: 'RESTORE',
                previousStatus: 'suspended',
                newStatus: 'active',
                initiatedBy: actorId,
                actorRole,
                reason: 'Suspension lifted',
                ipAddress: req?.ip,
                userAgent: req?.headers ? req.headers['user-agent'] : null
            });

            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

        invalidateUserCache(userId);
        logger.info(`[AccountLifecycle] User ${userId} reactivated successfully`);

        return {
            success: true,
            status: 'active',
            message: 'Account reactivated successfully. You can now sign in.'
        };
    }

    /**
     * Terminate Account (Permanent access revocation under normal product policy)
     */
    async terminateAccount({ userId, reason = 'Account termination requested', actorId = 'self', actorRole = 'user', req = null }) {
        if (!userId) throw new Error('User ID is required');

        const [users] = await pool.query('SELECT user_id, name, email, account_status FROM users WHERE user_id = ?', [userId]);
        if (users.length === 0) {
            throw new Error('User not found');
        }

        const user = users[0];
        const currentStatus = (user.account_status || 'active').toLowerCase();

        // Idempotent check
        if (currentStatus === 'terminated') {
            return {
                success: true,
                status: 'terminated',
                message: 'Account is already terminated',
                alreadyTerminated: true
            };
        }

        if (currentStatus === 'deleted') {
            throw new Error('Account has already been permanently deleted');
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // 1. Update user to terminated
            await conn.query(`
                UPDATE users SET 
                    account_status = 'terminated',
                    terminated_at = NOW(),
                    termination_reason = ?,
                    terminated_by = ?,
                    is_online = 0,
                    token_version = token_version + 1,
                    last_seen_at = NOW()
                WHERE user_id = ?
            `, [reason, actorId, userId]);

            // 2. Revoke all sessions and refresh tokens
            await conn.query('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
            await conn.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);

            // 3. Record audit log
            await recordAudit(conn, {
                userId,
                action: 'TERMINATE',
                previousStatus: currentStatus,
                newStatus: 'terminated',
                initiatedBy: actorId,
                actorRole,
                reason,
                ipAddress: req?.ip,
                userAgent: req?.headers ? req.headers['user-agent'] : null
            });

            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

        invalidateUserCache(userId);
        safeDisconnectSockets(userId, 'terminated');

        // Send email
        if (user.email) {
            emailService.send({
                to: user.email,
                subject: 'Sparkle Account Terminated',
                templateName: 'account-terminated',
                templateData: {
                    name: user.name,
                    reason
                }
            }).catch(e => logger.warn(`[AccountLifecycle] Failed to send terminate email: ${e.message}`));
        }

        logger.info(`[AccountLifecycle] User ${userId} terminated successfully (by: ${actorId})`);
        return {
            success: true,
            status: 'terminated',
            message: 'Account terminated. Access has ended.'
        };
    }

    /**
     * Request Account Deletion (30-day grace period pending deletion)
     */
    async requestDeletion({ userId, reason = 'User requested deletion', actorId = 'self', actorRole = 'user', exportData = false, req = null }) {
        if (!userId) throw new Error('User ID is required');

        const [users] = await pool.query('SELECT user_id, name, email, account_status FROM users WHERE user_id = ?', [userId]);
        if (users.length === 0) {
            throw new Error('User not found');
        }

        const user = users[0];
        const currentStatus = (user.account_status || 'active').toLowerCase();

        if (currentStatus === 'deleted') {
            throw new Error('Account has already been permanently deleted');
        }

        // Calculate 30-day scheduled date
        const scheduledDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            await conn.query(`
                UPDATE users SET 
                    account_status = 'pending_deletion',
                    deletion_requested_at = NOW(),
                    deletion_marked_at = NOW(),
                    deleted_at = NOW(),
                    deletion_scheduled_at = DATE_ADD(NOW(), INTERVAL 30 DAY),
                    deletion_reason = ?,
                    is_online = 0,
                    token_version = token_version + 1,
                    last_seen_at = NOW()
                WHERE user_id = ?
            `, [reason, userId]);

            await conn.query('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
            await conn.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);

            await recordAudit(conn, {
                userId,
                action: 'REQUEST_DELETION',
                previousStatus: currentStatus,
                newStatus: 'pending_deletion',
                initiatedBy: actorId,
                actorRole,
                reason,
                ipAddress: req?.ip,
                userAgent: req?.headers ? req.headers['user-agent'] : null,
                metadata: { scheduledDate: scheduledDate.toISOString(), exportData: !!exportData }
            });

            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

        invalidateUserCache(userId);
        safeDisconnectSockets(userId, 'pending_deletion');

        // Send email
        if (user.email) {
            emailService.send({
                to: user.email,
                subject: 'Sparkle Account Scheduled for Deletion',
                templateName: 'account-deletion-scheduled',
                templateData: {
                    name: user.name,
                    scheduledDate: scheduledDate.toLocaleDateString()
                }
            }).catch(e => logger.warn(`[AccountLifecycle] Failed to send deletion scheduled email: ${e.message}`));
        }

        logger.info(`[AccountLifecycle] User ${userId} requested deletion (scheduled for ${scheduledDate.toISOString()})`);
        return {
            success: true,
            status: 'pending_deletion',
            scheduledAt: scheduledDate.toISOString(),
            message: 'Account scheduled for deletion in 30 days. You can cancel at any time during this grace period.'
        };
    }

    /**
     * Cancel Deletion Request (During 30-day grace period)
     */
    async cancelDeletion({ userId, actorId = 'self', actorRole = 'user', req = null }) {
        if (!userId) throw new Error('User ID is required');

        const [users] = await pool.query('SELECT user_id, name, email, account_status FROM users WHERE user_id = ?', [userId]);
        if (users.length === 0) {
            throw new Error('User not found');
        }

        const user = users[0];
        const currentStatus = (user.account_status || 'active').toLowerCase();

        if (currentStatus === 'active') {
            return { success: true, status: 'active', message: 'Account is already active' };
        }

        if (currentStatus !== 'pending_deletion') {
            throw new Error(`Cannot cancel deletion for account with status '${currentStatus}'`);
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            await conn.query(`
                UPDATE users SET 
                    account_status = 'active',
                    deletion_requested_at = NULL,
                    deletion_marked_at = NULL,
                    deleted_at = NULL,
                    deletion_scheduled_at = NULL,
                    deletion_reason = NULL
                WHERE user_id = ?
            `, [userId]);

            await recordAudit(conn, {
                userId,
                action: 'CANCEL_DELETION',
                previousStatus: 'pending_deletion',
                newStatus: 'active',
                initiatedBy: actorId,
                actorRole,
                reason: 'Deletion cancelled by user',
                ipAddress: req?.ip,
                userAgent: req?.headers ? req.headers['user-agent'] : null
            });

            await conn.commit();
        } catch (err) {
            await conn.rollback();
            throw err;
        } finally {
            conn.release();
        }

        invalidateUserCache(userId);
        logger.info(`[AccountLifecycle] Deletion cancelled for user ${userId}. Restored to active.`);

        return {
            success: true,
            status: 'active',
            message: 'Account deletion cancelled successfully. Your account is active.'
        };
    }

    /**
     * Process Hard Delete (Executed by background worker after grace period expires)
     */
    async processHardDelete(userId) {
        if (!userId) throw new Error('User ID is required');

        const [users] = await pool.query('SELECT user_id, name, email, username, account_status, deletion_scheduled_at FROM users WHERE user_id = ?', [userId]);
        if (users.length === 0) return { success: false, reason: 'not_found' };

        const user = users[0];
        const currentStatus = (user.account_status || '').toLowerCase();

        // Must still be pending_deletion
        if (currentStatus !== 'pending_deletion') {
            logger.warn(`[AccountLifecycle] Aborting hard delete for ${userId}: status is '${currentStatus}' not pending_deletion`);
            return { success: false, reason: 'invalid_status' };
        }

        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();

            // 1. Release original email and username by anonymizing the user record
            // This frees up the original email and username for reuse safely
            const anonEmail = `deleted_${userId.slice(0, 8)}_${Date.now()}@deleted.sparkle.local`;
            const anonUsername = `deleted_user_${userId.slice(0, 8)}_${Date.now()}`;
            const dummyPassword = await require('bcryptjs').hash(crypto.randomBytes(32).toString('hex'), 10);

            await conn.query(`
                UPDATE users SET 
                    email = ?,
                    username = ?,
                    username_normalized = ?,
                    password_hash = ?,
                    name = 'Deleted User',
                    display_name = 'Deleted User',
                    bio = NULL,
                    avatar_url = '/uploads/avatars/default.png',
                    phone_number = NULL,
                    account_status = 'deleted',
                    deletion_completed_at = NOW(),
                    token_version = token_version + 1,
                    is_online = 0,
                    two_factor_secret = NULL,
                    two_factor_backup_codes = NULL,
                    security_token = NULL
                WHERE user_id = ? AND account_status = 'pending_deletion'
            `, [anonEmail, anonUsername, anonUsername, dummyPassword, userId]);

            // 2. Remove sensitive credentials & private records
            await conn.query('DELETE FROM user_sessions WHERE user_id = ?', [userId]);
            await conn.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
            await conn.query('DELETE FROM password_resets WHERE user_id = ?', [userId]);

            // Clean push tokens if tables exist
            try { await conn.query('DELETE FROM fcm_tokens WHERE user_id = ?', [userId]); } catch (_) {}
            try { await conn.query('DELETE FROM push_notifications WHERE user_id = ?', [userId]); } catch (_) {}
            try { await conn.query('DELETE FROM notifications WHERE user_id = ?', [userId]); } catch (_) {}

            // 3. Record audit log
            await recordAudit(conn, {
                userId,
                action: 'HARD_DELETE',
                previousStatus: 'pending_deletion',
                newStatus: 'deleted',
                initiatedBy: 'system_lifecycle_worker',
                actorRole: 'system',
                reason: '30-day grace period elapsed. Permanent data wipe and email release completed.'
            });

            await conn.commit();
        } catch (err) {
            await conn.rollback();
            logger.error(`[AccountLifecycle] Hard delete transaction failed for ${userId}: ${err.message}`);
            throw err;
        } finally {
            conn.release();
        }

        invalidateUserCache(userId);
        safeDisconnectSockets(userId, 'deleted');

        // Optional completion email to old address
        if (user.email) {
            emailService.send({
                to: user.email,
                subject: 'Sparkle Account Permanently Deleted',
                templateName: 'account-deleted',
                templateData: { name: user.name }
            }).catch(e => logger.warn(`[AccountLifecycle] Final deleted email note failed: ${e.message}`));
        }

        logger.info(`[AccountLifecycle] User ${userId} hard deleted and email/username released.`);
        return { success: true, userId };
    }
}

module.exports = new AccountLifecycleService();
