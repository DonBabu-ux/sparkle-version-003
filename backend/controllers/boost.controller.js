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
        // Operational (validation) rejections keep their message; a driver
        // fault is a 500 with a fixed message — answering it as a 400 with
        // err.message both misclassifies the failure and leaks SQL internals.
        if (err && err.isOperational) {
            return res.status(400).json({ success: false, message: err.message });
        }
        logger.error('[BoostController] Calculate error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to calculate boost strength',
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
        if (err && err.isOperational) {
            return res.status(400).json({ success: false, message: err.message });
        }
        logger.error('[BoostController] Activate error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to activate boost',
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
        if (err && err.isOperational) {
            return res.status(400).json({ success: false, message: err.message });
        }
        logger.error('[BoostController] Renew error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to renew boost',
        });
    }
};
