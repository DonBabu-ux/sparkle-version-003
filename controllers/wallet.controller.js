'use strict';
// controllers/wallet.controller.js
//
// REST API for Sparkle Creator Wallet.
//
// Endpoints:
//   GET  /api/wallet                  – wallet summary + recent transactions
//   GET  /api/wallet/history          – paginated, filterable transaction list
//   POST /api/wallet/deposit          – initialise Paystack transaction
//   POST /api/wallet/verify           – (frontend callback) verify by ref (secondary path)
//   POST /api/wallet/withdraw         – request withdrawal
//   GET  /api/wallet/banks            – list of supported banks
//   POST /api/wallet/resolve-account  – validate bank account
//   POST /api/wallet/webhook/paystack – Paystack webhook (public, HMAC-verified)
//
// Security rules:
//   - Never trust frontend amounts — always use server-verified cents.
//   - All balance mutations happen in the service layer inside DB transactions.
//   - The webhook is the SINGLE source of truth for payment confirmation.
//   - verifyDeposit (frontend path) re-routes through the same processDepositConfirmation.

const walletService = require('../services/wallet.service');
const paystackService = require('../services/paystack.service');
const pool = require('../config/database');
const logger = require('../utils/logger');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse and validate a deposit/withdrawal amount from the request body.
 * Accepts either:
 *   - amountCents (integer, already in cents)
 *   - amount (float in KES, converted to cents)
 * Returns integer cents or throws.
 */
function parseAmountCents(body) {
    if (body.amountCents !== undefined) {
        const c = parseInt(body.amountCents, 10);
        if (!Number.isInteger(c) || c <= 0) throw new Error('amountCents must be a positive integer');
        return c;
    }
    if (body.amount !== undefined) {
        const kes = parseFloat(body.amount);
        if (isNaN(kes) || kes <= 0) throw new Error('amount must be a positive number');
        return Math.round(kes * 100);
    }
    throw new Error('amount or amountCents is required');
}

// ── GET /api/wallet ───────────────────────────────────────────────────────────

exports.getWallet = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const summary = await walletService.getWalletSummary(userId);
        const history = await walletService.getTransactions(userId, { page: 1, limit: 10 });

        res.json({
            success: true,
            wallet: summary,
            ...history,
        });
    } catch (err) {
        logger.error('[WalletController] getWallet:', err.message);
        res.status(500).json({ success: false, message: 'Failed to load wallet' });
    }
};

// ── GET /api/wallet/history ───────────────────────────────────────────────────

exports.getHistory = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { page = 1, limit = 20, type, status } = req.query;
        const data = await walletService.getTransactions(userId, { page, limit, type, status });
        res.json({ success: true, ...data });
    } catch (err) {
        logger.error('[WalletController] getHistory:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch transaction history' });
    }
};

// ── POST /api/wallet/deposit ──────────────────────────────────────────────────

exports.initializeDeposit = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const email = req.user.email || `${req.user.username || 'creator'}_${userId.slice(0, 8)}@sparkleapp.com`;
        const { method = 'card', phone } = req.body;

        const amountCents = parseAmountCents(req.body);

        const VALID_METHODS = ['card', 'bank', 'mpesa', 'ussd'];
        if (!VALID_METHODS.includes(method)) {
            return res.status(400).json({ success: false, message: `Invalid payment method. Choose: ${VALID_METHODS.join(', ')}` });
        }
        if (method === 'mpesa' && !phone) {
            return res.status(400).json({ success: false, message: 'phone is required for M-Pesa deposits' });
        }

        const result = await walletService.initializeDeposit(userId, amountCents, email, method, phone);
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error('[WalletController] initializeDeposit:', err.message);
        res.status(400).json({ success: false, message: err.message || 'Failed to initialize deposit' });
    }
};

// ── POST /api/wallet/verify ───────────────────────────────────────────────────
// Secondary verification path (frontend callback after Paystack redirect).
// Webhook is authoritative — this is a UX convenience route.

exports.verifyDeposit = async (req, res) => {
    try {
        const { reference } = req.body;
        if (!reference || typeof reference !== 'string') {
            return res.status(400).json({ success: false, message: 'reference is required' });
        }

        const result = await walletService.processDepositConfirmation(reference);
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error('[WalletController] verifyDeposit:', err.message);
        res.status(500).json({ success: false, message: err.message || 'Verification failed' });
    }
};

// ── POST /api/wallet/withdraw ─────────────────────────────────────────────────

