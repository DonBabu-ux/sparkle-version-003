const MarketplaceSettings = require('../models/MarketplaceSettings');
const logger = require('../utils/logger');
const { normalizeUser } = require('../utils/userHelper');

const getSettings = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        let settings = await MarketplaceSettings.getSellerSettings(user.user_id);
        
        if (!settings) {
            // Return defaults if not set
            settings = {
                profile_visibility: 'public',
                message_permissions: 'everyone',
                notifications_messages: 1,
                notifications_offers: 1,
                notifications_marketing: 0,
                auto_reply_enabled: 0,
                auto_reply_text: null
            };
        }
        res.json({ success: true, settings });
    } catch (error) {
        logger.error('Get seller settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch settings' });
    }
};

const updateSettings = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        const settings = await MarketplaceSettings.updateSellerSettings(user.user_id, req.body);
        res.json({ success: true, settings });
    } catch (error) {
        logger.error('Update seller settings error:', error);
        res.status(500).json({ success: false, message: 'Failed to update settings' });
    }
};

const submitVerification = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        const files = req.files || {};
        
        // Ensure files exist or fallback to body strings if passed as base64
        const idFrontUrl = files['id_front'] ? files['id_front'][0].path : req.body.id_front_url;
        const selfieUrl = files['selfie'] ? files['selfie'][0].path : req.body.selfie_url;
        const idBackUrl = files['id_back'] ? files['id_back'][0].path : req.body.id_back_url;

        if (!idFrontUrl || !selfieUrl) {
            return res.status(400).json({ success: false, message: 'ID Front and Selfie are required' });
        }

        const verificationId = await MarketplaceSettings.submitVerification(user.user_id, idFrontUrl, idBackUrl, selfieUrl);
        res.json({ success: true, verification_id: verificationId, status: 'pending', message: 'Verification submitted successfully' });
    } catch (error) {
        logger.error('Submit verification error:', error);
        res.status(500).json({ success: false, message: 'Failed to submit verification' });
    }
};

const getVerificationStatus = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        const status = await MarketplaceSettings.getVerificationStatus(user.user_id);
        res.json({ success: true, verification: status });
    } catch (error) {
        logger.error('Get verification status error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch verification status' });
    }
};

const getPayouts = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        const payouts = await MarketplaceSettings.getPayoutMethods(user.user_id);
        res.json({ success: true, payouts });
    } catch (error) {
        logger.error('Get payouts error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch payout methods' });
    }
};

const addPayout = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        const { provider, account_number, account_name } = req.body;

        if (!provider || !account_number || !account_name) {
            return res.status(400).json({ success: false, message: 'Provider, account number, and account name are required' });
        }

        const payoutId = await MarketplaceSettings.addPayoutMethod(user.user_id, provider, account_number, account_name);
        res.json({ success: true, payout_id: payoutId, message: 'Payout method added successfully' });
    } catch (error) {
        logger.error('Add payout error:', error);
        res.status(500).json({ success: false, message: 'Failed to add payout method' });
    }
};

const getAnalytics = async (req, res) => {
    try {
        const user = normalizeUser(req.user);
        const { period } = req.query;
        const data = await MarketplaceSettings.getAnalytics(user.user_id, period);
        res.json({ success: true, data });
    } catch (error) {
        logger.error('Get analytics error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
    }
};

module.exports = {
    getSettings,
    updateSettings,
    submitVerification,
    getVerificationStatus,
    getPayouts,
    addPayout,
    getAnalytics
};
