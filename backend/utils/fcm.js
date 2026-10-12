const admin = require('../config/firebase-admin');
const logger = require('./logger');

// Android notification channel per notification type — mirrors the client map
// in frontend/src/services/notificationChannels.ts. Channel decides sound +
// importance on the device; `system` is also the manifest default channel.
const ANDROID_CHANNEL_BY_TYPE = {
    message: 'messages',
    new_message: 'messages',
    chat: 'messages',
    group_message: 'messages',
    marketplace_contact: 'marketplace',
    listing: 'marketplace',
    offer: 'marketplace',
    order: 'marketplace',
    sale: 'marketplace',
    wishlist: 'marketplace',
    story: 'stories',
    story_view: 'stories',
    story_reaction: 'stories',
    moment: 'moments',
    like: 'moments',
    spark: 'moments',
    spark_post: 'moments',
    follow: 'social',
    follower: 'social',
    comment: 'social',
    reply: 'social',
    mention: 'social',
    confession: 'social',
    group: 'social',
    group_invite: 'social',
    request: 'social',
    tag: 'social',
    call: 'calls',
    incoming_call: 'calls',
    sparkle_ai: 'sparkle_ai',
    ai: 'sparkle_ai',
    assistant: 'sparkle_ai',
    system: 'system',
    announcement: 'system',
    security: 'system',
    reminder: 'system',
};

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
        android: {
            priority: 'high',
            notification: {
                channel_id: ANDROID_CHANNEL_BY_TYPE[stringifiedData.type] || 'system'
            }
        },
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
