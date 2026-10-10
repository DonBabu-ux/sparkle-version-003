'use strict';
// services/paystack.service.js
//
// Centralised Paystack integration layer.
// ALL Paystack HTTP calls go through this class.
// Controllers and services must NEVER make direct Paystack HTTP requests.
//
// Supported operations:
//   - initializeTransaction  (hosted checkout: card, bank, USSD)
//   - verifyTransaction      (verify by reference)
//   - verifyWebhookSignature (HMAC-SHA512 guard)
//   - chargeMobileMoney      (M-Pesa / mobile money STK push)
//   - fetchBanks             (list of supported banks)
//   - resolveAccount         (validate bank account)
//   - createTransferRecipient (register payout destination)
//   - createTransfer          (initiate actual payout)
//   - fetchTransfer           (check transfer status)

const axios = require('axios');
const crypto = require('crypto');
const config = require('../config/paystack');
const logger = require('../utils/logger');

class PaystackService {
    constructor() {
        if (!config.secretKey) {
            logger.warn('[Paystack] ⚠️  PAYSTACK_SECRET_KEY not set. All Paystack calls will fail.');
        }

        this.client = axios.create({
            baseURL: 'https://api.paystack.co',
            headers: {
                Authorization: `Bearer ${config.secretKey}`,
                'Content-Type': 'application/json',
            },
            timeout: 15000,
        });

        // Axios response interceptor for consistent error logging
        this.client.interceptors.response.use(
            (res) => res,
            (err) => {
                const body = err.response?.data;
                logger.error('[Paystack] HTTP error:', {
                    status: err.response?.status,
                    message: body?.message || err.message,
                    url: err.config?.url,
                });
                return Promise.reject(err);
            }
        );
    }

    /**
     * Formats a human-readable error from an Axios error.
     */
    _errMsg(error, fallback) {
        return error.response?.data?.message || error.message || fallback;
    }

    // ── Deposits ──────────────────────────────────────────────────────────────

    /**
     * Initialize a standard hosted-checkout transaction (card, bank, USSD).
     * @param {number}  amountCents  Amount in integer cents (e.g. 10050 = KES 100.50)
     * @param {string}  email        Customer email (required by Paystack)
     * @param {string}  reference    Unique transaction reference
     * @param {object}  metadata     Extra data (stored on Paystack side)
     * @returns {object} Paystack data containing `authorization_url`
     */
    async initializeTransaction(amountCents, email, reference, metadata = {}) {
        try {
            const response = await this.client.post('/transaction/initialize', {
                email,
                amount: amountCents, // Paystack expects kobo/cents already
                reference,
                callback_url: config.callbackUrl,
                currency: process.env.PAYSTACK_CURRENCY || 'KES',
                metadata,
            });
            return response.data; // { status, message, data: { authorization_url, access_code, reference } }
        } catch (error) {
            throw new Error(this._errMsg(error, 'Failed to initialize Paystack transaction'));
        }
    }

    /**
     * Verify a transaction by its reference (server-side only).
     * @param {string} reference
     * @returns {object} Paystack data ({ status, data: { status, amount, ... } })
     */
    async verifyTransaction(reference) {
        try {
            const response = await this.client.get(`/transaction/verify/${reference}`);
            return response.data;
        } catch (error) {
            throw new Error(this._errMsg(error, 'Failed to verify Paystack transaction'));
        }
    }

    /**
     * Verify an incoming webhook using HMAC-SHA512.
     * Must be called BEFORE processing any webhook event.
     * @param {string} rawBody    Raw request body as string (use express.json() with verify)
     * @param {string} signature  Value of x-paystack-signature header
     * @returns {boolean}
     */
    verifyWebhookSignature(rawBody, signature) {
        const secret = config.secretKey;
        if (!secret) {
            logger.error('[Paystack] Cannot verify webhook: no secret configured');
            return false;
        }
        const hash = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
        return hash === signature;
    }

