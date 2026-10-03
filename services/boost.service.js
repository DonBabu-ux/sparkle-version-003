'use strict';
// services/boost.service.js
//
// Boost Connect Engine — Server Authoritative Boost Calculations & Management
//

const pool = require('../config/database');
const crypto = require('crypto');
const logger = require('../utils/logger');
const walletService = require('./wallet.service');
const systemMessageService = require('./systemMessage.service');

class BoostService {

    /**
     * Server-side calculation of boost strength & projected reach.
     * @param {number} budgetKes
     * @param {number} durationDays
     */
    calculateBoostStrength(budgetKes, durationDays) {
        const budget = Number(budgetKes);
        const days = Number(durationDays);

        if (isNaN(budget) || budget < 10) {
            throw new Error('Minimum boost budget is KES 10.00');
        }
        if (isNaN(days) || days < 1 || days > 30) {
            throw new Error('Boost duration must be between 1 and 30 days');
        }

        const dailySpend = budget / days;
        // Algorithmic multiplier formula (bounded between 1.10x and 10.00x)
        const rawStrength = 1.0 + Math.sqrt(dailySpend / 8.0);
        const boostStrength = parseFloat(Math.min(10.0, Math.max(1.1, rawStrength)).toFixed(2));

        const projectedDailyReach = Math.round(dailySpend * boostStrength * 25);
        const projectedTotalReach = projectedDailyReach * days;

        return {
            budgetKes: budget,
            durationDays: days,
            dailySpendKes: parseFloat(dailySpend.toFixed(2)),
            boostStrength,
            projectedDailyReach,
            projectedTotalReach,
        };
    }

    /**
     * Activate a new boost for a user using Creator Wallet balance.
     * @param {string} userId
     * @param {number} budgetKes
     * @param {number} durationDays
     */
    async activateBoost(userId, budgetKes, durationDays) {
        const calc = this.calculateBoostStrength(budgetKes, durationDays);
        const amountCents = Math.round(calc.budgetKes * 100);

        // 1. Deduct funds from user wallet (atomic transaction & lock)
        const paymentResult = await walletService.deductFundsForBoost(userId, amountCents, {
            durationDays: calc.durationDays,
            boostStrength: calc.boostStrength,
            budgetKes: calc.budgetKes,
        });

        // 2. Determine start and end times
        const now = new Date();
        // Check if user already has an active boost to extend
        const [activeExisting] = await pool.query(
            `SELECT boost_id, end_time FROM user_boosts 
             WHERE user_id = ? AND status = 'active' AND end_time > NOW() 
             ORDER BY end_time DESC LIMIT 1`,
            [userId]
        );

        let startTime = now;
        let endTime = new Date(now.getTime() + calc.durationDays * 24 * 60 * 60 * 1000);

        if (activeExisting.length > 0) {
            // Extend existing active boost timeline
            const existingEnd = new Date(activeExisting[0].end_time);
            if (existingEnd > now) {
                startTime = now;
                endTime = new Date(existingEnd.getTime() + calc.durationDays * 24 * 60 * 60 * 1000);
                // Mark existing boost as superseded
                await pool.query(
                    `UPDATE user_boosts SET status = 'cancelled' WHERE boost_id = ?`,
                    [activeExisting[0].boost_id]
                );
            }
        }

        const boostId = crypto.randomUUID();

        // 3. Insert new boost record
        await pool.query(
            `INSERT INTO user_boosts
                (boost_id, user_id, budget_kes, duration_days, boost_strength, start_time, end_time, status, payment_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
            [
                boostId,
                userId,
                calc.budgetKes,
                calc.durationDays,
                calc.boostStrength,
                startTime,
                endTime,
                paymentResult.reference
            ]
        );

        logger.info(`[BoostService] Activated boost ${boostId} for user ${userId} (${calc.boostStrength}x multiplier, budget KES ${calc.budgetKes})`);

        // 4. Send official Sparkle Account chat message & system notification
        setImmediate(() => {
            systemMessageService.sendBoostActivatedNotification(userId, {
                boostId,
                budgetKes: calc.budgetKes,
                durationDays: calc.durationDays,
                boostStrength: calc.boostStrength,
                endTime: endTime.toISOString(),
            }).catch(e => logger.warn('[BoostService] Failed to send activation message:', e.message));
        });

        return {
            boostId,
            userId,
            budgetKes: calc.budgetKes,
            durationDays: calc.durationDays,
            boostStrength: calc.boostStrength,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
            status: 'active',
            paymentReference: paymentResult.reference,
            projectedTotalReach: calc.projectedTotalReach,
        };
    }

    /**
     * Get active boost details for a user with calculated progress & countdown.
     * @param {string} userId
     */
    async getActiveBoost(userId) {
        const [rows] = await pool.query(
            `SELECT boost_id, budget_kes, duration_days, boost_strength, start_time, end_time, status, payment_id, created_at
             FROM user_boosts
             WHERE user_id = ? AND status = 'active' AND end_time > NOW()
             ORDER BY end_time DESC LIMIT 1`,
            [userId]
        );

        if (rows.length === 0) return null;

        const boost = rows[0];
        const now = new Date();
        const start = new Date(boost.start_time);
        const end = new Date(boost.end_time);

        const totalMs = Math.max(1, end.getTime() - start.getTime());
        const elapsedMs = Math.min(totalMs, Math.max(0, now.getTime() - start.getTime()));
        const remainingMs = Math.max(0, end.getTime() - now.getTime());

        const progressPercent = Math.min(100, parseFloat(((elapsedMs / totalMs) * 100).toFixed(1)));
        const daysRemaining = (remainingMs / (1000 * 60 * 60 * 24)).toFixed(1);

        const dailySpend = Number(boost.budget_kes) / Number(boost.duration_days);
        const projectedTotalReach = Math.round(dailySpend * Number(boost.boost_strength) * 25 * Number(boost.duration_days));

        return {
            boostId: boost.boost_id,
            budgetKes: Number(boost.budget_kes),
            durationDays: Number(boost.duration_days),
            boostStrength: Number(boost.boost_strength),
            startTime: boost.start_time,
            endTime: boost.end_time,
            serverNow: now.toISOString(),
            remainingMs,
            daysRemaining: Number(daysRemaining),
            progressPercent,
            status: boost.status,
            paymentId: boost.payment_id,
            projectedTotalReach,
        };
    }

    /**
     * Get boost history for a user.
     * @param {string} userId
     */
    async getBoostHistory(userId) {
        const [rows] = await pool.query(
            `SELECT boost_id, budget_kes, duration_days, boost_strength, start_time, end_time, status, payment_id, created_at
             FROM user_boosts
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 30`,
            [userId]
        );

        return rows.map(b => ({
            boostId: b.boost_id,
            budgetKes: Number(b.budget_kes),
            durationDays: Number(b.duration_days),
            boostStrength: Number(b.boost_strength),
            startTime: b.start_time,
            endTime: b.end_time,
            status: b.status,
            createdAt: b.created_at,
        }));
    }

    /**
     * Renew an existing or expired boost.
     * @param {string} userId
     * @param {number} budgetKes
     * @param {number} durationDays
     */
    async renewBoost(userId, budgetKes, durationDays) {
        return this.activateBoost(userId, budgetKes, durationDays);
    }
}

module.exports = new BoostService();
