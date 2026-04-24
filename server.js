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

const { securityHeaders, apiRateLimiter, sanitizeInput, imageLimiter } = require('./middleware/security.middleware');
const logger = require('./utils/logger');
const { startKeepAlive } = require('./utils/keep-alive');
const firebaseConfig = require('./config/firebase.config');
const { initializeSocket } = require('./socket');
const { initializeEmail } = require('./config/email');

const app = express();

// Database Initialization
// initDB deferred to server.listen callback

// Security & Performance Middleware
app.use(securityHeaders);

// CORS configuration to allow credentials and specific origins
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:3000',
            'http://localhost:5174',
            'http://localhost',
            'https://localhost',
            'capacitor://localhost',
            'https://sparkle-version-003-1-f4v3.onrender.com'
        ];
        
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Robust check for localhost and Capacitor origins
        const isLocalhost = origin.includes('localhost') || origin.startsWith('capacitor://');
        const isAllowed = allowedOrigins.indexOf(origin) !== -1;
        
        if (isLocalhost || isAllowed || process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        return callback(new Error(`CORS not allowed for origin: ${origin}`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'X-CSRF-Token']
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(sanitizeInput);

const { isVerified } = require('./utils/user-helpers');

// Multi-language Translation Helper
const translations = {
    en: {
        settings: "Settings",
        appearance: "Appearance & Language",
        dark_mode: "Dark Mode",
        font_size: "Font Size",
        language: "Language",
        save: "Save Changes",
        danger_zone: "Danger Zone",
        delete_account: "Delete Account"
    },
    sw: {
        settings: "Mipangilio",
        appearance: "Mwonekano na Lugha",
        dark_mode: "Modi ya Giza",
        font_size: "Ukubwa wa Maandishi",
        language: "Lugha",
        save: "Hifadhi Mabadiliko",
        danger_zone: "Eneo la Hatari",
        delete_account: "Futa Akaunti"
    },
    fr: {
        settings: "Paramètres",
        appearance: "Apparence et Langue",
        dark_mode: "Mode Sombre",
        font_size: "Taille de la Police",
        language: "Langue",
        save: "Enregistrer",
        danger_zone: "Zone de Danger",
        delete_account: "Supprimer le compte"
    }
};

// Make Firebase/Supabase config and user available to all views
app.use((req, res, next) => {
    res.locals.firebaseConfig = firebaseConfig;
    res.locals.supabaseConfig = {
        url: process.env.SUPABASE_URL || '',
        key: process.env.SUPABASE_ANON_KEY || ''
    };
    res.locals.user = req.user || null;
    res.locals.isVerified = isVerified;
    
    // Translation helper
    res.locals.t = (key) => {
        const lang = (res.locals.user && res.locals.user.language) || 'en';
        return (translations[lang] && translations[lang][key]) || (translations['en'][key] || key);
    };
    
    res.locals.giphyKey = process.env.GIPHY_API_KEY || '';
    next();
});

// Inline SVG default image — zero HTTP requests, used as onerror fallback in all templates
const DEFAULT_IMAGE_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23f0f2f5'/%3E%3Crect x='140' y='120' width='120' height='90' rx='8' fill='%23c5c7cb'/%3E%3Ccircle cx='200' cy='280' r='40' fill='%23c5c7cb'/%3E%3Ccircle cx='170' cy='147' r='18' fill='%23f0f2f5'/%3E%3Cpath d='M140 210 l30-30 25 25 20-20 45 45H140z' fill='%23b0b3b8'/%3E%3C/svg%3E`;
app.locals.defaultImage = DEFAULT_IMAGE_SVG;

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

// Static Files — serve with aggressive caching for images
app.use('/images', imageLimiter, express.static(path.join(__dirname, 'public', 'images'), {
    maxAge: '365d',
    immutable: true,
    etag: true,
    lastModified: true,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
}));
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '7d',
    etag: true,
    lastModified: true
}));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'), {
    maxAge: '7d',
    etag: true
}));

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
// CSRF and General Error Handler
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        logger.error('❌ CSRF Validation Error:', {
            url: req.url,
            method: req.method,
            ip: req.ip,
            token_in_header: req.headers['x-csrf-token'] ? 'Present' : 'Missing',
            token_in_body: req.body?._csrf ? 'Present' : 'Missing'
        });
        return res.status(403).json({
            success: false,
            message: 'Invalid security token (CSRF)',
            error: 'invalid csrf token'
        });
    }
    
    logger.error('🔥 Server Error:', err);
    res.status(err.status || 500).json({
        success: false,
        message: 'Internal Server Error',
        error: process.env.NODE_ENV === 'production' ? null : err.message
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

        // Initialize database tables
        initDB().catch(err => logger.error('Failed to initialize database:', err));
    });
}

// Export app and server for Vercel / testing
module.exports = { app, server };

