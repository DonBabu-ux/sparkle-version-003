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

// ========== ENHANCED ERROR HANDLING ==========
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    console.error(err.name, err.message, err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! 💥 Shutting down...');
    console.error(err.name, err.message, err.stack);
    process.exit(1);
});

// Database Initialization
initDB().catch(err => {
    logger.error('Database initialization failed:', err);
    console.error('DATABASE INIT ERROR:', err.message);
});

// Security & Performance Middleware
app.use(securityHeaders);
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(sanitizeInput);

// Enhanced Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: message => logger.info(message.trim()) },
    skip: (req) => req.url.includes('com.chrome.devtools.json')
}));

// Request logger middleware
app.use((req, res, next) => {
    if (!req.url.includes('com.chrome.devtools.json')) {
        console.log(`📥 ${req.method} ${req.url}`);
        if (Object.keys(req.body).length > 0 && !req.url.includes('/api/marketplace/listings')) {
            console.log('Body:', req.body);
        }
    }
    next();
});

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

// ========== DEBUG ROUTES (Remove in production) ==========
app.get('/debug/routes', (req, res) => {
    const routes = [];
    app._router.stack.forEach((middleware) => {
        if (middleware.route) {
            routes.push({
                path: middleware.route.path,
                methods: Object.keys(middleware.route.methods)
            });
        } else if (middleware.name === 'router') {
            middleware.handle.stack.forEach((handler) => {
                if (handler.route) {
                    routes.push({
                        path: handler.route.path,
                        methods: Object.keys(handler.route.methods)
                    });
                }
            });
        }
    });
    res.json({ routes });
});

// Simple test route
app.get('/test', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running', timestamp: new Date().toISOString() });
});

app.get('/api/test', (req, res) => {
    res.json({ status: 'ok', message: 'API is working', timestamp: new Date().toISOString() });
});

// ========== MAIN ROUTES ==========
// Routes
try {
    console.log('🔌 Loading API routes...');
    app.use('/api', apiRoutes);
    console.log('✅ API routes loaded');
} catch (error) {
    console.error('❌ Failed to load API routes:', error.message);
    app.use('/api', (req, res) => {
        res.status(500).json({ error: 'API routes failed to load', message: error.message });
    });
}

try {
    console.log('🔌 Loading Web routes...');
    app.use('/', webRoutes);
    console.log('✅ Web routes loaded');
} catch (error) {
    console.error('❌ Failed to load Web routes:', error.message);
    app.use('/', (req, res) => {
        res.status(500).render('error', { title: 'Error', error: 'Web routes failed to load' });
    });
}

// 404 Handler
app.use((req, res) => {
    if (!req.url.includes('com.chrome.devtools.json')) {
        logger.warn(`404 Not Found: ${req.method} ${req.url}`);
        console.log(`❌ 404: ${req.method} ${req.url}`);
    }
    res.status(404).render('404', { title: '404 - Page Not Found' });
});

// Enhanced Error Handler
app.use((err, req, res, next) => {
    console.error('\n❌ ========== SERVER ERROR ==========');
    console.error('Error:', err.name || 'Unknown Error');
    console.error('Message:', err.message);
    console.error('Stack:', err.stack);
    console.error('URL:', req.url);
    console.error('Method:', req.method);
    console.error('Path:', req.path);
    console.error('Body:', req.body);
    console.error('Query:', req.query);
    console.error('====================================\n');
    
    logger.error('Server Error:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        body: req.body,
        query: req.query
    });
    
    // Check for specific errors
    if (err.code === 'MODULE_NOT_FOUND') {
        console.error('MODULE NOT FOUND - Check your imports!');
        console.error('Missing module path:', err.message.match(/'(.*?)'/)?.[1]);
    }
    
    if (err.message.includes('Cannot find module')) {
        const missingModule = err.message.match(/'(.*?)'/)?.[1];
        console.error(`Missing module: ${missingModule}`);
        console.error('Run: npm install ' + (missingModule?.split('/')[0] || ''));
    }
    
    res.status(err.status || 500).render('error', {
        title: 'Error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
    });
});

// Socket.io setup
const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware to attach io to req
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Setup Socket logic (with error handling)
try {
    require('./controllers/groupChat.controller').setupChatWebSocket(io);
    console.log('✅ Socket.io setup complete');
} catch (error) {
    console.error('❌ Socket.io setup failed:', error.message);
}

server.listen(PORT, () => {
    console.log('\n🚀 ========== SERVER STARTED ==========');
    console.log(`   Port: ${PORT}`);
    console.log(`   Views: ${path.join(__dirname, 'views')}`);
    console.log(`   Public: ${path.join(__dirname, 'public')}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('   ====================================\n');
    
    // Test URLs
    console.log('🔗 Test URLs:');
    console.log(`   http://localhost:${PORT}/test`);
    console.log(`   http://localhost:${PORT}/api/test`);
    console.log(`   http://localhost:${PORT}/marketplace`);
    console.log(`   http://localhost:${PORT}/api/marketplace/test`);
    console.log('\n');
    
    logger.info(`------------------------------------------`);
    logger.info(` Sparkle Server running on port ${PORT}`);
    logger.info(` Views directory: ${path.join(__dirname, 'views')}`);
    logger.info(` Public directory: ${path.join(__dirname, 'public')}`);
    logger.info(`------------------------------------------`);
});