    /**
     * Initiate M-Pesa / mobile money charge via Paystack /charge endpoint.
     * @param {number}  amountCents
     * @param {string}  email
     * @param {string}  phone        E.164 format (e.g. +254722000000)
     * @param {string}  provider     'mpesa' | 'mtn' | 'airtel_ug' | 'airtel_ke'
     * @param {string}  reference    Unique reference
     * @param {object}  metadata
     */
    async chargeMobileMoney(amountCents, email, phone, provider = 'mpesa', reference, metadata = {}) {
        try {
            const response = await this.client.post('/charge', {
                email,
                amount: amountCents,
                reference,
                currency: process.env.PAYSTACK_CURRENCY || 'KES',
                metadata,
                mobile_money: { phone, provider },
            });
            return response.data;
        } catch (error) {
            throw new Error(this._errMsg(error, 'Failed to initiate mobile money charge'));
        }
    }

    // ── Bank Utilities ────────────────────────────────────────────────────────

    /**
     * Fetch list of supported banks.
     * @param {string} country  Default 'kenya'
     */
    async fetchBanks(country = 'kenya') {
        try {
            const response = await this.client.get('/bank', {
                params: { country, per_page: 200 },
            });
            return response.data; // { status, data: [{ name, slug, code, ... }] }
        } catch (error) {
            throw new Error(this._errMsg(error, 'Failed to fetch banks from Paystack'));
        }
    }

    /**
     * Resolve / validate a bank account number.
     * @param {string} accountNumber
     * @param {string} bankCode
     */
    async resolveAccount(accountNumber, bankCode) {
        try {
            const response = await this.client.get('/bank/resolve', {
                params: { account_number: accountNumber, bank_code: bankCode },
            });
            return response.data; // { status, data: { account_number, account_name } }
        } catch (error) {
            throw new Error(this._errMsg(error, 'Failed to resolve bank account'));
        }
    }

    // ── Payouts / Transfers ────────────────────────────────────────────────────

    /**
     * Create a transfer recipient (register a destination for payouts).
     * @param {object} params
     * @param {string} params.type          'nuban' | 'mobile_money' | 'ghipss'
     * @param {string} params.name          Account holder name
     * @param {string} params.account_number
     * @param {string} params.bank_code     Required for bank transfers
     * @param {string} params.currency      Default 'KES'
     * @param {string} [params.description]
     * @returns {object} Paystack data with `recipient_code`
     */
    async createTransferRecipient({ type = 'nuban', name, account_number, bank_code, currency = 'KES', description = '' }) {
        try {
            const response = await this.client.post('/transferrecipient', {
                type,
                name,
                account_number,
                bank_code,
                currency,
                description,
            });
            return response.data; // { status, data: { recipient_code, ... } }
        } catch (error) {
            throw new Error(this._errMsg(error, 'Failed to create transfer recipient'));
        }
    }

    /**
     * Initiate a transfer (payout) to a registered recipient.
     * @param {object} params
     * @param {number} params.amountCents    Integer cents
     * @param {string} params.recipientCode  From createTransferRecipient
     * @param {string} params.reference      Unique reference for this transfer
     * @param {string} [params.reason]       Human-readable reason
     */
    async createTransfer({ amountCents, recipientCode, reference, reason = 'Sparkle Creator Withdrawal' }) {
        try {
            const response = await this.client.post('/transfer', {
                source: 'balance',
                amount: amountCents,
                recipient: recipientCode,
                reference,
                reason,
                currency: process.env.PAYSTACK_CURRENCY || 'KES',
            });
            return response.data; // { status, data: { transfer_code, ... } }
        } catch (error) {
            throw new Error(this._errMsg(error, 'Failed to create Paystack transfer'));
        }
    }

    /**
     * Fetch status of a transfer.
     * @param {string} transferCode  Paystack transfer_code
     */
    async fetchTransfer(transferCode) {
        try {
            const response = await this.client.get(`/transfer/${transferCode}`);
            return response.data;
        } catch (error) {
            throw new Error(this._errMsg(error, 'Failed to fetch transfer status'));
        }
    }
}

module.exports = new PaystackService();
