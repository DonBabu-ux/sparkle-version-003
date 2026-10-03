'use strict';
// services/boostScheduler.service.js
//
// Background worker monitoring boost expirations and sending idempotent 2-day / 1-day reminders.
//

const pool = require('../config/database');
const crypto = require('crypto');
const logger = require('../utils/logger');
const systemMessageService = require('./systemMessage.service');

let schedulerTimer = null;

async function processBoostExpirationsAndReminders() {
    try {
        // ── 1. Process Expirations (end_time <= NOW() & status = 'active') ──────────
        const [expiredBoosts] = await pool.query(
            `SELECT boost_id, user_id, budget_kes, duration_days, boost_strength, start_time, end_time
             FROM user_boosts
             WHERE status = 'active' AND end_time <= NOW()`
        );

        for (const boost of expiredBoosts) {
            try {
                // Update status to expired
                await pool.query(
                    `UPDATE user_boosts SET status = 'expired', updated_at = NOW() WHERE boost_id = ?`,
                    [boost.boost_id]
                );

                // Insert idempotency reminder record
                const reminderId = crypto.randomUUID();
                await pool.query(
                    `INSERT IGNORE INTO boost_reminders (id, boost_id, reminder_type) VALUES (?, ?, 'expired')`,
                    [reminderId, boost.boost_id]
                );

                logger.info(`[BoostScheduler] Expired boost ${boost.boost_id} for user ${boost.user_id}`);

                // Send Sparkle Account chat message & notification
                systemMessageService.sendBoostExpiredNotification(boost.user_id, {
                    boostId: boost.boost_id,
                    budgetKes: Number(boost.budget_kes),
                    durationDays: Number(boost.duration_days),
                    boostStrength: Number(boost.boost_strength),
                }).catch(e => logger.warn('[BoostScheduler] Failed to send expiration notification:', e.message));

            } catch (err) {
                logger.error(`[BoostScheduler] Error expiring boost ${boost.boost_id}:`, err.message);
            }
        }

        // ── 2. Process 1-Day Reminders (ending in <= 24h) ───────────────────────────
        const [oneDayReminders] = await pool.query(
            `SELECT b.boost_id, b.user_id, b.budget_kes, b.duration_days, b.boost_strength, b.end_time
             FROM user_boosts b
             LEFT JOIN boost_reminders r ON b.boost_id = r.boost_id AND r.reminder_type = '1_day'
             WHERE b.status = 'active'
               AND b.end_time <= DATE_ADD(NOW(), INTERVAL 1 DAY)
               AND b.end_time > NOW()
               AND r.id IS NULL`
        );

        for (const boost of oneDayReminders) {
            try {
                const reminderId = crypto.randomUUID();
                const [inserted] = await pool.query(
                    `INSERT IGNORE INTO boost_reminders (id, boost_id, reminder_type) VALUES (?, ?, '1_day')`,
                    [reminderId, boost.boost_id]
                );

                if (inserted.affectedRows > 0) {
                    logger.info(`[BoostScheduler] Sent 1-day reminder for boost ${boost.boost_id}`);
                    systemMessageService.sendBoostReminderNotification(boost.user_id, {
                        boostId: boost.boost_id,
                        reminderType: '1_day',
                        daysLeft: 1,
                        budgetKes: Number(boost.budget_kes),
                        boostStrength: Number(boost.boost_strength),
                        endTime: boost.end_time,
                    }).catch(e => logger.warn('[BoostScheduler] Reminder notice failed:', e.message));
                }
            } catch (err) {
                logger.error(`[BoostScheduler] Error processing 1-day reminder for ${boost.boost_id}:`, err.message);
            }
        }

        // ── 3. Process 2-Day Reminders (ending in <= 48h and > 24h) ──────────────────
        const [twoDayReminders] = await pool.query(
            `SELECT b.boost_id, b.user_id, b.budget_kes, b.duration_days, b.boost_strength, b.end_time
             FROM user_boosts b
             LEFT JOIN boost_reminders r ON b.boost_id = r.boost_id AND r.reminder_type = '2_day'
             WHERE b.status = 'active'
               AND b.end_time <= DATE_ADD(NOW(), INTERVAL 2 DAY)
               AND b.end_time > DATE_ADD(NOW(), INTERVAL 1 DAY)
               AND r.id IS NULL`
        );

        for (const boost of twoDayReminders) {
            try {
                const reminderId = crypto.randomUUID();
                const [inserted] = await pool.query(
                    `INSERT IGNORE INTO boost_reminders (id, boost_id, reminder_type) VALUES (?, ?, '2_day')`,
                    [reminderId, boost.boost_id]
                );

                if (inserted.affectedRows > 0) {
                    logger.info(`[BoostScheduler] Sent 2-day reminder for boost ${boost.boost_id}`);
                    systemMessageService.sendBoostReminderNotification(boost.user_id, {
                        boostId: boost.boost_id,
                        reminderType: '2_day',
                        daysLeft: 2,
                        budgetKes: Number(boost.budget_kes),
                        boostStrength: Number(boost.boost_strength),
                        endTime: boost.end_time,
                    }).catch(e => logger.warn('[BoostScheduler] Reminder notice failed:', e.message));
                }
            } catch (err) {
                logger.error(`[BoostScheduler] Error processing 2-day reminder for ${boost.boost_id}:`, err.message);
            }
        }

    } catch (err) {
        logger.error('[BoostScheduler] Execution error:', err.message);
    }
}

function startBoostScheduler(intervalMs = 10 * 60 * 1000) { // Default 10 minutes
    if (schedulerTimer) {
        logger.info('[BoostScheduler] Scheduler already running.');
        return;
    }

    logger.info('[BoostScheduler] Starting periodic boost expiration & reminder engine (10m interval)...');

    // Run initial scan after 5 seconds
    setTimeout(() => {
        processBoostExpirationsAndReminders().catch(err => {
            logger.error('[BoostScheduler] Initial execution error:', err.message);
        });
    }, 5000);

    schedulerTimer = setInterval(() => {
        processBoostExpirationsAndReminders().catch(err => {
            logger.error('[BoostScheduler] Periodic execution error:', err.message);
        });
    }, intervalMs);
}

function stopBoostScheduler() {
    if (schedulerTimer) {
        clearInterval(schedulerTimer);
        schedulerTimer = null;
        logger.info('[BoostScheduler] Stopped boost scheduler.');
    }
}

module.exports = {
    startBoostScheduler,
    stopBoostScheduler,
    processBoostExpirationsAndReminders
};
