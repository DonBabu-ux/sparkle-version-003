const logger = require('../utils/logger');

const paystackConfig = {
    secretKey: process.env.PAYSTACK_SECRET_KEY || process.env.LIVE_SECRET_KEY,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || process.env.LIVE_PUBLIC_KEY,
    callbackUrl: process.env.PAYSTACK_CALLBACK_URL || 'http://localhost:3002/payment/callback',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3002',
    backendUrl: process.env.BACKEND_URL || 'http://localhost:3000',
    currency: process.env.PAYSTACK_CURRENCY || 'KES'
};

// Validate configuration on startup
const required = ['PAYSTACK_SECRET_KEY', 'PAYSTACK_PUBLIC_KEY'];
const missing = required.filter(key => {
    const val = process.env[key] || (key === 'PAYSTACK_SECRET_KEY' ? process.env.LIVE_SECRET_KEY : process.env.LIVE_PUBLIC_KEY);
    return !val;
});

if (missing.length > 0) {
    logger.warn(`⚠️ Missing required Paystack configuration: ${missing.join(', ')}. Wallet features will fail.`);
}

module.exports = paystackConfig;
