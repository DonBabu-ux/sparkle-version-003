const logger = require('./logger');

// Configuration
// Configuration
const RENDER_APP_URL = process.env.RENDER_EXTERNAL_URL || process.env.RENDER_APP_URL || `http://localhost:${process.env.PORT || 3000}`;
const PING_INTERVAL = 14 * 60 * 1000; // 14 minutes (Render spins down after 15 mins of inactivity)
const ENDPOINTS = [
    '/health',
    '/api/health',
    '/'
];

// Function to ping a single endpoint
const pingEndpoint = async (endpoint) => {
    const url = `${RENDER_APP_URL}${endpoint}`;
    try {
        const startTime = Date.now();
        // Native fetch requires Node >= 18.0.0
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Sparkle-Keep-Alive/1.0' },
            signal: AbortSignal.timeout(15000)
        });
        const responseTime = Date.now() - startTime;
        
        if (response.ok) {
            logger.info(`✅ Pinged ${endpoint} - Status: ${response.status} - Time: ${responseTime}ms`);
            return { success: true, endpoint, status: response.status };
        } else {
            logger.warn(`⚠️ Pinged ${endpoint} but got non-ok status: ${response.status}`);
            return { success: false, endpoint, status: response.status };
        }
    } catch (error) {
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
            logger.warn(`❌ Timeout pinging ${endpoint}`);
        } else if (error.cause?.code === 'ECONNREFUSED' || error.code === 'ECONNREFUSED' || error.message.includes('ECONNREFUSED')) {
            logger.warn(`❌ Connection refused for ${endpoint} - App might be waking up or local server is down`);
        } else {
            logger.error(`❌ Error pinging ${endpoint} - ${error.message}`);
        }
        return { success: false, endpoint, error: error.message };
    }
};

// Main keep-alive function
const keepAlive = async () => {
    logger.info('🚀 Starting keep-alive cycle...');
    
    // Try all endpoints until one succeeds
    for (const endpoint of ENDPOINTS) {
        const result = await pingEndpoint(endpoint);
        if (result.success) {
            break; // Stop after first successful ping
        }
    }
};

// Start the keep-alive process
const startKeepAlive = () => {
    // Run even in dev if RENDER_EXTERNAL_URL is present, or if explicitly asked
    const isRender = !!process.env.RENDER_EXTERNAL_URL || !!process.env.RENDER_APP_URL;
    
    if (!isRender && process.env.NODE_ENV !== 'production') {
        logger.info('📡 Keep-alive service disabled in local dev (Set RENDER_EXTERNAL_URL to enable)');
        return;
    }

    logger.info('📡 Keep-alive service initialized');
    logger.info(`🌐 Monitoring app at: ${RENDER_APP_URL}`);
    logger.info(`⏰ Ping interval: ${PING_INTERVAL / 1000 / 60} minutes`);
    
    // Run after a short delay on start (to let server fully bind)
    setTimeout(() => {
        keepAlive().catch(err => logger.error(`Keep alive init error: ${err.message}`));
    }, 10000);
    
    // Then run at regular intervals
    setInterval(() => {
        keepAlive().catch(err => logger.error(`Keep alive error: ${err.message}`));
    }, PING_INTERVAL);
};

module.exports = { startKeepAlive };
