const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Infobip SMS Gateway Service
 * Credentials exist strictly in backend environment variables.
 * Never exposed to frontend or client applications.
 */
class InfobipService {
    constructor() {
        this.apiKey = process.env.INFOBIP_API_KEY || '';
        this.baseUrl = process.env.INFOBIP_BASE_URL || '';
        this.sender = process.env.INFOBIP_SMS_SENDER || 'Sparkle';
    }

    /**
     * Checks if Infobip is properly configured in the environment
     * @returns {boolean}
     */
    isConfigured() {
        const key = process.env.INFOBIP_API_KEY || this.apiKey;
        const url = process.env.INFOBIP_BASE_URL || this.baseUrl;
        return Boolean(key && key.trim() && url && url.trim());
    }

    /**
     * Get clean normalized base URL
     */
    getBaseUrl() {
        const raw = process.env.INFOBIP_BASE_URL || this.baseUrl;
        if (!raw) return '';
        let url = raw.trim().replace(/\/+$/, '');
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = `https://${url}`;
        }
        return url;
    }

    /**
     * Normalize international phone numbers for Infobip delivery
     */
    normalizePhoneNumber(phone) {
        if (!phone) return '';
        let cleaned = phone.replace(/[^\d+]/g, '');
        // If no leading +, ensure country code if known, or keep numeric
        if (cleaned.startsWith('+')) {
            cleaned = cleaned.substring(1);
        }
        return cleaned;
    }

    /**
     * Send SMS via Infobip API
     * @param {Object} options - { to, text }
     * @returns {Promise<Object>}
     */
    async sendSms({ to, text }) {
        if (!this.isConfigured()) {
            logger.warn('Infobip SMS Gateway attempted to send without active credentials in environment');
            throw new Error('SMS service is not currently configured on the server.');
        }

        const normalizedTo = this.normalizePhoneNumber(to);
        if (!normalizedTo) {
            throw new Error('Valid destination phone number is required.');
        }

        const baseUrl = this.getBaseUrl();
        const apiKey = (process.env.INFOBIP_API_KEY || this.apiKey).trim();
        const sender = (process.env.INFOBIP_SMS_SENDER || this.sender).trim();

        const endpoint = `${baseUrl}/sms/2/text/advanced`;
        const payload = {
            messages: [
                {
                    destinations: [{ to: normalizedTo }],
                    from: sender,
                    text: text
                }
            ]
        };

        try {
            logger.info(`Dispatching SMS via Infobip to ${normalizedTo.slice(0, 4)}••••`);
            const response = await axios.post(endpoint, payload, {
                headers: {
                    'Authorization': `App ${apiKey}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 10000
            });

            const status = response.data?.messages?.[0]?.status;
            const messageId = response.data?.messages?.[0]?.messageId;

            logger.info(`Infobip SMS dispatch response: ${status?.groupName || 'OK'}, ID: ${messageId}`);
            return {
                success: true,
                messageId: messageId || 'infobip-dispatched',
                status: status?.groupName || 'PENDING'
            };
        } catch (error) {
            const errData = error.response?.data;
            const errMsg = errData?.requestError?.serviceException?.text || error.message;
            logger.error(`Infobip SMS delivery failed: ${errMsg}`);
            throw new Error(`SMS delivery failed: ${errMsg}`);
        }
    }
}

module.exports = new InfobipService();
