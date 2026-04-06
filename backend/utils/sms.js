const logger = require('./logger');

/**
 * Placeholder for SMS verification
 * In a real implementation, this would use a service like Twilio or Vonage
 */
const sendSMS = async (phoneNumber, code) => {
    try {
        if (!phoneNumber) {
            throw new Error('Phone number is required for SMS');
        }

        // logger.info is already configured to point to winston in this project
        logger.info(`[SMS SIMULATION] To: ${phoneNumber}, Code: ${code}`);

        // Log to console explicitly for visibility during development
        console.log('------------------------------------------');
        console.log(`📱 SMS VERIFICATION CODE FOR ${phoneNumber}: ${code}`);
        console.log('------------------------------------------');

        return { success: true, messageId: 'simulated-sms-id' };
    } catch (error) {
        logger.error('Send SMS error:', error);
        throw error;
    }
};

module.exports = {
    sendSMS
};
