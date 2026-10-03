'use strict';
// controllers/boost.controller.js

const boostService = require('../services/boost.service');
const logger = require('../utils/logger');

/**
 * Calculate boost strength and projected reach without charging wallet.
 */
exports.calculateBoost = async (req, res) => {
    try {
        const { budgetKes, durationDays } = req.body;
        const calculation = boostService.calculateBoostStrength(budgetKes, durationDays);
        return res.json({
            success: true,
            calculation,
        });
    } catch (err) {
        return res.status(400).json({
            success: false,
            message: err.message || 'Failed to calculate boost strength',
        });
    }
};

/**
 * Activate boost for authenticated user.
 */
exports.activateBoost = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { budgetKes, durationDays } = req.body;
        const result = await boostService.activateBoost(userId, budgetKes, durationDays);

        return res.json({
            success: true,
            message: 'Boost activated successfully!',
            boost: result,
        });
    } catch (err) {
        logger.error('[BoostController] Activate error:', err.message);
        return res.status(400).json({
            success: false,
            message: err.message || 'Failed to activate boost',
        });
    }
};

/**
 * Get active boost status for authenticated user.
 */
exports.getActiveBoost = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const activeBoost = await boostService.getActiveBoost(userId);
        return res.json({
            success: true,
            activeBoost,
        });
    } catch (err) {
        logger.error('[BoostController] Get active error:', err.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch active boost status',
        });
    }
};

/**
 * Get boost history for authenticated user.
 */
exports.getBoostHistory = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const history = await boostService.getBoostHistory(userId);
        return res.json({
            success: true,
            history,
        });
    } catch (err) {
        logger.error('[BoostController] Get history error:', err.message);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch boost history',
        });
    }
};

/**
 * Renew an existing or expired boost.
 */
exports.renewBoost = async (req, res) => {
    try {
        const userId = req.user?.user_id || req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { budgetKes, durationDays } = req.body;
        const result = await boostService.renewBoost(userId, budgetKes, durationDays);

        return res.json({
            success: true,
            message: 'Boost renewed successfully!',
            boost: result,
        });
    } catch (err) {
        logger.error('[BoostController] Renew error:', err.message);
        return res.status(400).json({
            success: false,
            message: err.message || 'Failed to renew boost',
        });
    }
};
