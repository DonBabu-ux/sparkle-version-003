'use strict';
// services/walletRecoveryScheduler.service.js
//
// Recovers wallet work that must survive a process exit:
//   - webhook events left Pending/Failed/Processing
//   - withdrawals left Pending/Processing before or after provider contact

const walletService = require('./wallet.service');
const logger = require('../utils/logger');

let schedulerInterval = null;
let running = false;

async function runRecoveryPass() {
    if (running) return;
    running = true;
    try {
        const [webhooks, withdrawals, lifecycle] = await Promise.allSettled([
            walletService.processPendingWebhookEvents(20),
            walletService.processPendingWithdrawals(20),
            walletService.runWithdrawalLifecycleSweep()
        ]);

        if (webhooks.status === 'rejected') {
            logger.error('[WalletRecovery] Webhook pass failed:', webhooks.reason?.message || webhooks.reason);
        }
        if (withdrawals.status === 'rejected') {
            logger.error('[WalletRecovery] Withdrawal pass failed:', withdrawals.reason?.message || withdrawals.reason);
        }
        if (lifecycle.status === 'rejected') {
            logger.error('[WalletRecovery] Lifecycle pass failed:', lifecycle.reason?.message || lifecycle.reason);
        }
    } finally {
        running = false;
    }
}

function startWalletRecoveryScheduler(intervalMs = 60 * 1000) {
    if (schedulerInterval) return;

    logger.info('[WalletRecovery] Starting webhook and withdrawal recovery worker (60s interval)...');

    setTimeout(() => {
        runRecoveryPass().catch((err) => logger.error('[WalletRecovery] Initial pass error:', err.message));
    }, 10000);

    schedulerInterval = setInterval(() => {
        runRecoveryPass().catch((err) => logger.error('[WalletRecovery] Periodic pass error:', err.message));
    }, intervalMs);

    if (typeof schedulerInterval.unref === 'function') schedulerInterval.unref();
}

function stopWalletRecoveryScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        logger.info('[WalletRecovery] Stopped recovery worker.');
    }
}

module.exports = {
    startWalletRecoveryScheduler,
    stopWalletRecoveryScheduler,
    runRecoveryPass
};
