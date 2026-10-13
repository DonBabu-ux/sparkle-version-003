// routes/api/recovery.routes.js - Public Login-Independent Account Recovery Portal Routes
'use strict';

const express = require('express');
const router = express.Router();
const accountRecoveryService = require('../../services/accountRecovery.service');
const logger = require('../../utils/logger');

// POST /api/recovery/challenge - Request 6-digit verification challenge
router.post('/challenge', async (req, res) => {
    try {
        const { contact, actionType } = req.body;
        const result = await accountRecoveryService.initiateChallenge({
            contactIdentifier: contact,
            actionType,
            ipAddress: req.ip
        });
        res.json(result);
    } catch (err) {
        logger.warn(`[RecoveryAPI] Challenge failed: ${err.message}`);
        res.status(400).json({ error: err.message });
    }
});

// POST /api/recovery/verify - Verify code & get scoped recovery action token
router.post('/verify', async (req, res) => {
    try {
        const { requestId, code } = req.body;
        const result = await accountRecoveryService.verifyChallenge({ requestId, code });
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /api/recovery/cancel-deletion - Authoritatively cancel pending deletion
router.post('/cancel-deletion', async (req, res) => {
    try {
        const { verifiedToken } = req.body;
        const result = await accountRecoveryService.executeCancelDeletion({ verifiedToken });
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /api/recovery/appeal - Submit termination appeal case
router.post('/appeal', async (req, res) => {
    try {
        const { verifiedToken, reasonCategory, explanation } = req.body;
        const result = await accountRecoveryService.submitAppeal({
            verifiedToken,
            reasonCategory,
            explanation
        });
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// POST /api/recovery/emergency-export - Request data export prior to account loss
router.post('/emergency-export', async (req, res) => {
    try {
        const { verifiedToken, format, categories } = req.body;
        const result = await accountRecoveryService.executeEmergencyExport({
            verifiedToken,
            format,
            categories
        });
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/recovery/appeal/status - Check status of submitted appeal without logging in
router.get('/appeal/status', async (req, res) => {
    try {
        const { ref, contact } = req.query;
        const result = await accountRecoveryService.checkAppealStatus(ref, contact);
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
