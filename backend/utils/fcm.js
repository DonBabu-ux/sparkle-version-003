const admin = require('../config/firebase-admin');
const logger = require('./logger');

const sendFcmNotification = async (tokens, title, body, data = {}) => {
    if (!admin) {
        logger.warn('FCM: Cannot send notification. Firebase Admin not initialized (Missing serviceAccountKey.json).');
        return;
    }

    if (!tokens || tokens.length === 0) return;

    // Ensure all data payload values are strings (FCM V1 requirement)
    const stringifiedData = {};
    for (const key in data) {
        stringifiedData[key] = String(data[key]);
    }

    const message = {
        notification: {
            title: title,
            body: body
        },
        data: stringifiedData,
        tokens: Array.isArray(tokens) ? tokens : [tokens]
    };

    try {
        const response = await admin.messaging().sendEachForMulticast(message);
        logger.info(`FCM V1: Sent multicast. Success: ${response.successCount}, Failure: ${response.failureCount}`);
        
        if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    logger.error(`FCM V1 Error for token [${message.tokens[idx]}]:`, resp.error);
                }
            });
        }
        return response;
    } catch (error) {
        logger.error('FCM V1: Error sending notification:', error);
        throw error;
    }
};

module.exports = { sendFcmNotification };
