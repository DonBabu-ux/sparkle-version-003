const infobipService = require('../services/infobip.service');
const logger = require('./logger');

/**
 * Universal SMS Dispatcher for Sparkle
 * Uses Infobip as the primary SMS delivery provider.
 */
const sendSMS = async (phoneNumber, code) => {
    try {
        if (!phoneNumber) {
            throw new Error('Phone number is required for SMS');
        }

        const messageText = `Your Sparkle security verification code is: ${code}. Do not share this code with anyone. Valid for 10 minutes.`;

        if (infobipService.isConfigured()) {
            return await infobipService.sendSms({
                to: phoneNumber,
                text: messageText
            });
        }

        // When Infobip is not configured in local development:
        if (process.env.NODE_ENV !== 'production') {
            logger.info(`[SMS SIMULATION - INFOBIP NOT CONFIGURED] To: ${phoneNumber}, Code: ${code}`);
            console.log('--------------------------------------------------');
            console.log(`📱 [DEV ONLY] SMS CODE FOR ${phoneNumber}: ${code}`);
            console.log('--------------------------------------------------');
            return { success: true, messageId: 'dev-simulated-sms-id' };
        }

        throw new Error('SMS service gateway is not configured on the server.');
    } catch (error) {
        const errorMsg = error?.message || String(error).slice(0, 200);
        logger.error('Send SMS error: ' + errorMsg);
        throw error;
    }
};

module.exports = {
    sendSMS
};
