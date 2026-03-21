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
const webRoutes = require('./routes/web');

const { securityHeaders, apiRateLimiter, sanitizeInput } = require('./middleware/security.middleware');
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

// Make Firebase/Supabase config and user available to all views
app.use((req, res, next) => {
    res.locals.firebaseConfig = firebaseConfig;
    res.locals.supabaseConfig = {
        url: process.env.SUPABASE_URL || '',
        key: process.env.SUPABASE_ANON_KEY || ''
    };
    res.locals.user = req.user || null;
    next();
});

// Logging - use 'dev' format in development for less noise
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: message => logger.info(message.trim()) },
    skip: (req) => req.url.includes('com.chrome.devtools.json') // Skip devtools noise
}));

// Static Files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'))); // UNCOMMENT THIS

// Ensure missing static files in /uploads don't hit the auth middleware or EJS engine
app.use('/uploads', (req, res) => {
    res.status(404).send('Image not found');
});

// View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Redirect .html requests
app.use((req, res, next) => {
    if (req.path.endsWith('.html')) {
        const newPath = req.path.slice(0, -5);
        if (newPath === '/index') {
            return res.redirect(301, '/');
        }
        return res.redirect(301, newPath);
    }
    next();
});

// API Tester & Route Debugging (Development Only)
if (process.env.NODE_ENV !== 'production') {
    const { scanRoutes } = require('./utils/route-scanner');
    const { ejsAuthMiddleware } = require('./middleware/auth.middleware');

    app.get('/api/debug/routes', ejsAuthMiddleware, (req, res) => {
        try {
            const routes = scanRoutes(app);
            res.json(routes);
        } catch (error) {
            console.error('[API Debug Error] Failed to scan routes:', error);
            res.status(500).json({ error: 'Failed to scan routes' });
        }
    });

    app.get('/api-tester', ejsAuthMiddleware, (req, res) => {
        res.render('api-tester', {
            title: 'Sparkle API Tester',
            user: req.user
        });
    });
}

// Routes
app.use('/api', apiRateLimiter, apiRoutes);
app.use('/', webRoutes);

// 404 Handler
app.use((req, res) => {
    // Suppress warning logs for devtools noise
    if (!req.url.includes('com.chrome.devtools.json')) {
        logger.warn(`404 Not Found: ${req.method} ${req.url}`);
    }
    res.status(404).render('404', { title: '404 - Page Not Found' });
});

// Enhanced Error Handler
app.use((err, req, res, next) => {
    // Log the full error carefully
    const errorMessage = err?.stack || err?.message || err || 'Unknown Error';
    console.error('❌ Server Error:', errorMessage);

    if (res.statusCode === 500 || !err.status) {
        console.error('🔍 Error Context:', {
            url: req.originalUrl,
            method: req.method,
            body: req.body,
            user: req.user?.user_id || req.user?.id,
            timestamp: new Date().toISOString()
        });
    }
    
    // Check if it's an API request
    if (req.originalUrl.startsWith('/api') || req.path.startsWith('/api')) {
        return res.status(err.status || 500).json({
            success: false,
            message: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error',
            error: err.message
        });
    }

    res.status(err.status || 500).render('error', {
        title: 'Error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error',
        user: req.user || null
    });
});

// =============================================
// SERVER STARTUP / EXPORTS
// =============================================

// Create HTTP server and attach Socket.IO
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

