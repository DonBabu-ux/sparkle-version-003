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
const welcomeTemplate              = require('./notifications/templates/welcome');
const loginAlertTemplate           = require('./notifications/templates/loginAlert');
const passwordChangedTemplate      = require('./notifications/templates/passwordChanged');
const verificationTemplate         = require('./notifications/templates/verificationSuccess');
const featureTemplate              = require('./notifications/templates/featureAnnouncement');
const securityAlertTemplate        = require('./notifications/templates/securityAlert');
const maintenanceTemplate          = require('./notifications/templates/maintenanceNotice');
const moderationTemplate           = require('./notifications/templates/moderationAction');
const walletDepositTemplate        = require('./notifications/templates/walletDepositSuccess');
const walletWithdrawalTemplate     = require('./notifications/templates/walletWithdrawalStatus');
const revenueEarnedTemplate        = require('./notifications/templates/revenueEarned');

// ── Constants ─────────────────────────────────────────────────────────────────
const SYSTEM_USER_ID = process.env.SPARKLE_SYSTEM_USER_ID || 'd75fe3b5-7a45-4581-ab13-91934d8b54de';

// ─────────────────────────────────────────────────────────────────────────────

class SystemMessageService {

    // ── Core: ensure system users exist ───────────────────────────────────────
    async _ensureSystemUser() {
        try {
            const { OFFICIAL_ECOSYSTEM_ACCOUNTS } = require('../helpers/systemAccount.helper');
            for (const accKey of Object.keys(OFFICIAL_ECOSYSTEM_ACCOUNTS)) {
                const acc = OFFICIAL_ECOSYSTEM_ACCOUNTS[accKey];
                const rows = await safeQuery('SELECT user_id FROM users WHERE user_id = ? OR username = ? LIMIT 1', [acc.id, acc.username]);
                if (rows.length === 0) {
                    await safeQuery(
                        `INSERT INTO users
                           (user_id, name, username, email, password_hash, user_type, account_type, account_status, is_verified, onboarding_step, bio)
                         VALUES (?, ?, ?, ?, 'NO_LOGIN', 'system', 'system', 'active', 1, 6, ?)`,
                        [acc.id, acc.name, acc.username, `${acc.username}@sparkle.app`, acc.bio]
                    );
                }
            }
            logger.info('[SystemMessage] Official ecosystem users verified.');
        } catch (e) {
            if (e.code !== 'ER_DUP_ENTRY') {
                logger.warn('[SystemMessage] Could not ensure system users:', e.message);
            }
        }
    }

