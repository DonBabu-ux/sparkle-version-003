'use strict';
// services/wallet.service.js
//
// Financial core of Sparkle.
//
// Design rules:
//   - All monetary amounts are stored as integer cents (BIGINT in DB).
//     KES 100.50 → 10050.  Never use floats.
//   - Every balance update uses a DB transaction with FOR UPDATE locking.
//   - Webhook processing uses wallet_webhook_log for idempotency.
//   - The wallet column `available_balance` is the source of truth.
//     wallet_transactions is the immutable ledger — never DELETE rows there.
//   - All public methods return amounts as integer cents.
//     Frontend must divide by 100 to display.

const pool = require('../config/database');
const crypto = require('crypto');
const logger = require('../utils/logger');
const paystackService = require('./paystack.service');
const systemMessageService = require('./systemMessage.service');

// Supported transaction types (mirrors DB ENUM)
const TXN_TYPES = {
    DEPOSIT:          'Deposit',
    WITHDRAWAL:       'Withdrawal',
    REVENUE:          'Revenue',
    PURCHASE:         'Purchase',
    REFUND:           'Refund',
    SUBSCRIPTION:     'Subscription',
    TIP:              'Tip',
    BOOST_PURCHASE:   'BoostPurchase',
    BOOST_SPEND:      'BoostSpend',
    AD_REVENUE:       'AdRevenue',
    CREATOR_PAYMENT:  'CreatorPayment',
    TRANSFER:         'Transfer',
};

const TXN_STATUS = {
    PENDING:   'Pending',
    COMPLETED: 'Completed',
    FAILED:    'Failed',
    REFUNDED:  'Refunded',
};

function normalizeKenyanPhone(num) {
    if (!num) return '';
    let cleaned = num.trim().replace(/[\s-()]/g, '');
    if (cleaned.startsWith('+254')) return cleaned;
    if (cleaned.startsWith('254')) return '+' + cleaned;
    if (cleaned.startsWith('07') || cleaned.startsWith('01')) return '+254' + cleaned.slice(1);
    if ((cleaned.startsWith('7') || cleaned.startsWith('1')) && cleaned.length === 9) return '+254' + cleaned;
    return cleaned;
}

class WalletService {

    // ── Wallet Provisioning ───────────────────────────────────────────────────

    /**
     * Ensure a user wallet exists. Creates one if missing (idempotent).
     * Returns the wallet_id.
     */
    async getOrCreateWallet(userId) {
        const [rows] = await pool.query(
            'SELECT wallet_id FROM wallets WHERE user_id = ? LIMIT 1',
            [userId]
        );
        if (rows.length > 0) return rows[0].wallet_id;

        const walletId = crypto.randomUUID();
        try {
            await pool.query(
                `INSERT INTO wallets (wallet_id, user_id, currency, available_balance, pending_balance,
                    lifetime_deposits, lifetime_withdrawals, lifetime_earnings)
                 VALUES (?, ?, 'KES', 0, 0, 0, 0, 0)`,
                [walletId, userId]
            );
            return walletId;
        } catch (err) {
            // Race condition — query again
            if (err.code === 'ER_DUP_ENTRY') {
                const [retry] = await pool.query(
                    'SELECT wallet_id FROM wallets WHERE user_id = ? LIMIT 1',
                    [userId]
                );
                return retry[0].wallet_id;
            }
            throw err;
        }
    }

    // ── Balance ───────────────────────────────────────────────────────────────

    /**
     * Get full wallet summary for a user.
     * All monetary values returned as integer cents.
     */
    async getWalletSummary(userId) {
        await this.getOrCreateWallet(userId);
        const [rows] = await pool.query(
            `SELECT w.wallet_id, w.currency,
                    w.available_balance, w.pending_balance,
                    w.lifetime_deposits, w.lifetime_withdrawals, w.lifetime_earnings,
                    w.created_at, w.updated_at
             FROM wallets w
             WHERE w.user_id = ? LIMIT 1`,
            [userId]
        );
        return rows[0] || null;
    }

    // ── Transaction History ───────────────────────────────────────────────────

