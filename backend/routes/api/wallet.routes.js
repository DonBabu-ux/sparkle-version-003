'use strict';
// routes/api/wallet.routes.js

const express = require('express');
const router = express.Router();
const walletController = require('../../controllers/wallet.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');

// ── Authenticated Wallet Endpoints ────────────────────────────────────────────
router.get('/',                  authMiddleware, walletController.getWallet);
router.get('/history',           authMiddleware, walletController.getHistory);
router.post('/deposit',          authMiddleware, walletController.initializeDeposit);
router.post('/verify',           authMiddleware, walletController.verifyDeposit);
router.post('/withdraw',         authMiddleware, walletController.requestWithdrawal);
router.get('/banks',             authMiddleware, walletController.fetchBanks);
router.get('/payout-methods',      authMiddleware, walletController.getPayoutMethods);
router.post('/payout-methods',     authMiddleware, walletController.addPayoutMethod);
router.post('/payout-methods/:payoutId/default', authMiddleware, walletController.setDefaultPayoutMethod);
router.delete('/payout-methods/:payoutId', authMiddleware, walletController.deletePayoutMethod);
router.post('/resolve-account',  authMiddleware, walletController.resolveAccount);
router.get('/auto-withdrawal',   authMiddleware, walletController.getAutoWithdrawalConfig);
router.post('/auto-withdrawal',  authMiddleware, walletController.updateAutoWithdrawalConfig);

// ── Paystack Webhook (Public — HMAC-verified internally) ─────────────────────
// NOTE: This route must receive the raw body. If your server applies express.json()
// globally, ensure req.rawBody is populated before this route is reached.
router.post('/webhook/paystack', walletController.handleWebhook);

module.exports = router;
