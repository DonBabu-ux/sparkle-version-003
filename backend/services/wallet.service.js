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
const { reconcileDepositAmount } = require('../utils/walletReconciliation');

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
    async processDepositConfirmation(reference, userId) {
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

        // Owner scope: a verification reference must belong to the signed-in account.
        const [w] = await pool.query('SELECT user_id FROM wallets WHERE wallet_id = ?', [deposit.wallet_id]);
        if (!w.length) {
            return { status: 'not_found' };
        }
        if (userId !== undefined && w[0].user_id !== userId) {
            return { status: 'not_authorized' };
        }

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

        // Reconcile the provider's confirmed amount/currency with what we asked
        // for. A mismatch must never reach the ledger or the balance.
        const reconciliation = reconcileDepositAmount({
            expectedCents: Number(deposit.amount_cents),
            expectedCurrency: deposit.currency,
            confirmedCents: Number(verification?.data?.amount),
            confirmedCurrency: verification?.data?.currency
        });

        if (!reconciliation.ok) {
            logger.error(
                `[WalletService] Deposit reconciliation rejected ref=${reference}: ${reconciliation.reason} ` +
                `(expected ${deposit.amount_cents} ${deposit.currency}, confirmed ${verification?.data?.amount} ${verification?.data?.currency})`
            );
            await pool.query(
                `UPDATE wallet_deposits
                 SET status = 'Failed',
                     metadata = JSON_SET(COALESCE(metadata, '{}'), '$.reconciliation', CAST(? AS JSON))
                 WHERE paystack_ref = ? AND status = 'Pending'`,
                [JSON.stringify({
                    reason: reconciliation.reason,
                    expectedCents: Number(deposit.amount_cents),
                    expectedCurrency: deposit.currency,
                    confirmedCents: verification?.data?.amount ?? null,
                    confirmedCurrency: verification?.data?.currency ?? null,
                    at: new Date().toISOString()
                }), reference]
            );
            return {
                status: 'amount_mismatch',
                reason: reconciliation.reason,
                expectedCents: Number(deposit.amount_cents),
                confirmedCents: Number(verification?.data?.amount)
            };
        }

        const confirmedCents = reconciliation.amountCents;
        const channel = verification.data.channel || 'card';
        const currency = reconciliation.currency;

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

        // Fetch user for notification (ownership already verified above)
        const [[wallet]] = await pool.query('SELECT user_id FROM wallets WHERE wallet_id = ?', [deposit.wallet_id]);

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

    // ── Durable Webhook Queue ─────────────────────────────────────────────────

    /**
     * Persist a provider event before doing any ledger work. The unique key on
     * (provider, reference, event_type) makes this safe to call repeatedly.
     */
    async enqueueWebhookEvent({ eventType, reference, payload }) {
        if (!eventType || !reference) throw new Error('eventType and reference are required');

        await pool.query(
            `INSERT INTO wallet_webhook_events
                (event_id, provider, event_type, paystack_ref, payload, status)
             VALUES (?, 'paystack', ?, ?, ?, 'Pending')
             ON DUPLICATE KEY UPDATE event_id = event_id`,
            [crypto.randomUUID(), eventType, reference, JSON.stringify(payload || {})]
        );

        const [rows] = await pool.query(
            `SELECT event_id, status, attempts
               FROM wallet_webhook_events
              WHERE provider = 'paystack' AND paystack_ref = ? AND event_type = ?
              LIMIT 1`,
            [reference, eventType]
        );
        return rows[0] || null;
    }

    async _claimWebhookEvent(eventId) {
        const [result] = await pool.query(
            `UPDATE wallet_webhook_events
                SET status = 'Processing', attempts = attempts + 1
              WHERE event_id = ? AND status IN ('Pending', 'Failed')`,
            [eventId]
        );
        return result.affectedRows === 1;
    }

    /**
     * Process one durable event. The event is only marked Processed after the
     * wallet ledger transaction has committed (or the event is a no-op).
     */
    async processWebhookEvent(eventId) {
        const [rows] = await pool.query(
            'SELECT * FROM wallet_webhook_events WHERE event_id = ? LIMIT 1',
            [eventId]
        );
        if (!rows.length) return { status: 'not_found' };

        const event = rows[0];
        if (event.status === 'Processed') return { status: 'already_processed' };

        if (!await this._claimWebhookEvent(eventId)) {
            return { status: 'skipped' };
        }

        const payload = typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload;

        try {
            let result = { status: 'ignored' };

            if (event.event_type === 'charge.success') {
                result = await this.processDepositConfirmation(event.paystack_ref);
                if (result.status === 'pending') {
                    throw new Error('Provider still reports the deposit as pending');
                }
            } else if (event.event_type === 'charge.failed') {
                await pool.query(
                    "UPDATE wallet_deposits SET status = 'Failed' WHERE paystack_ref = ? AND status = 'Pending'",
                    [event.paystack_ref]
                );
                result = { status: 'payment_failed' };
            } else if (event.event_type === 'transfer.success') {
                result = await this.handleTransferWebhook('transfer.success', payload?.data || {});
            } else if (event.event_type === 'transfer.failed' || event.event_type === 'transfer.reversed') {
                result = await this.handleTransferWebhook(event.event_type, payload?.data || {});
            }

            await pool.query(
                `UPDATE wallet_webhook_events
                    SET status = 'Processed', processed_at = NOW(), last_error = NULL, next_retry_at = NULL
                  WHERE event_id = ?`,
                [eventId]
            );
            return result;
        } catch (err) {
            logger.error(`[WalletService] Webhook event ${eventId} (${event.event_type} ${event.paystack_ref}) failed:`, err.message);
            await pool.query(
                `UPDATE wallet_webhook_events
                    SET status = 'Failed', last_error = ?,
                        next_retry_at = DATE_ADD(NOW(), INTERVAL 60 SECOND)
                  WHERE event_id = ?`,
                [String(err.message || err).slice(0, 1000), eventId]
            ).catch((dbErr) => logger.error('[WalletService] Could not record webhook failure:', dbErr.message));
            throw err;
        }
    }

    /** Retry pending/failed/stale events; safe to call on a timer. */
    async processPendingWebhookEvents(limit = 20) {
        await pool.query(
            `UPDATE wallet_webhook_events
                SET status = 'Failed', last_error = COALESCE(last_error, 'stale processing lease')
              WHERE status = 'Processing' AND updated_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)`
        ).catch(() => {});

        const [rows] = await pool.query(
            `SELECT event_id FROM wallet_webhook_events
              WHERE status IN ('Pending', 'Failed')
                AND (next_retry_at IS NULL OR next_retry_at <= NOW())
              ORDER BY received_at ASC
              LIMIT ?`,
            [limit]
        );

        const results = [];
        for (const row of rows) {
            try {
                results.push(await this.processWebhookEvent(row.event_id));
            } catch (_) {
                // Failure is already recorded on the event row.
                results.push({ status: 'retry_scheduled' });
            }
        }
        return results;
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
                     account_name, account_number, bank_code, phone, internal_reference, metadata)
                 VALUES (?, ?, ?, 'KES', ?, 'Pending', ?, ?, ?, ?, ?, ?)`,
                [
                    withdrawalId, walletId, amountCents, method,
                    details.accountName || null,
                    details.accountNumber || null,
                    details.bankCode || null,
                    details.phone || null,
                    internalRef,
                    JSON.stringify({ method, ...details, internalRef }),
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

            // Kick off provider execution; the recovery scheduler also owns
            // any withdrawal left Pending/Processing by a process exit.
            setImmediate(() => {
                this._executePaystackTransfer(withdrawalId).catch((err) => {
                    logger.error(`[WalletService] Withdrawal ${withdrawalId} execution error:`, err.message);
                });
            });

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
     * Internal: execute a queued withdrawal. Safe to retry after a crash or
     * process exit because the provider reference is stable on the row.
     */
    async _executePaystackTransfer(withdrawalId) {
        const [rows] = await pool.query(
            'SELECT * FROM wallet_withdrawals WHERE withdrawal_id = ? LIMIT 1',
            [withdrawalId]
        );
        if (!rows.length) return { status: 'not_found' };

        const withdrawal = rows[0];
        if (['Completed', 'Failed', 'Cancelled'].includes(withdrawal.status)) {
            return { status: String(withdrawal.status).toLowerCase() };
        }
        if (withdrawal.paystack_transfer) {
            return this._refreshTransfer(withdrawal);
        }

        const [claim] = await pool.query(
            `UPDATE wallet_withdrawals
                SET status = 'Processing', last_attempt_at = NOW()
              WHERE withdrawal_id = ? AND status = 'Pending'`,
            [withdrawalId]
        );
        if (!claim.affectedRows) return { status: 'busy' };

        const metadata = typeof withdrawal.metadata === 'string'
            ? JSON.parse(withdrawal.metadata || '{}')
            : (withdrawal.metadata || {});
        const method = withdrawal.method;
        const internalRef = withdrawal.internal_reference || metadata.internalRef;

        if (!internalRef) {
            await this.failWithdrawalAndRefund(withdrawalId, 'Missing provider reference');
            return { status: 'failed' };
        }

        try {
            let recipientCode = withdrawal.paystack_recipient;

            if (!recipientCode) {
                if (method === 'mpesa') {
                    const cleanPhone = (withdrawal.phone || '').replace(/[^0-9]/g, '');
                    const recipientRes = await paystackService.createTransferRecipient({
                        type: 'mobile_money',
                        name: withdrawal.account_name || 'Sparkle Creator',
                        account_number: cleanPhone,
                        bank_code: 'MPESA',
                        currency: 'KES',
                        description: `Sparkle withdrawal ${withdrawalId}`,
                    });
                    recipientCode = recipientRes.data?.recipient_code;
                } else {
                    const cleanAccount = (withdrawal.account_number || '').replace(/[^0-9]/g, '');
                    const recipientRes = await paystackService.createTransferRecipient({
                        type: 'nuban',
                        name: withdrawal.account_name || 'Sparkle Creator',
                        account_number: cleanAccount,
                        bank_code: withdrawal.bank_code,
                        currency: 'KES',
                        description: `Sparkle withdrawal ${withdrawalId}`,
                    });
                    recipientCode = recipientRes.data?.recipient_code;
                }
            }

            if (!recipientCode) throw new Error('No recipient_code returned from Paystack');

            const transferRes = await paystackService.createTransfer({
                amountCents: Number(withdrawal.amount_cents),
                recipientCode,
                reference: internalRef,
                reason: 'Sparkle Creator Payout',
            });

            const transferCode = transferRes.data?.transfer_code;
            await this._persistTransferInitiated(withdrawalId, recipientCode, transferCode);

            logger.info(`[WalletService] Paystack transfer initiated: ${transferCode} for withdrawal ${withdrawalId}`);
            return { status: 'processing' };
        } catch (err) {
            logger.error(`[WalletService] _executePaystackTransfer failed for ${withdrawalId}:`, err.message);

            // The provider may already have accepted this reference from a
            // previous attempt whose DB write failed. Recover instead of
            // creating a second payout.
            if (err.providerInitiated) {
                logger.error(
                    `[WalletService] Provider transfer for ${withdrawalId} was initiated but not persisted; ` +
                    'leaving it for the recovery worker.'
                );
                return { status: 'processing_unconfirmed' };
            }

            const errMsg = (err.message || '').toLowerCase();
            const isDuplicateReference = errMsg.includes('duplicate') || errMsg.includes('already') || errMsg.includes('reference');
            if (isDuplicateReference) {
                try {
                    const verified = await paystackService.verifyTransfer(internalRef);
                    const data = verified?.data || {};
                    if (data.transfer_code) {
                        await this._persistTransferInitiated(withdrawalId, data.recipient || recipientCode, data.transfer_code);
                        if (data.status === 'success') {
                            await this.finalizeWithdrawalSuccess(withdrawalId, data.transfer_code);
                        } else if (data.status === 'failed' || data.status === 'reversed') {
                            await this.failWithdrawalAndRefund(withdrawalId, `Provider status: ${data.status}`);
                        }
                        return { status: data.status || 'processing' };
                    }
                } catch (verifyErr) {
                    logger.warn('[WalletService] Could not verify duplicate transfer reference:', verifyErr.message);
                }
            }

            const isStarterBusinessError = errMsg.includes('starter business') || errMsg.includes('third party payouts');
            if (isStarterBusinessError) {
                logger.warn(`[WalletService] Paystack Starter Business restriction detected for withdrawal ${withdrawalId}. Payout queued for manual admin processing.`);
                await pool.query(
                    `UPDATE wallet_withdrawals
                     SET status = 'Pending',
                         failure_reason = 'Manual review required (provider payout restriction)',
                         metadata = JSON_SET(COALESCE(metadata,'{}'), '$.manualReview', TRUE,
                             '$.starterBusinessNote', 'Paystack API requires registered business for automatic API transfers. Payout queued for admin processing.')
                     WHERE withdrawal_id = ?`,
                    [withdrawalId]
                ).catch((dbErr) => logger.error('[WalletService] Could not update starter business withdrawal status:', dbErr.message));
                return { status: 'manual_review' };
            }

            await this.failWithdrawalAndRefund(withdrawalId, err.message);
            return { status: 'failed' };
        }
    }

    async _persistTransferInitiated(withdrawalId, recipientCode, transferCode) {
        let lastErr;
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                await pool.query(
                    `UPDATE wallet_withdrawals
                     SET status = 'Processing',
                         paystack_recipient = COALESCE(paystack_recipient, ?),
                         paystack_transfer = COALESCE(paystack_transfer, ?),
                         last_attempt_at = NOW(),
                         metadata = JSON_SET(COALESCE(metadata,'{}'), '$.transferCode', ?)
                     WHERE withdrawal_id = ?`,
                    [recipientCode || null, transferCode || null, transferCode || null, withdrawalId]
                );
                return;
            } catch (err) {
                lastErr = err;
                await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
            }
        }
        // Do not refund: the provider has already been asked to pay out.
        lastErr.providerInitiated = true;
        throw lastErr;
    }

    async _refreshTransfer(withdrawal) {
        try {
            const res = await paystackService.fetchTransfer(withdrawal.paystack_transfer);
            const status = res?.data?.status;
            if (status === 'success') {
                await this.finalizeWithdrawalSuccess(withdrawal.withdrawal_id, withdrawal.paystack_transfer);
                return { status: 'completed' };
            }
            if (status === 'failed' || status === 'reversed' || status === 'abandoned') {
                await this.failWithdrawalAndRefund(withdrawal.withdrawal_id, `Provider status: ${status}`);
                return { status: 'failed' };
            }
            return { status: status || 'processing' };
        } catch (err) {
            logger.warn(`[WalletService] Could not refresh transfer ${withdrawal.paystack_transfer}:`, err.message);
            return { status: 'processing' };
        }
    }

    /**
     * Finalize a successful payout exactly once: clear pending, count lifetime
     * withdrawals, complete the ledger entry and the withdrawal row together.
     */
    async finalizeWithdrawalSuccess(withdrawalId, transferCode = null) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [[row]] = await connection.query(
                'SELECT * FROM wallet_withdrawals WHERE withdrawal_id = ? FOR UPDATE',
                [withdrawalId]
            );
            if (!row) {
                await connection.rollback();
                return { status: 'not_found' };
            }
            if (row.status === 'Completed') {
                await connection.rollback();
                return { status: 'already_completed' };
            }
            if (row.status === 'Failed' || row.status === 'Cancelled') {
                await connection.rollback();
                return { status: 'already_closed' };
            }

            const amountCents = Number(row.amount_cents);
            await connection.query(
                `UPDATE wallet_withdrawals
                 SET status = 'Completed', processed_at = NOW(), paystack_transfer = COALESCE(paystack_transfer, ?)
                 WHERE withdrawal_id = ?`,
                [transferCode, withdrawalId]
            );

            const [walletUpdate] = await connection.query(
                `UPDATE wallets
                 SET pending_balance      = pending_balance - ?,
                     lifetime_withdrawals = lifetime_withdrawals + ?,
                     updated_at           = NOW()
                 WHERE wallet_id = ? AND pending_balance >= ?`,
                [amountCents, amountCents, row.wallet_id, amountCents]
            );
            if (!walletUpdate.affectedRows) {
                throw new Error(`Wallet ${row.wallet_id} pending balance is lower than withdrawal ${withdrawalId}`);
            }

            await connection.query(
                `UPDATE wallet_transactions
                 SET status = 'Completed'
                 WHERE type = 'Withdrawal' AND (reference = ? OR JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.withdrawalId')) = ?)`,
                [row.internal_reference, withdrawalId]
            );

            await connection.commit();
            return { status: 'completed' };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    /**
     * Fail a withdrawal and return the reserved funds exactly once. The status
     * check under FOR UPDATE prevents double refunds on retried events.
     */
    async failWithdrawalAndRefund(withdrawalId, reason) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [[row]] = await connection.query(
                'SELECT * FROM wallet_withdrawals WHERE withdrawal_id = ? FOR UPDATE',
                [withdrawalId]
            );
            if (!row) {
                await connection.rollback();
                return { status: 'not_found' };
            }
            if (row.status === 'Failed' || row.status === 'Cancelled' || row.status === 'Completed') {
                await connection.rollback();
                return { status: 'already_closed' };
            }

            const amountCents = Number(row.amount_cents);
            const [[wallet]] = await connection.query(
                'SELECT pending_balance FROM wallets WHERE wallet_id = ? FOR UPDATE',
                [row.wallet_id]
            );
            const refundable = Math.min(amountCents, Number(wallet?.pending_balance || 0));
            if (refundable !== amountCents) {
                logger.error(
                    `[WalletService] Withdrawal ${withdrawalId} pending balance mismatch: ` +
                    `expected ${amountCents}, found ${wallet?.pending_balance || 0}. Refunding ${refundable}.`
                );
            }

            await connection.query(
                `UPDATE wallet_withdrawals
                 SET status = 'Failed', failure_reason = ?, processed_at = NOW()
                 WHERE withdrawal_id = ?`,
                [String(reason || 'Withdrawal failed').slice(0, 2000), withdrawalId]
            );
            await connection.query(
                `UPDATE wallets
                 SET available_balance = available_balance + ?,
                     pending_balance   = pending_balance   - ?,
                     updated_at        = NOW()
                 WHERE wallet_id = ?`,
                [refundable, refundable, row.wallet_id]
            );
            await connection.query(
                `UPDATE wallet_transactions
                 SET status = 'Failed'
                 WHERE type = 'Withdrawal' AND (reference = ? OR JSON_UNQUOTE(JSON_EXTRACT(metadata,'$.withdrawalId')) = ?)`,
                [row.internal_reference, withdrawalId]
            );

            await connection.commit();
            return { status: 'failed' };
        } catch (err) {
            await connection.rollback();
            logger.error(`[WalletService] Could not fail/refund withdrawal ${withdrawalId}:`, err.message);
            throw err;
        } finally {
            connection.release();
        }
    }

    /**
     * Apply a transfer webhook to the withdrawal ledger, even if this process
     * never initiated the transfer (for example after a restart).
     */
    async handleTransferWebhook(eventType, data = {}) {
        const reference = data.reference || null;
        const transferCode = data.transfer_code || null;

        const [rows] = await pool.query(
            `SELECT withdrawal_id FROM wallet_withdrawals
              WHERE withdrawal_id = ? OR internal_reference = ? OR paystack_transfer = ?
              LIMIT 1`,
            [reference || '', reference || '', transferCode || '']
        );
        if (!rows.length) return { status: 'not_found' };

        const withdrawalId = rows[0].withdrawal_id;
        if (eventType === 'transfer.success') {
            return this.finalizeWithdrawalSuccess(withdrawalId, transferCode);
        }
        return this.failWithdrawalAndRefund(withdrawalId, `Provider reported ${eventType}`);
    }

    /** Recovery worker: retry queued/stale withdrawals and refresh in-flight ones. */
    async processPendingWithdrawals(limit = 20) {
        await pool.query(
            `UPDATE wallet_withdrawals
                SET status = 'Pending'
              WHERE status = 'Processing'
                AND paystack_transfer IS NULL
                AND last_attempt_at < DATE_SUB(NOW(), INTERVAL 5 MINUTE)`
        ).catch(() => {});

        const [rows] = await pool.query(
            `SELECT withdrawal_id, status, paystack_transfer
               FROM wallet_withdrawals
              WHERE ((status = 'Pending'
                      AND (last_attempt_at IS NULL OR last_attempt_at < DATE_SUB(NOW(), INTERVAL 30 SECOND))
                      AND COALESCE(JSON_EXTRACT(metadata, '$.manualReview'), FALSE) = FALSE)
                  OR (status = 'Processing'
                      AND paystack_transfer IS NOT NULL
                      AND (last_attempt_at IS NULL OR last_attempt_at < DATE_SUB(NOW(), INTERVAL 2 MINUTE))))
              ORDER BY requested_at ASC
              LIMIT ?`,
            [limit]
        );

        const results = [];
        for (const row of rows) {
            try {
                if (row.status === 'Processing' && row.paystack_transfer) {
                    results.push(await this._refreshTransfer(row));
                } else {
                    results.push(await this._executePaystackTransfer(row.withdrawal_id));
                }
            } catch (err) {
                logger.error(`[WalletService] Withdrawal recovery failed for ${row.withdrawal_id}:`, err.message);
                results.push({ status: 'retry_scheduled' });
            }
        }
        return results;
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

    // ── Automated Withdrawals ──────────────────────────────────────────────────

    /**
     * Get automated withdrawal configuration for a user.
     */
    async getAutoWithdrawalConfig(userId) {
        const walletId = await this.getOrCreateWallet(userId);
        const [rows] = await pool.query(
            'SELECT * FROM wallet_auto_withdrawal_configs WHERE wallet_id = ? LIMIT 1',
            [walletId]
        );
        return rows[0] || null;
    }

    /**
     * Update/Configure automated withdrawal settings.
     * Requires explicit user consent confirmation.
     */
    async updateAutoWithdrawalConfig(userId, data = {}) {
        const walletId = await this.getOrCreateWallet(userId);
        const {
            isEnabled = false,
            mode = 'threshold',
            thresholdCents = 500000,
            scheduleFrequency = 'weekly',
            method = 'mpesa',
            accountName = null,
            accountNumber = null,
            bankCode = null,
            phone = null,
            consentConfirmed = false
        } = data;

        if (isEnabled && !consentConfirmed) {
            throw new Error('Explicit confirmation of terms and automatic payout agreement is required');
        }

        const validModes = ['scheduled', 'threshold', 'hybrid'];
        if (!validModes.includes(mode)) {
            throw new Error(`Invalid mode. Choose: ${validModes.join(', ')}`);
        }

        const validFrequencies = ['daily', 'weekly', 'monthly'];
        if (!validFrequencies.includes(scheduleFrequency)) {
            throw new Error(`Invalid frequency. Choose: ${validFrequencies.join(', ')}`);
        }

        const normalizedPhone = phone ? normalizeKenyanPhone(phone) : null;
        if (isEnabled && method === 'mpesa' && !normalizedPhone) {
            throw new Error('Valid M-Pesa phone number is required for automated payouts');
        }

        let nextScheduled = new Date();
        if (scheduleFrequency === 'daily') nextScheduled.setDate(nextScheduled.getDate() + 1);
        else if (scheduleFrequency === 'weekly') nextScheduled.setDate(nextScheduled.getDate() + 7);
        else if (scheduleFrequency === 'monthly') nextScheduled.setMonth(nextScheduled.getMonth() + 1);

        const configId = crypto.randomUUID();

        await pool.query(
            `INSERT INTO wallet_auto_withdrawal_configs
                (config_id, wallet_id, user_id, is_enabled, mode, threshold_cents, schedule_frequency, method, account_name, account_number, bank_code, phone, next_scheduled_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                is_enabled = VALUES(is_enabled),
                mode = VALUES(mode),
                threshold_cents = VALUES(threshold_cents),
                schedule_frequency = VALUES(schedule_frequency),
                method = VALUES(method),
                account_name = VALUES(account_name),
                account_number = VALUES(account_number),
                bank_code = VALUES(bank_code),
                phone = VALUES(phone),
                next_scheduled_at = VALUES(next_scheduled_at),
                updated_at = NOW()`,
            [
                configId, walletId, userId, isEnabled ? 1 : 0, mode,
                parseInt(thresholdCents, 10), scheduleFrequency, method,
                accountName, accountNumber, bankCode, normalizedPhone,
                nextScheduled
            ]
        );

        return this.getAutoWithdrawalConfig(userId);
    }

    // ── Boost Wallet Payment ──────────────────────────────────────────────────

    /**
     * Deduct funds from creator's wallet for a Boost purchase.
     * @param {string} userId
     * @param {number} amountCents (integer cents)
     * @param {object} metadata
     */
    async deductFundsForBoost(userId, amountCents, metadata = {}) {
        if (!Number.isInteger(amountCents) || amountCents <= 0) {
            throw new Error('Amount must be a positive integer (cents)');
        }
        const walletId = await this.getOrCreateWallet(userId);
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const [[wallet]] = await connection.query(
                'SELECT available_balance FROM wallets WHERE wallet_id = ? FOR UPDATE',
                [walletId]
            );

            if (!wallet || wallet.available_balance < amountCents) {
                const avail = wallet ? (wallet.available_balance / 100).toFixed(2) : '0.00';
                await connection.rollback();
                throw new Error(`Insufficient wallet balance. Available: KES ${avail}`);
            }

            const transactionId = crypto.randomUUID();
            const reference = `SPK_BST_${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

            // 1. Insert immutable ledger entry
            await connection.query(
                `INSERT INTO wallet_transactions
                    (transaction_id, wallet_id, reference, type, status, amount, currency, payment_provider, metadata)
                 VALUES (?, ?, ?, 'BoostPurchase', 'Completed', ?, 'KES', 'SparkleWallet', ?)`,
                [transactionId, walletId, reference, amountCents, JSON.stringify(metadata)]
            );

            // 2. Deduct available balance
            await connection.query(
                `UPDATE wallets
                 SET available_balance = available_balance - ?,
                     updated_at = NOW()
                 WHERE wallet_id = ?`,
                [amountCents, walletId]
            );

            await connection.commit();
            logger.info(`[WalletService] Deducted KES ${(amountCents / 100).toFixed(2)} for boost (user: ${userId}, ref: ${reference})`);
            return { transactionId, reference };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    /**
     * Background Engine: Evaluate and execute automated withdrawals for eligible wallets.
     * Idempotent & atomic balance check.
     */
    async processAutomatedWithdrawals() {
        try {
            const [configs] = await pool.query(
                `SELECT c.*, w.available_balance, w.pending_balance
                 FROM wallet_auto_withdrawal_configs c
                 JOIN wallets w ON c.wallet_id = w.wallet_id
                 WHERE c.is_enabled = 1`
            );

            for (const cfg of configs) {
                try {
                    const availableCents = cfg.available_balance;
                    const thresholdCents = cfg.threshold_cents;
                    const now = new Date();

                    let isEligible = false;
                    if (cfg.mode === 'threshold') {
                        isEligible = availableCents >= thresholdCents && availableCents >= 100;
                    } else if (cfg.mode === 'scheduled') {
                        isEligible = cfg.next_scheduled_at && now >= new Date(cfg.next_scheduled_at) && availableCents >= 100;
                    } else if (cfg.mode === 'hybrid') {
                        isEligible = availableCents >= thresholdCents && cfg.next_scheduled_at && now >= new Date(cfg.next_scheduled_at);
                    }

                    if (!isEligible) continue;

                    // Idempotency check: Ensure no active Pending/Processing withdrawal exists for this wallet
                    const [pending] = await pool.query(
                        `SELECT withdrawal_id FROM wallet_withdrawals 
                         WHERE wallet_id = ? AND status IN ('Pending', 'Processing') LIMIT 1`,
                        [cfg.wallet_id]
                    );
                    if (pending.length > 0) {
                        logger.info(`[AutoWithdrawalEngine] Skipping wallet ${cfg.wallet_id}: active withdrawal already pending`);
                        continue;
                    }

                    // Execute requestWithdrawal using available balance
                    const amountToWithdraw = availableCents;
                    logger.info(`[AutoWithdrawalEngine] Triggering automated withdrawal of ${amountToWithdraw} cents for user ${cfg.user_id}`);

                    await this.requestWithdrawal(cfg.user_id, amountToWithdraw, cfg.method, {
                        accountName: cfg.account_name,
                        accountNumber: cfg.account_number,
                        bankCode: cfg.bank_code,
                        phone: cfg.phone,
                        isAutomated: true
                    });

                    // Update next schedule
                    let nextSched = new Date();
                    if (cfg.schedule_frequency === 'daily') nextSched.setDate(nextSched.getDate() + 1);
                    else if (cfg.schedule_frequency === 'weekly') nextSched.setDate(nextSched.getDate() + 7);
                    else if (cfg.schedule_frequency === 'monthly') nextSched.setMonth(nextSched.getMonth() + 1);

                    await pool.query(
                        `UPDATE wallet_auto_withdrawal_configs 
                         SET last_executed_at = NOW(), next_scheduled_at = ? 
                         WHERE wallet_id = ?`,
                        [nextSched, cfg.wallet_id]
                    );

                } catch (singleErr) {
                    logger.error(`[AutoWithdrawalEngine] Failed processing config ${cfg.config_id}:`, singleErr.message);
                }
            }
        } catch (err) {
            logger.error('[AutoWithdrawalEngine] processAutomatedWithdrawals failed:', err.message);
        }
    }
}

// Export singleton
const walletService = new WalletService();
module.exports = walletService;
module.exports.TXN_TYPES = TXN_TYPES;
module.exports.TXN_STATUS = TXN_STATUS;