exports.requestWithdrawal = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { method = 'bank', phone, accountName, accountNumber, bankCode } = req.body;
        const amountCents = parseAmountCents(req.body);

        const VALID_METHODS = ['bank', 'mpesa'];
        if (!VALID_METHODS.includes(method)) {
            return res.status(400).json({ success: false, message: 'method must be bank or mpesa' });
        }
        if (method === 'mpesa' && !phone) {
            return res.status(400).json({ success: false, message: 'phone is required for M-Pesa withdrawals' });
        }
        if (method === 'bank' && (!accountNumber || !bankCode || !accountName)) {
            return res.status(400).json({ success: false, message: 'accountName, accountNumber, and bankCode are required for bank withdrawals' });
        }

        const result = await walletService.requestWithdrawal(userId, amountCents, method, {
            accountName, accountNumber, bankCode, phone,
        });
        res.json({ success: true, ...result });
    } catch (err) {
        logger.error('[WalletController] requestWithdrawal:', err.message);
        res.status(400).json({ success: false, message: err.message || 'Withdrawal request failed' });
    }
};

// ── GET /api/wallet/banks ─────────────────────────────────────────────────────

exports.fetchBanks = async (req, res) => {
    try {
        const data = await walletService.fetchBanks();
        res.json({ success: true, banks: data.data || [] });
    } catch (err) {
        logger.error('[WalletController] fetchBanks:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch banks' });
    }
};

// ── POST /api/wallet/resolve-account ─────────────────────────────────────────

exports.resolveAccount = async (req, res) => {
    try {
        const { accountNumber, bankCode } = req.body;
        if (!accountNumber || !bankCode) {
            return res.status(400).json({ success: false, message: 'accountNumber and bankCode are required' });
        }
        const data = await walletService.resolveAccount(accountNumber, bankCode);
        res.json({ success: true, accountDetails: data.data || null });
    } catch (err) {
        logger.error('[WalletController] resolveAccount:', err.message);
        res.status(400).json({ success: false, message: err.message || 'Account resolution failed' });
    }
};

// ── POST /api/wallet/webhook/paystack ─────────────────────────────────────────
// IMPORTANT: This endpoint must receive the raw body for HMAC verification.
// The body is also verified against wallet_webhook_log for idempotency.

exports.handleWebhook = async (req, res) => {
    const signature = req.headers['x-paystack-signature'];
    if (!signature) {
        logger.warn('[WalletWebhook] Missing x-paystack-signature header');
        return res.status(401).json({ message: 'Missing signature' });
    }

    // Verify HMAC signature using raw body (req.rawBody set by server.js)
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const isValid = paystackService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
        logger.warn('[WalletWebhook] Signature verification FAILED');
        return res.status(401).json({ message: 'Invalid signature' });
    }

    // Acknowledge immediately (Paystack expects 200 within 5s)
    res.status(200).json({ received: true });

    // Process asynchronously
    const event = req.body;
    const eventType = event.event;
    const reference = event.data?.reference;

    if (!reference) {
        logger.warn('[WalletWebhook] No reference in payload:', eventType);
        return;
    }

    logger.info(`[WalletWebhook] Event: ${eventType} | Ref: ${reference}`);

    if (eventType === 'charge.success') {
        // Idempotency check
        const isNew = await walletService.markWebhookProcessed(reference, eventType).catch(() => false);
        if (!isNew) {
            logger.info(`[WalletWebhook] Duplicate event skipped: ${reference}`);
            return;
        }
        try {
            const result = await walletService.processDepositConfirmation(reference);
            logger.info(`[WalletWebhook] Deposit processed: ${reference} → ${result.status}`);
        } catch (err) {
            logger.error(`[WalletWebhook] Error processing charge.success for ${reference}:`, err.message);
        }
    } else if (eventType === 'charge.failed') {
        try {
            await pool.query(
                "UPDATE wallet_deposits SET status = 'Failed' WHERE paystack_ref = ?",
                [reference]
            );
            logger.info(`[WalletWebhook] Deposit marked as Failed for reference: ${reference}`);
        } catch (err) {
            logger.error(`[WalletWebhook] Error processing charge.failed for ${reference}:`, err.message);
        }
    } else if (eventType === 'transfer.success') {
        logger.info(`[WalletWebhook] Transfer success for ref: ${reference}`);
        // Update withdrawal status
        try {
            await pool.query(
                `UPDATE wallet_withdrawals
                 SET status = 'Completed', processed_at = NOW()
                 WHERE paystack_transfer = ? OR withdrawal_id = ?`,
                [event.data?.transfer_code, reference]
            );
            await pool.query(
                "UPDATE wallet_transactions SET status = 'Completed' WHERE reference = ? AND type = 'Withdrawal'",
                [reference]
            );
        } catch (e) {
            logger.error('[WalletWebhook] transfer.success update failed:', e.message);
        }
    } else if (eventType === 'transfer.failed' || eventType === 'transfer.reversed') {
        logger.warn(`[WalletWebhook] Transfer failed/reversed: ${reference}`);
        // Handled by _executePaystackTransfer's catch block
    }
    // Other events acknowledged but not processed
};
