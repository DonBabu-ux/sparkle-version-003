my server.js const express = require('express');
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
initDB().catch(err => logger.error('Database initialization failed:', err));

// Security & Performance Middleware
app.use(securityHeaders);
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(sanitizeInput);

// Logging - use 'dev' format in development for less noise
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: message => logger.info(message.trim()) },
    skip: (req) => req.url.includes('com.chrome.devtools.json') // Skip devtools noise
}));

// Static Files
app.use(express.static(path.join(__dirname, 'public')));
// app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

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

// Routes
app.use('/api', apiRoutes);
app.use('/', webRoutes);

// 404 Handler
app.use((req, res) => {
    // Suppress warning logs for devtools noise
    if (!req.url.includes('com.chrome.devtools.json')) {
        logger.warn(`404 Not Found: ${req.method} ${req.url}`);
    }
    res.status(404).render('404', { title: '404 - Page Not Found' });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.stack);
    res.status(err.status || 500).render('error', {
        title: 'Error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
    });
});

const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Adjust in production
        methods: ["GET", "POST"]
    }
});

// Middleware to attach io to req
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Setup Socket logic
require('./controllers/groupChat.controller').setupChatWebSocket(io);

server.listen(PORT, () => {
    logger.info(`------------------------------------------`);
    logger.info(` Sparkle Server running on port ${PORT}`);
    logger.info(` Views directory: ${path.join(__dirname, 'views')}`);
    logger.info(` Public directory: ${path.join(__dirname, 'public')}`);
    logger.info(`------------------------------------------`);
}); const express = require('express');
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
initDB().catch(err => logger.error('Database initialization failed:', err));

// Security & Performance Middleware
app.use(securityHeaders);
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(sanitizeInput);

// Logging - use 'dev' format in development for less noise
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
    stream: { write: message => logger.info(message.trim()) },
    skip: (req) => req.url.includes('com.chrome.devtools.json') // Skip devtools noise
}));

// Static Files
app.use(express.static(path.join(__dirname, 'public')));
// app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

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

// Routes
app.use('/api', apiRoutes);
app.use('/', webRoutes);

// 404 Handler
app.use((req, res) => {
    // Suppress warning logs for devtools noise
    if (!req.url.includes('com.chrome.devtools.json')) {
        logger.warn(`404 Not Found: ${req.method} ${req.url}`);
    }
    res.status(404).render('404', { title: '404 - Page Not Found' });
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err.stack);
    res.status(err.status || 500).render('error', {
        title: 'Error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
    });
});

const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Adjust in production
        methods: ["GET", "POST"]
    }
});

// Middleware to attach io to req
app.use((req, res, next) => {
    req.io = io;
    next();
});

// Setup Socket logic
require('./controllers/groupChat.controller').setupChatWebSocket(io);

server.listen(PORT, () => {
    logger.info(`------------------------------------------`);
    logger.info(` Sparkle Server running on port ${PORT}`);
    logger.info(` Views directory: ${path.join(__dirname, 'views')}`);
    logger.info(` Public directory: ${path.join(__dirname, 'public')}`);
    logger.info(`------------------------------------------`);
});
