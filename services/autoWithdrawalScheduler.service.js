'use strict';
// services/autoWithdrawalScheduler.service.js

const walletService = require('./wallet.service');
const logger = require('../utils/logger');

let schedulerInterval = null;

function startAutoWithdrawalScheduler(intervalMs = 15 * 60 * 1000) { // Default 15 minutes
    if (schedulerInterval) return;

    logger.info('[AutoWithdrawalScheduler] Starting periodic automated withdrawal engine (15m interval)...');
    
    // Initial check after 10s startup grace period
    setTimeout(() => {
        walletService.processAutomatedWithdrawals().catch(err => {
            logger.error('[AutoWithdrawalScheduler] Initial execution error:', err.message);
        });
    }, 10000);

    schedulerInterval = setInterval(() => {
        walletService.processAutomatedWithdrawals().catch(err => {
            logger.error('[AutoWithdrawalScheduler] Periodic execution error:', err.message);
        });
    }, intervalMs);
}

function stopAutoWithdrawalScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        logger.info('[AutoWithdrawalScheduler] Stopped automated withdrawal scheduler.');
    }
}

module.exports = {
    startAutoWithdrawalScheduler,
    stopAutoWithdrawalScheduler
};