    /**
     * Paginated transaction history for a user.
     * @param {string}  userId
     * @param {object}  opts  { page, limit, type, status }
     */
    async getTransactions(userId, opts = {}) {
        const walletId = await this.getOrCreateWallet(userId);
        const { page = 1, limit = 20, type = null, status = null } = opts;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const conditions = ['wallet_id = ?'];
        const params = [walletId];
        if (type) { conditions.push('type = ?'); params.push(type); }
        if (status) { conditions.push('status = ?'); params.push(status); }

        const where = conditions.join(' AND ');

        const [txns] = await pool.query(
            `SELECT transaction_id, reference, type, status, amount, currency, payment_provider, metadata, created_at
             FROM wallet_transactions
             WHERE ${where}
             ORDER BY created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), offset]
        );
        const [[{ total }]] = await pool.query(
            `SELECT COUNT(*) as total FROM wallet_transactions WHERE ${where}`,
            params
        );

        return {
            transactions: txns,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        };
    }

    // ── Deposits ──────────────────────────────────────────────────────────────

    /**
     * Initialise a Paystack deposit.
     * @param {string}  userId
     * @param {number}  amountCents   Integer cents (e.g. 50000 = KES 500)
     * @param {string}  email         User email for Paystack
     * @param {string}  method        'card' | 'bank' | 'mpesa' | 'ussd'
     * @param {string}  [phone]       Required for mpesa
     */
    async initializeDeposit(userId, amountCents, email, method = 'card', phone = null) {
        if (!Number.isInteger(amountCents) || amountCents <= 0) {
            throw new Error('Amount must be a positive integer (cents)');
        }
        if (amountCents < 100) { // minimum KES 1 (1 bob)
            throw new Error('Minimum deposit is KES 1.00 (1 bob)');
        }

        const walletId = await this.getOrCreateWallet(userId);
        const reference = `SPK_DEP_${crypto.randomBytes(10).toString('hex').toUpperCase()}`;
        const depositId = crypto.randomUUID();
        const normalizedPhone = phone ? normalizeKenyanPhone(phone) : null;

        // Persist pending deposit record first
        await pool.query(
            `INSERT INTO wallet_deposits
                (deposit_id, wallet_id, paystack_ref, amount_cents, currency, method, phone, status)
             VALUES (?, ?, ?, ?, 'KES', ?, ?, 'Pending')`,
            [depositId, walletId, reference, amountCents, method, normalizedPhone || null]
        );

        const metadata = { depositId, userId, method, reference };

        let paystackResult;
        if (method === 'mpesa') {
            if (!normalizedPhone) throw new Error('Phone number required for M-Pesa deposits');
            paystackResult = await paystackService.chargeMobileMoney(
                amountCents, email, normalizedPhone, 'mpesa', reference, metadata
            );
            return {
                depositId,
                reference,
                method,
                status: 'Pending',
                chargeResponse: paystackResult.data,
            };
        } else {
            paystackResult = await paystackService.initializeTransaction(
                amountCents, email, reference, metadata
            );
            return {
                depositId,
                reference,
                method,
                status: 'Pending',
                authorizationUrl: paystackResult.data.authorization_url,
                accessCode: paystackResult.data.access_code,
            };
        }
    }

    /**
     * Credit wallet after a confirmed deposit.
     * This is the ONLY place that calls verifyTransaction with Paystack.
     * It is idempotent — safe to call multiple times for the same reference.
     * @param {string} reference  Paystack transaction reference
     * @returns {object} { status, walletSummary }
     */
    async processDepositConfirmation(reference) {
        // Find the deposit record
        const [deposits] = await pool.query(
            'SELECT * FROM wallet_deposits WHERE paystack_ref = ? LIMIT 1',
            [reference]
        );
        if (deposits.length === 0) {
            logger.warn(`[WalletService] No deposit record found for ref: ${reference}`);
            return { status: 'not_found' };
        }

        const deposit = deposits[0];

        // Idempotency: already processed
        if (deposit.status === 'Completed') {
            const [w] = await pool.query('SELECT user_id FROM wallets WHERE wallet_id = ?', [deposit.wallet_id]);
            return { status: 'already_processed', walletSummary: await this.getWalletSummary(w[0].user_id) };
        }

        // Verify with Paystack
        const verification = await paystackService.verifyTransaction(reference);
        const paystackStatus = verification?.data?.status;

        if (paystackStatus !== 'success') {
            const pendingStatuses = ['ongoing', 'pending', 'processing', 'queued'];
            if (pendingStatuses.includes(paystackStatus)) {
                return { status: 'pending', paystackStatus };
            }
            await pool.query(
                "UPDATE wallet_deposits SET status = 'Failed' WHERE paystack_ref = ?",
                [reference]
            );
            return { status: 'payment_failed', paystackStatus };
        }

        // Paystack amount is in kobo/cents already — trust server-side value
        const confirmedCents = verification.data.amount;
        const channel = verification.data.channel || 'card';
        const currency = verification.data.currency || 'KES';

        const transactionId = crypto.randomUUID();
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Lock deposit row — re-check status
            const [[locked]] = await connection.query(
                'SELECT status, wallet_id FROM wallet_deposits WHERE paystack_ref = ? FOR UPDATE',
                [reference]
            );
            if (locked.status === 'Completed') {
                await connection.rollback();
                const [w] = await pool.query('SELECT user_id FROM wallets WHERE wallet_id = ?', [locked.wallet_id]);
                return { status: 'already_processed', walletSummary: await this.getWalletSummary(w[0].user_id) };
            }

            // 1. Update deposit status
            await connection.query(
                `UPDATE wallet_deposits
                 SET status = 'Completed', completed_at = NOW(),
                     metadata = JSON_SET(COALESCE(metadata, '{}'), '$.channel', ?)
                 WHERE paystack_ref = ?`,
                [channel, reference]
            );

            // 2. Insert immutable ledger entry
            await connection.query(
                `INSERT INTO wallet_transactions
                    (transaction_id, wallet_id, reference, type, status, amount, currency, payment_provider, metadata)
                 VALUES (?, ?, ?, 'Deposit', 'Completed', ?, ?, 'Paystack', ?)`,
                [
                    transactionId,
                    deposit.wallet_id,
                    reference,
                    confirmedCents,
                    currency,
                    JSON.stringify({ channel, paystackRef: reference, verifiedAt: new Date().toISOString() }),
                ]
            );

            // 3. Credit wallet balance atomically
            await connection.query(
                `UPDATE wallets
                 SET available_balance   = available_balance + ?,
                     lifetime_deposits   = lifetime_deposits + ?,
                     updated_at          = NOW()
                 WHERE wallet_id = ?`,
                [confirmedCents, confirmedCents, deposit.wallet_id]
            );

            await connection.commit();
        } catch (err) {
            await connection.rollback();
            logger.error('[WalletService] processDepositConfirmation commit failed:', err.message);
            throw err;
        } finally {
            connection.release();
        }

        // Fetch user for notification
        const [[wallet]] = await pool.query('SELECT user_id FROM wallets WHERE wallet_id = ?', [deposit.wallet_id]);
        const userId = wallet.user_id;

        // Send rich notification (async, non-blocking)
        setImmediate(() => {
            systemMessageService.sendWalletNotification(userId, {
                txnType: 'deposit',
                amountCents: confirmedCents,
                currency,
                status: 'Completed',
                reference,
            }).catch((e) => logger.warn('[WalletService] Wallet notification error:', e.message));
        });

        logger.info(`[WalletService] Deposit confirmed: ${confirmedCents} cents for wallet ${deposit.wallet_id} (ref: ${reference})`);

        return { status: 'completed', walletSummary: await this.getWalletSummary(userId) };
    }

    // ── Webhook Idempotency Guard ─────────────────────────────────────────────

    /**
     * Mark a webhook event as processed.
     * Returns false if already processed (skip), true if newly recorded.
     */
    async markWebhookProcessed(reference, eventType) {
        try {
            await pool.query(
                'INSERT INTO wallet_webhook_log (paystack_ref, event_type) VALUES (?, ?)',
                [reference, eventType]
            );
            return true; // new
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') return false; // already processed
            throw err;
        }
    }

    // ── Withdrawals ───────────────────────────────────────────────────────────

    /**
     * Request a withdrawal.
     * @param {string}  userId
     * @param {number}  amountCents   Integer cents
     * @param {string}  method        'bank' | 'mpesa'
     * @param {object}  details       { accountName, accountNumber, bankCode, phone }
     */
    async requestWithdrawal(userId, amountCents, method = 'bank', details = {}) {
        if (!Number.isInteger(amountCents) || amountCents <= 0) {
            throw new Error('Amount must be a positive integer (cents)');
        }
        if (amountCents < 100) { // minimum KES 1 (1 bob)
            throw new Error('Minimum withdrawal is KES 1.00 (1 bob)');
        }
        if (method === 'mpesa' && details.phone) {
            details.phone = normalizeKenyanPhone(details.phone);
        }

        const walletId = await this.getOrCreateWallet(userId);

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Lock wallet and check balance
            const [[wallet]] = await connection.query(
                'SELECT available_balance, pending_balance FROM wallets WHERE wallet_id = ? FOR UPDATE',
                [walletId]
            );
            if (wallet.available_balance < amountCents) {
                await connection.rollback();
                throw new Error(`Insufficient balance. Available: ${wallet.available_balance} cents`);
            }

            const withdrawalId = crypto.randomUUID();
            const transactionId = crypto.randomUUID();
            const internalRef = `SPK_WD_${crypto.randomBytes(10).toString('hex').toUpperCase()}`;

            // 1. Insert withdrawal request
            await connection.query(
                `INSERT INTO wallet_withdrawals
                    (withdrawal_id, wallet_id, amount_cents, currency, method, status,
                     account_name, account_number, bank_code, phone, metadata)
                 VALUES (?, ?, ?, 'KES', ?, 'Pending', ?, ?, ?, ?, ?)`,
                [
                    withdrawalId, walletId, amountCents, method,
                    details.accountName || null,
                    details.accountNumber || null,
                    details.bankCode || null,
                    details.phone || null,
                    JSON.stringify({ method, ...details }),
                ]
            );

            // 2. Insert pending ledger entry
            await connection.query(
                `INSERT INTO wallet_transactions
                    (transaction_id, wallet_id, reference, type, status, amount, currency, payment_provider, metadata)
                 VALUES (?, ?, ?, 'Withdrawal', 'Pending', ?, 'KES', 'Paystack', ?)`,
                [transactionId, walletId, internalRef, amountCents, JSON.stringify({ withdrawalId })]
            );

            // 3. Move amount from available → pending
            await connection.query(
                `UPDATE wallets
                 SET available_balance = available_balance - ?,
                     pending_balance   = pending_balance   + ?,
                     updated_at        = NOW()
                 WHERE wallet_id = ?`,
                [amountCents, amountCents, walletId]
            );

            await connection.commit();

            // Initiate Paystack transfer asynchronously
            setImmediate(() => this._executePaystackTransfer(withdrawalId, walletId, amountCents, method, details, internalRef));

            // Notify user
            setImmediate(() => {
                systemMessageService.sendWalletNotification(userId, {
                    txnType: 'withdrawal',
                    amountCents,
                    currency: 'KES',
                    status: 'Pending',
                    reference: withdrawalId,
                }).catch(() => {});
            });

            return {
                withdrawalId,
                amountCents,
                status: 'Pending',
                message: 'Withdrawal request submitted. Processing within 1–2 business days.',
            };
        } catch (err) {
            await connection.rollback();
            logger.error('[WalletService] requestWithdrawal failed:', err.message);
            throw err;
        } finally {
            connection.release();
        }
    }

    /**
     * Internal: execute Paystack transfer after withdrawal is committed.
     * Runs asynchronously via setImmediate — failures do not bubble to user.
     */
    async _executePaystackTransfer(withdrawalId, walletId, amountCents, method, details, internalRef) {
        try {
            let recipientCode;

            if (method === 'mpesa') {
                // M-Pesa recipient
                const recipientRes = await paystackService.createTransferRecipient({
                    type: 'mobile_money',
                    name: details.accountName || 'Sparkle Creator',
                    account_number: details.phone,
                    bank_code: 'MPESA',
                    currency: 'KES',
                    description: `Sparkle withdrawal ${withdrawalId}`,
                });
                recipientCode = recipientRes.data?.recipient_code;
            } else {
                // Bank transfer
                const recipientRes = await paystackService.createTransferRecipient({
                    type: 'nuban',
                    name: details.accountName,
                    account_number: details.accountNumber,
                    bank_code: details.bankCode,
                    currency: 'KES',
                    description: `Sparkle withdrawal ${withdrawalId}`,
                });
                recipientCode = recipientRes.data?.recipient_code;
            }

            if (!recipientCode) throw new Error('No recipient_code returned from Paystack');

            const transferRes = await paystackService.createTransfer({
                amountCents,
                recipientCode,
                reference: internalRef,
                reason: 'Sparkle Creator Payout',
            });

            const transferCode = transferRes.data?.transfer_code;
            const transferStatus = transferRes.data?.status;

            await pool.query(
                `UPDATE wallet_withdrawals
                 SET status = ?, paystack_recipient = ?, paystack_transfer = ?, metadata = JSON_SET(COALESCE(metadata,'{}'), '$.transferCode', ?)
                 WHERE withdrawal_id = ?`,
                [transferStatus === 'success' ? 'Processing' : 'Processing', recipientCode, transferCode, transferCode, withdrawalId]
            );

            logger.info(`[WalletService] Paystack transfer initiated: ${transferCode} for withdrawal ${withdrawalId}`);
        } catch (err) {
            logger.error(`[WalletService] _executePaystackTransfer failed for ${withdrawalId}:`, err.message);
            // Mark withdrawal failed, refund balance
            try {
                const connection = await pool.getConnection();
                await connection.beginTransaction();
                await connection.query(
                    "UPDATE wallet_withdrawals SET status = 'Failed' WHERE withdrawal_id = ?",
                    [withdrawalId]
                );
                await connection.query(
                    `UPDATE wallets
                     SET available_balance = available_balance + ?,
                         pending_balance   = pending_balance   - ?,
                         updated_at        = NOW()
                     WHERE wallet_id = ?`,
                    [amountCents, amountCents, walletId]
                );
                await connection.query(
                    "UPDATE wallet_transactions SET status = 'Failed' WHERE reference = ? AND type = 'Withdrawal'",
                    [internalRef]
                );
                await connection.commit();
                connection.release();
            } catch (refundErr) {
                logger.error('[WalletService] Could not refund failed withdrawal:', refundErr.message);
            }
        }
    }

    // ── Bank Utilities (pass-through) ─────────────────────────────────────────

    async fetchBanks() {
        return paystackService.fetchBanks('kenya');
    }

    async resolveAccount(accountNumber, bankCode) {
        return paystackService.resolveAccount(accountNumber, bankCode);
    }

    // ── Internal Credit (for Revenue, Tips, Ads, etc.) ────────────────────────

    /**
     * Credit a user's wallet with earnings (non-deposit events).
     * @param {string}  userId
     * @param {number}  amountCents
     * @param {string}  type        One of TXN_TYPES
     * @param {string}  reference   Unique internal reference
     * @param {object}  metadata
     */
    async creditEarnings(userId, amountCents, type = TXN_TYPES.REVENUE, reference, metadata = {}) {
        if (!Object.values(TXN_TYPES).includes(type)) throw new Error(`Invalid txn type: ${type}`);
        if (!Number.isInteger(amountCents) || amountCents <= 0) throw new Error('Invalid amount');

        const walletId = await this.getOrCreateWallet(userId);
        const transactionId = crypto.randomUUID();
        const ref = reference || `SPK_ERN_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            await connection.query(
                `INSERT INTO wallet_transactions
                    (transaction_id, wallet_id, reference, type, status, amount, currency, payment_provider, metadata)
                 VALUES (?, ?, ?, ?, 'Completed', ?, 'KES', 'Internal', ?)`,
                [transactionId, walletId, ref, type, amountCents, JSON.stringify(metadata)]
            );
            await connection.query(
                `UPDATE wallets
                 SET available_balance  = available_balance + ?,
                     lifetime_earnings  = lifetime_earnings + ?,
                     updated_at         = NOW()
                 WHERE wallet_id = ?`,
                [amountCents, amountCents, walletId]
            );
            await connection.commit();
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

        return { transactionId, amountCents, type, reference: ref };
    }
}

// Export singleton
const walletService = new WalletService();
module.exports = walletService;
module.exports.TXN_TYPES = TXN_TYPES;
module.exports.TXN_STATUS = TXN_STATUS;
