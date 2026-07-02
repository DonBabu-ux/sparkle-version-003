// services/systemMessage.service.js
//
// Sparkle's Universal Communication Service.
//
// This is the ONLY place that creates official platform messages.
// It does NOT deliver notifications — that responsibility belongs to
// NotificationService (queue) and notification.controller.js (DB).
//
// Responsibilities:
//   - Build structured notification payloads from templates
//   - Insert official messages into `notifications` table via safeQuery
//   - Insert companion chat messages into the system conversation
//   - Guarantee the system conversation always exists
//
// Architecture:
//   SystemMessageService  →  builds payload + saves to DB
//   NotificationService   →  handles async queue + push delivery

'use strict';

const crypto = require('crypto');
const { safeQuery } = require('../config/database');
const logger = require('../utils/logger');

// ── Templates ─────────────────────────────────────────────────────────────────
const welcomeTemplate          = require('./notifications/templates/welcome');
const loginAlertTemplate       = require('./notifications/templates/loginAlert');
const passwordChangedTemplate  = require('./notifications/templates/passwordChanged');
const verificationTemplate     = require('./notifications/templates/verificationSuccess');
const featureTemplate          = require('./notifications/templates/featureAnnouncement');
const securityAlertTemplate    = require('./notifications/templates/securityAlert');
const maintenanceTemplate      = require('./notifications/templates/maintenanceNotice');
const moderationTemplate       = require('./notifications/templates/moderationAction');

// ── Constants ─────────────────────────────────────────────────────────────────
const SYSTEM_USER_ID = process.env.SPARKLE_SYSTEM_USER_ID || 'd75fe3b5-7a45-4581-ab13-91934d8b54de';

// ─────────────────────────────────────────────────────────────────────────────

class SystemMessageService {

    // ── Core: ensure system user exists ───────────────────────────────────────
    async _ensureSystemUser() {
        try {
            const rows = await safeQuery(
                'SELECT user_id FROM users WHERE user_id = ? LIMIT 1',
                [SYSTEM_USER_ID]
            );
            if (rows.length > 0) return;

            await safeQuery(
                `INSERT INTO users
                   (user_id, name, username, email, password_hash, user_type, account_status, is_verified, onboarding_step, is_system_account)
                 VALUES (?, 'Sparkle', 'sparkle', 'official@sparkle.app', 'NO_LOGIN', 'system', 'active', 1, 6, TRUE)`,
                [SYSTEM_USER_ID]
            );
            logger.info('[SystemMessage] System user seeded.');
        } catch (e) {
            if (e.code !== 'ER_DUP_ENTRY') {
                logger.warn('[SystemMessage] Could not ensure system user:', e.message);
            }
        }
    }

    // ── Core: ensure system conversation exists for user ─────────────────────
    async ensureSystemConversation(userId) {
        try {
            const existing = await safeQuery(
                `SELECT chat_id FROM personal_chats
                 WHERE ((participant1_id = ? AND participant2_id = ?)
                     OR (participant1_id = ? AND participant2_id = ?))
                   AND marketplace_listing_id IS NULL
                 LIMIT 1`,
                [SYSTEM_USER_ID, userId, userId, SYSTEM_USER_ID]
            );

            if (existing.length > 0) return existing[0].chat_id;

            await this._ensureSystemUser();

            const chatId = crypto.randomUUID();
            await safeQuery(
                `INSERT INTO personal_chats
                   (chat_id, participant1_id, participant2_id, marketplace_listing_id, last_message_time)
                 VALUES (?, ?, ?, NULL, NOW())`,
                [chatId, SYSTEM_USER_ID, userId]
            );
            logger.info(`[SystemMessage] Created system conversation ${chatId} for user ${userId}`);
            return chatId;
        } catch (error) {
            logger.error('[SystemMessage] ensureSystemConversation error:', error.message);
            return null;
        }
    }

