// services/userBootstrap.service.js
// Centralised first-run setup for brand-new accounts.
//
// Called synchronously after signup so the user's Messages, Notifications,
// and Onboarding state are fully initialised before the auth response is returned.
//
// Every operation is **idempotent**: re-calling bootstrapNewUser(userId) is safe.
//
// Delegates all official messaging to SystemMessageService.

const { safeQuery } = require('../config/database');
const logger = require('../utils/logger');

// Lazy-load to avoid circular dependency at module parse time
let _systemMessageService = null;
function getSystemMessageService() {
    if (!_systemMessageService) {
        _systemMessageService = require('./systemMessage.service');
    }
    return _systemMessageService;
}

// ── Service ──────────────────────────────────────────────────────────────────

class UserBootstrapService {

    /**
     * Run the complete first-run bootstrap for a new user.
     * Safe to call multiple times — all steps are idempotent.
     *
     * @param {string} userId   The newly created user's ID
     * @param {object} opts     Optional hints: { userName }
     * @returns {Promise<{ conversationId: string|null, notificationCreated: boolean, onboardingInitialised: boolean }>}
     */
    async bootstrapNewUser(userId, opts = {}) {
        const result = {
            conversationId: null,
            notificationCreated: false,
            onboardingInitialised: false,
        };

        try {
            const sms = getSystemMessageService();

            // 1. Ensure system conversation exists (idempotent)
            result.conversationId = await sms.ensureSystemConversation(userId);

            // 2. Send welcome notification + chat message via SystemMessageService
            //    Internally idempotent — skips if welcome already sent
            const userName = opts.userName || opts.name || opts.displayName || 'there';
            await sms.sendWelcome(userId, { userName });
            result.notificationCreated = true;

            // 3. Initialise onboarding state
            result.onboardingInitialised = await this._initOnboardingState(userId);

            // 4. Queue analytics (fire-and-forget)
            this._logBootstrapAnalytics(userId).catch(() => {});

            logger.info(`[Bootstrap] Successfully bootstrapped user ${userId}`);
        } catch (error) {
            // Bootstrap errors must never block signup
            logger.error(`[Bootstrap] Error bootstrapping user ${userId}:`, error.message);
        }

        return result;
    }

    // ── Onboarding state ─────────────────────────────────────────────────────

    async _initOnboardingState(userId) {
        try {
            await safeQuery(
                `UPDATE users
                 SET onboarding_step = COALESCE(onboarding_step, 0)
                 WHERE user_id = ? AND onboarding_step IS NULL`,
                [userId]
            );
            return true;
        } catch (error) {
            logger.warn('[Bootstrap] Onboarding state init error:', error.message);
            return false;
        }
    }

    // ── Analytics ────────────────────────────────────────────────────────────

    async _logBootstrapAnalytics(userId) {
        try {
            const { logEvent } = require('../utils/analytics');
            await logEvent('user_bootstrapped', userId, {
                timestamp: new Date().toISOString(),
            });
        } catch (_) {
            // Non-critical — swallow silently
        }
    }
}

module.exports = new UserBootstrapService();
