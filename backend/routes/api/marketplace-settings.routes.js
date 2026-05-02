const express = require('express');
const router = express.Router();
const settingsController = require('../../controllers/marketplace.settings.controller');
const { authMiddleware } = require('../../middleware/auth.middleware');
const { upload } = require('../../utils/fileUpload');
const { mutationRateLimiter } = require('../../middleware/security.middleware');

// Base path: /api/marketplace/settings or /api/marketplace/verification

// ── Identity & Verification ───────────────────────────────────────────────────
router.post('/marketplace/verification/submit', authMiddleware, mutationRateLimiter, upload.fields([
    { name: 'id_front', maxCount: 1 },
    { name: 'id_back', maxCount: 1 },
    { name: 'selfie', maxCount: 1 }
]), settingsController.submitVerification);

router.get('/marketplace/verification/status', authMiddleware, settingsController.getVerificationStatus);

// ── Preferences & Privacy ─────────────────────────────────────────────────────
router.get('/marketplace/settings/preferences', authMiddleware, settingsController.getSettings);
router.put('/marketplace/settings/preferences', authMiddleware, mutationRateLimiter, settingsController.updateSettings);

// ── Payout Settings ───────────────────────────────────────────────────────────
router.get('/marketplace/settings/payouts', authMiddleware, settingsController.getPayouts);
router.post('/marketplace/settings/payouts', authMiddleware, mutationRateLimiter, settingsController.addPayout);

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get('/marketplace/analytics', authMiddleware, settingsController.getAnalytics);

module.exports = router;