    // ── Core: save structured notification to DB ──────────────────────────────
    async _saveNotification(userId, payload) {
        const {
            type, title, body, icon = null,
            entities = [], actions = [],
            priority = 'normal', category = 'system',
            isOfficial = true,
        } = payload;

        const notifId = crypto.randomUUID();
        try {
            await safeQuery(
                `INSERT INTO notifications
                   (notification_id, user_id, type, title, content, icon, entities, actions,
                    priority, category, is_official, sender_id, action_url, is_read)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
                [
                    notifId, userId, type, title,
                    body,    // content (backward compat)
                    icon,
                    JSON.stringify(entities),
                    JSON.stringify(actions),
                    priority, category,
                    isOfficial ? 1 : 0,
                    SYSTEM_USER_ID,
                    actions[0]?.route || null,
                ]
            );
            return notifId;
        } catch (error) {
            logger.error('[SystemMessage] _saveNotification error:', error.message);
            return null;
        }
    }

    // ── Core: post a message in the system chat ───────────────────────────────
    async _postSystemChatMessage(userId, chatId, content) {
        try {
            const msgId = crypto.randomUUID();
            await safeQuery(
                `INSERT INTO messages
                   (message_id, conversation_id, sender_id, content, type, is_read, sent_at, context)
                 VALUES (?, ?, ?, ?, 'text', 0, NOW(), 'system')`,
                [msgId, chatId, SYSTEM_USER_ID, content]
            );

            // Update conversation last_message_time
            await safeQuery(
                'UPDATE personal_chats SET last_message_time = NOW() WHERE chat_id = ?',
                [chatId]
            );

            return msgId;
        } catch (error) {
            logger.error('[SystemMessage] _postSystemChatMessage error:', error.message);
            return null;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Send welcome message + notification on first signup.
     * @param {string} userId
     * @param {object} opts  { userName }
     */
    async sendWelcome(userId, opts = {}) {
        try {
            const chatId = await this.ensureSystemConversation(userId);
            const payload = welcomeTemplate(opts);

            // Idempotency: skip if welcome notification already exists
            const existing = await safeQuery(
                `SELECT notification_id FROM notifications WHERE user_id = ? AND type = 'welcome' LIMIT 1`,
                [userId]
            );
            if (existing.length > 0) return;

            await this._saveNotification(userId, payload);
            if (chatId) {
                await this._postSystemChatMessage(userId, chatId, payload.body);
            }

            logger.info(`[SystemMessage] Welcome sent to ${userId}`);
        } catch (error) {
            logger.error('[SystemMessage] sendWelcome error:', error.message);
        }
    }

    /**
     * Send login alert from a new device/location.
     * @param {string} userId
     * @param {object} opts  { device, location, time }
     */
    async sendLoginAlert(userId, opts = {}) {
        try {
            const payload = loginAlertTemplate(opts);
            await this._saveNotification(userId, payload);

            const chatId = await this.ensureSystemConversation(userId);
            if (chatId) {
                await this._postSystemChatMessage(userId, chatId, payload.body);
            }
            logger.info(`[SystemMessage] Login alert sent to ${userId}`);
        } catch (error) {
            logger.error('[SystemMessage] sendLoginAlert error:', error.message);
        }
    }

    /**
     * Send password-changed notification.
     * @param {string} userId
     * @param {object} opts  { time }
     */
    async sendPasswordChanged(userId, opts = {}) {
        try {
            const payload = passwordChangedTemplate(opts);
            await this._saveNotification(userId, payload);

            const chatId = await this.ensureSystemConversation(userId);
            if (chatId) {
                await this._postSystemChatMessage(userId, chatId, payload.body);
            }
            logger.info(`[SystemMessage] Password-changed alert sent to ${userId}`);
        } catch (error) {
            logger.error('[SystemMessage] sendPasswordChanged error:', error.message);
        }
    }

    /**
     * Send email/account verification success.
     * @param {string} userId
     * @param {object} opts  { verificationType }
     */
    async sendVerificationSuccess(userId, opts = {}) {
        try {
            const payload = verificationTemplate(opts);
            await this._saveNotification(userId, payload);
            logger.info(`[SystemMessage] Verification success sent to ${userId}`);
        } catch (error) {
            logger.error('[SystemMessage] sendVerificationSuccess error:', error.message);
        }
    }

    /**
     * Send feature announcement to one or many users.
     * @param {string|string[]} userIds  — single userId or array for bulk
     * @param {object} opts  { featureName, description, ctaLabel, ctaRoute, badge }
     */
    async sendFeatureAnnouncement(userIds, opts = {}) {
        const ids = Array.isArray(userIds) ? userIds : [userIds];
        const payload = featureTemplate(opts);
        let sent = 0;

        for (const userId of ids) {
            try {
                await this._saveNotification(userId, payload);
                sent++;
            } catch (e) {
                logger.warn(`[SystemMessage] featureAnnouncement failed for ${userId}:`, e.message);
            }
        }
        logger.info(`[SystemMessage] Feature announcement sent to ${sent}/${ids.length} users`);
    }

    /**
     * Send a security alert.
     * @param {string} userId
     * @param {object} opts  { alertType, detail }
     */
    async sendSecurityAlert(userId, opts = {}) {
        try {
            const payload = securityAlertTemplate(opts);
            await this._saveNotification(userId, payload);

            const chatId = await this.ensureSystemConversation(userId);
            if (chatId) {
                await this._postSystemChatMessage(userId, chatId, payload.body);
            }
            logger.info(`[SystemMessage] Security alert sent to ${userId}`);
        } catch (error) {
            logger.error('[SystemMessage] sendSecurityAlert error:', error.message);
        }
    }

    /**
     * Send a maintenance notice to one or many users.
     * @param {string|string[]} userIds
     * @param {object} opts  { startTime, duration, affectedServices, isEmergency }
     */
    async sendMaintenanceNotice(userIds, opts = {}) {
        const ids = Array.isArray(userIds) ? userIds : [userIds];
        const payload = maintenanceTemplate(opts);
        let sent = 0;

        for (const userId of ids) {
            try {
                await this._saveNotification(userId, payload);
                sent++;
            } catch (e) {
                logger.warn(`[SystemMessage] maintenanceNotice failed for ${userId}:`, e.message);
            }
        }
        logger.info(`[SystemMessage] Maintenance notice sent to ${sent}/${ids.length} users`);
    }

    /**
     * Send a moderation action notice.
     * @param {string} userId
     * @param {object} opts  { actionType, reason, appealRoute }
     */
    async sendModerationAction(userId, opts = {}) {
        try {
            const payload = moderationTemplate(opts);
            await this._saveNotification(userId, payload);

            const chatId = await this.ensureSystemConversation(userId);
            if (chatId) {
                await this._postSystemChatMessage(userId, chatId, payload.body);
            }
            logger.info(`[SystemMessage] Moderation action sent to ${userId}`);
        } catch (error) {
            logger.error('[SystemMessage] sendModerationAction error:', error.message);
        }
    }
}

module.exports = new SystemMessageService();
