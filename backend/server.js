const express = require('express');
const { createServer } = require('http');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
require('dotenv').config();

const { PORT } = require('./config/constants');
const { initDB } = require('./utils/database/init');
const apiRoutes = require('./routes/api');

const { securityHeaders, apiRateLimiter, sanitizeInput, imageLimiter } = require('./middleware/security.middleware');
const logger = require('./utils/logger');
const { startKeepAlive } = require('./utils/keep-alive');
const firebaseConfig = require('./config/firebase.config');
const { initializeSocket } = require('./socket');
const { initializeEmail } = require('./config/email');

const app = express();

// Database Initialization
initDB().catch(err => logger.error('Database initialization failed:', err));

// Security & Performance Middleware
app.use(securityHeaders);
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(sanitizeInput);

const { isVerified } = require('./utils/user-helpers');

// Logging - use 'dev' format in development for less noise
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: message => logger.info(message.trim()) },
    skip: (req) => {
        // Skip devtools noise and repeated static image requests
        if (req.url.includes('com.chrome.devtools.json')) return true;
        if (req.url.match(/\.(jpg|jpeg|png|gif|webp|svg|ico|woff|woff2|css|js\.map)$/)) return true;
        return false;
    }
}));

// Static Files — serve from blueprints/public (or keep as needed for assets)
// We moved public to blueprints/public, but maybe backend still needs to serve some static assets?
// Actually, the user wants two folders: /backend and /frontend. 
// If the backend serves uploads, it should probably be in backend/public/uploads.
// Let's check where uploads are now.
app.use('/images', imageLimiter, express.static(path.join(__dirname, '..', 'blueprints', 'public', 'images'), {
    maxAge: '365d',
    immutable: true,
    etag: true,
    lastModified: true
}));
app.use('/uploads', express.static(path.join(__dirname, '..', 'blueprints', 'public', 'uploads'), {
    maxAge: '7d',
    etag: true
}));

// API Routes
app.use('/api', apiRateLimiter, apiRoutes);

// Health Check (Redundant with routes/api/index.js but good for root)
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// 404 Handler for API
app.use((req, res) => {
    if (!req.url.includes('com.chrome.devtools.json')) {
        logger.warn(`404 Not Found: ${req.method} ${req.url}`);
    }
    res.status(404).json({
        success: false,
        message: 'Endpoint not found',
        path: req.originalUrl
    });
});

// Enhanced Error Handler (always JSON)
// Global Error Handler
app.use((err, req, res, next) => {
    const status = err.status || 500;
    
    // CSRF specifically
    if (err.code === 'EBADCSRFTOKEN') {
        logger.error('❌ CSRF Validation Error:', {
            url: req.url,
            method: req.method,
            ip: req.ip,
            token_in_header: req.headers['x-csrf-token'] ? 'Present' : 'Missing'
        });
        return res.status(403).json({
            success: false,
            message: 'Invalid security token (CSRF)',
            error: 'invalid csrf token'
        });
    }

    const errorMessage = err?.stack || err?.message || err || 'Unknown Error';
    logger.error('🔥 Server Error:', errorMessage);

    res.status(status).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

const server = createServer(app);
initializeSocket(server);

// Initialize email service
initializeEmail();

if (require.main === module) {
    server.listen(PORT, () => {
        logger.info(`------------------------------------------`);
        logger.info(`🔥 Sparkle Server running on port ${PORT}`);
        logger.info(`🔌 WebSocket server initialized`);
        logger.info(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`📁 Views directory: ${path.join(__dirname, 'views')}`);
        logger.info(`📁 Public directory: ${path.join(__dirname, 'public')}`);
        logger.info(`🏥 Health checks: /health, /health/db`);
        logger.info(`------------------------------------------`);

        // Start keep-alive service to prevent Render from sleeping
        startKeepAlive();
    });
}

// Export app and server for Vercel / testing
module.exports = { app, server };

