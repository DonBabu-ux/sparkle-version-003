const express = require('express');
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

const app = express();

// Database Initialization
initDB().catch(err => {
    logger.error('Database initialization failed:', err);
    // Don't crash the server, but log heavily
    console.error('CRITICAL: Database initialization failed. API will fail.');
});

// Security & Performance Middleware
app.use(securityHeaders);
app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://sparkle-version-003.vercel.app', 'https://yourdomain.com'] // Add your domains
        : '*',
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(sanitizeInput);

// Apply rate limiting to API routes in production
if (process.env.NODE_ENV === 'production') {
    app.use('/api', apiRateLimiter);
}

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'short', {
    stream: { write: message => logger.info(message.trim()) },
    skip: (req) => req.url.includes('com.chrome.devtools.json') // Skip devtools noise
}));

// =============================================
// HEALTH CHECK ENDPOINTS
// =============================================

// Basic health check (no DB check)
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        service: 'sparkle-api',
        version: process.env.npm_package_version || '1.0.0'
    });
});

// Database health check
app.get('/health/db', async (req, res) => {
    const health = {
        status: 'checking',
        timestamp: new Date().toISOString(),
        database: {
            connected: false,
            error: null
        }
    };

    try {
        // Try to get a database connection
        const pool = require('./config/database');
        const [result] = await pool.query('SELECT 1 as test, NOW() as db_time');

        health.database = {
            connected: true,
            response_time: new Date() - new Date(health.timestamp),
            result: result[0]
        };
        health.status = 'healthy';

        res.json(health);
    } catch (error) {
        health.status = 'unhealthy';
        health.database.error = {
            message: error.message,
            code: error.code,
            errno: error.errno
        };

        logger.error('Database health check failed:', error);
        res.status(503).json(health);
    }
});

// Full system diagnostics (for debugging)
app.get('/diagnostics', (req, res) => {
    res.json({
        environment: {
            NODE_ENV: process.env.NODE_ENV || 'not set',
            PORT: PORT,
            DB_HOST: process.env.DB_HOST ? 'set' : 'not set',
            DB_NAME: process.env.DB_NAME ? 'set' : 'not set',
            JWT_SECRET: process.env.JWT_SECRET ? 'set' : 'not set',
            VERCEL: process.env.VERCEL ? 'yes' : 'no'
        },
        system: {
            platform: process.platform,
            node_version: process.version,
            memory: process.memoryUsage(),
            uptime: process.uptime()
        },
        timestamp: new Date().toISOString()
    });
});

// =============================================
// STATIC FILES & VIEW ENGINE
// =============================================

// Static Files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

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

// =============================================
// DEVELOPMENT TOOLS (Only in non-production)
// =============================================

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

// =============================================
// MAIN ROUTES
// =============================================

// Routes
app.use('/api', apiRoutes);
app.use('/', webRoutes);

// =============================================
// SERVER STARTUP / EXPORTS
// =============================================

if (require.main === module) {
    app.listen(PORT, () => {
        logger.info(`------------------------------------------`);
        logger.info(`🔥 Sparkle Server running on port ${PORT}`);
        logger.info(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`📁 Views directory: ${path.join(__dirname, 'views')}`);
        logger.info(`📁 Public directory: ${path.join(__dirname, 'public')}`);
        logger.info(`🏥 Health checks: /health, /health/db`);
        logger.info(`------------------------------------------`);
    });
}

// Export app for Vercel
module.exports = app;