    // ── Core: ensure system conversation exists for user ─────────────────────
    async ensureSystemConversation(userId, systemId = SYSTEM_USER_ID) {
        try {
            const existing = await safeQuery(
                `SELECT chat_id FROM personal_chats
                 WHERE ((participant1_id = ? AND participant2_id = ?)
                     OR (participant1_id = ? AND participant2_id = ?))
                   AND marketplace_listing_id IS NULL
                 LIMIT 1`,
                [systemId, userId, userId, systemId]
            );

            if (existing.length > 0) return existing[0].chat_id;

            await this._ensureSystemUser();

            const chatId = crypto.randomUUID();
            await safeQuery(
                `INSERT INTO personal_chats
                   (chat_id, participant1_id, participant2_id, marketplace_listing_id, conversation_type, last_message_time)
                 VALUES (?, ?, ?, NULL, 'system', NOW())`,
                [chatId, systemId, userId]
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
    async _postSystemChatMessage(userId, chatId, content, opts = {}) {
        try {
            const {
                category = 'announcement',
                type = 'system',
                senderId = SYSTEM_USER_ID,
                payload = null,
                publishAt = null,
                expiresAt = null
            } = opts;

            const msgId = crypto.randomUUID();
            await safeQuery(
                `INSERT INTO messages
                   (message_id, conversation_id, sender_id, content, type, context, message_category, payload, publish_at, expires_at, is_read, sent_at)
                 VALUES (?, ?, ?, ?, ?, 'system', ?, ?, ?, ?, 0, NOW())`,
                [
                    msgId, chatId, senderId, content, 
                    type, category, 
                    payload ? JSON.stringify(payload) : null, 
                    publishAt, expiresAt
                ]
            );

            // Update conversation last_message_time & conversation_type
            await safeQuery(
                'UPDATE personal_chats SET last_message_time = NOW(), conversation_type = "system" WHERE chat_id = ?',
                [chatId]
            );

            return msgId;
        } catch (error) {
            logger.error('[SystemMessage] _postSystemChatMessage error:', error.message);
            return null;
        }
    }

    /**
     * Get JSON-driven Welcome Cards for onboarding / dashboard
     */
    getWelcomeCards() {
        return [
            {
                id: 'card-1',
                title: 'Create Your First Spark',
                description: 'Share a story, upload a moment, or post an update to introduce yourself to your campus.',
                icon: 'Sparkles',
                route: '/moments',
                buttonText: 'Create Spark',
                buttonStyle: 'primary',
                priority: 1
            },
            {
                id: 'card-2',
                title: 'Discover Campus Creators',
                description: 'Connect with students in your major, join popular campus hubs, and build your social graph.',
                icon: 'Users',
                route: '/connect',
                buttonText: 'Explore People',
                buttonStyle: 'secondary',
                priority: 2
            },
            {
                id: 'card-3',
                title: 'Check Campus Marketplace',
                description: 'Buy & sell textbooks, gadgets, and dorm gear safely with fellow verified students.',
                icon: 'ShoppingBag',
                route: '/marketplace',
                buttonText: 'Open Marketplace',
                buttonStyle: 'secondary',
                priority: 3
            },
            {
                id: 'card-4',
                title: 'Privacy & Security Check',
                description: 'Review your account visibility, two-factor settings, and active login sessions.',
                icon: 'ShieldCheck',
                route: '/settings?tab=privacy',
                buttonText: 'Privacy Settings',
                buttonStyle: 'ghost',
                priority: 4
            }
        ];
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

    /**
     * Send a rich wallet notification.
     * @param {string} userId
     * @param {object} opts
     * @param {string}  opts.txnType     'deposit' | 'withdrawal' | 'revenue' | 'revenue_update'
     * @param {number}  opts.amountCents  Integer cents (e.g. 50000 = KES 500.00)
     * @param {string}  [opts.currency]  Default 'KES'
     * @param {string}  [opts.status]    For withdrawal: 'Pending' | 'Completed' | 'Failed'
     * @param {string}  [opts.reference] Paystack ref or withdrawal ID
     * @param {string}  [opts.source]    For revenue: 'AdRevenue' | 'Tip' | etc.
     * @param {string}  [opts.period]    For revenue: 'today' | 'this week'
     */
    async sendWalletNotification(userId, opts = {}) {
        try {
            const {
                txnType, amountCents = 0, currency = 'KES',
                status = 'Pending', reference = '', source = 'Revenue', period = 'today',
                // Legacy support (if amount passed instead of amountCents)
                amount
            } = opts;

            // Support legacy callers that pass `amount` as a KES float
            const cents = amountCents || (amount ? Math.round(parseFloat(amount) * 100) : 0);

            let payload;
            if (txnType === 'deposit') {
                payload = walletDepositTemplate({ amountCents: cents, currency, reference });
            } else if (txnType === 'withdrawal') {
                payload = walletWithdrawalTemplate({ amountCents: cents, currency, status, reference });
            } else {
                // Revenue, tips, boosts, ads, etc.
                payload = revenueEarnedTemplate({ amountCents: cents, currency, source, period });
            }

            await this._saveNotification(userId, payload);

            const chatId = await this.ensureSystemConversation(userId);
            if (chatId) {
                await this._postSystemChatMessage(userId, chatId, payload.body);
            }
            logger.info(`[SystemMessage] Wallet notification (${txnType}) sent to ${userId}`);
        } catch (error) {
            logger.error('[SystemMessage] sendWalletNotification error:', error.message);
        }
    }

    /**
     * Send Sparkle Account notification & chat update when boost is activated.
     */
    async sendBoostActivatedNotification(userId, data = {}) {
        try {
            const { budgetKes, durationDays, boostStrength, endTime } = data;
            const endDateFormatted = new Date(endTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
            const messageText = `⚡ Sparkle Boost Activated!\n\nYour profile and content are now amplified with a ${boostStrength}× reach multiplier for the next ${durationDays} day(s).\n\n• Budget: KES ${Number(budgetKes).toFixed(2)}\n• Duration: ${durationDays} day(s)\n• Expires: ${endDateFormatted}\n\nTrack real-time performance inside your Professional Dashboard.`;

            const payload = {
                title: '⚡ Sparkle Boost Active',
                body: messageText,
                category: 'boost',
                type: 'BOOST_ACTIVATED',
                data: { ...data, actionUrl: '/professional-dashboard' }
            };

            await this._saveNotification(userId, payload);
            const chatId = await this.ensureSystemConversation(userId);
            if (chatId) {
                await this._postSystemChatMessage(userId, chatId, messageText);
            }
            logger.info(`[SystemMessage] Boost activation message sent to ${userId}`);
        } catch (error) {
            logger.error('[SystemMessage] sendBoostActivatedNotification error:', error.message);
        }
    }

    /**
     * Send Sparkle Account notification & chat update when boost is expiring soon.
     */
    async sendBoostReminderNotification(userId, data = {}) {
        try {
            const { daysLeft, boostStrength, endTime } = data;
            const endDateFormatted = new Date(endTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            const messageText = `⏳ Sparkle Boost Ending Soon!\n\nYour ${boostStrength}× boost status has ${daysLeft} day(s) remaining (expires ${endDateFormatted}).\n\nTo maintain peak content reach without interruption, visit your Professional Dashboard to renew your campaign.`;

            const payload = {
                title: `⏳ ${daysLeft} Day(s) Left on Sparkle Boost`,
                body: messageText,
                category: 'boost',
                type: 'BOOST_REMINDER',
                data: { ...data, actionUrl: '/professional-dashboard' }
            };

            await this._saveNotification(userId, payload);
            const chatId = await this.ensureSystemConversation(userId);
            if (chatId) {
                await this._postSystemChatMessage(userId, chatId, messageText);
            }
            logger.info(`[SystemMessage] Boost ${daysLeft}-day reminder sent to ${userId}`);
        } catch (error) {
            logger.error('[SystemMessage] sendBoostReminderNotification error:', error.message);
        }
    }

    /**
     * Send Sparkle Account notification & chat update when boost has expired.
     */
    async sendBoostExpiredNotification(userId, data = {}) {
        try {
            const { boostStrength } = data;
            const messageText = `🏁 Sparkle Boost Expired\n\nYour previous ${boostStrength}× reach boost campaign has completed. Your content reach has returned to standard baseline distribution.\n\nReady to launch your next boost? Re-ignite your reach inside the Boost Hub!`;

            const payload = {
                title: '🏁 Sparkle Boost Expired',
                body: messageText,
                category: 'boost',
                type: 'BOOST_EXPIRED',
                data: { ...data, actionUrl: '/professional-dashboard' }
            };

            await this._saveNotification(userId, payload);
            const chatId = await this.ensureSystemConversation(userId);
            if (chatId) {
                await this._postSystemChatMessage(userId, chatId, messageText);
            }
            logger.info(`[SystemMessage] Boost expiration message sent to ${userId}`);
        } catch (error) {
            logger.error('[SystemMessage] sendBoostExpiredNotification error:', error.message);
        }
    }
}

module.exports = new SystemMessageService();
