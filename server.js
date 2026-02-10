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
// ERROR HANDLING
// =============================================

// 404 Handler
app.use((req, res) => {
    // Suppress warning logs for devtools noise
    if (!req.url.includes('com.chrome.devtools.json')) {
        logger.warn(`404 Not Found: ${req.method} ${req.url}`);
    }
    res.status(404).render('404', { title: '404 - Page Not Found' });
});

// Global error handler
app.use((err, req, res, next) => {
    logger.error('❌ Server Error:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip
    });

    // Don't expose internal errors in production
    const errorMessage = process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : err.message;

    res.status(err.status || 500).render('error', {
        title: 'Error',
        error: errorMessage
    });
});

// =============================================
// WEBSOCKET SETUP
// =============================================

const http = require('http');
const { Server } = require('socket.io');

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? ['https://sparkle-version-003.vercel.app']
            : '*',
        methods: ["GET", "POST"],
        credentials: true
    },
    connectionStateRecovery: {
        maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
        skipMiddlewares: true
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

// Middleware to attach io to req
app.use((req, res, next) => {
    req.io = io;
    next();
});

// User socket connections map
const userSockets = new Map();

// Setup Socket logic for group chats
try {
    require('./controllers/groupChat.controller').setupChatWebSocket(io);
} catch (error) {
    logger.warn('Group chat controller not found or failed:', error.message);
}

// =============================================
// MARKETPLACE SOCKET.IO INTEGRATION
// =============================================

io.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;
    logger.debug(`🔌 New socket connection: ${socket.id} | User: ${userId || 'Anonymous'}`);

    if (userId) {
        // Store user's socket connection
        userSockets.set(userId, socket.id);

        // Join user's personal room
        socket.join(`user_${userId}`);

        // Join user's campus room for marketplace updates
        const userCampus = socket.handshake.auth?.campus || socket.handshake.query?.campus;
        if (userCampus) {
            socket.join(`campus_${userCampus}`);
            logger.debug(`User ${userId} joined campus room: ${userCampus}`);
        }
    }

    // ========== MARKETPLACE EVENTS ==========

    // Join marketplace chat room
    socket.on('join_marketplace_chat', (chatId) => {
        socket.join(`marketplace_chat_${chatId}`);
        logger.debug(`User joined marketplace chat: ${chatId}`);

        // Send join confirmation
        socket.emit('chat_joined', { chatId, timestamp: new Date() });
    });

    // Leave marketplace chat room
    socket.on('leave_marketplace_chat', (chatId) => {
        socket.leave(`marketplace_chat_${chatId}`);
        logger.debug(`User left marketplace chat: ${chatId}`);
    });

    // Listen for new marketplace messages
    socket.on('marketplace_message', async (data) => {
        try {
            const { chatId, message, senderId } = data;

            // Validate required fields
            if (!chatId || !message || !senderId) {
                socket.emit('message_error', { error: 'Missing required fields' });
                return;
            }

            // Broadcast to chat room (excluding sender)
            socket.to(`marketplace_chat_${chatId}`).emit('new_marketplace_message', {
                chatId,
                message,
                senderId,
                timestamp: new Date().toISOString(),
                messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            });

            // Send delivery confirmation to sender
            socket.emit('message_delivered', {
                chatId,
                messageId: data.messageId,
                timestamp: new Date()
            });

            logger.debug(`Marketplace message sent in chat ${chatId} by user ${senderId}`);

        } catch (error) {
            logger.error('Error handling marketplace message:', error);
            socket.emit('message_error', { error: 'Failed to send message' });
        }
    });

    // User typing indicator in marketplace chat
    socket.on('marketplace_typing', (data) => {
        const { chatId, userId, isTyping } = data;

        // Broadcast typing indicator to chat room (excluding sender)
        socket.to(`marketplace_chat_${chatId}`).emit('user_marketplace_typing', {
            chatId,
            userId,
            isTyping,
            timestamp: new Date()
        });
    });

    // New marketplace listing notification
    socket.on('new_marketplace_listing', (listing) => {
        const { listingId, campus, sellerId, title } = listing;

        // Notify users in the same campus (except the seller)
        socket.to(`campus_${campus}`).emit('marketplace_listing_added', {
            listingId,
            campus,
            sellerId,
            title,
            timestamp: new Date(),
            message: `New listing in ${campus}: ${title}`
        });

        logger.debug(`New marketplace listing broadcasted to campus ${campus}: ${title}`);
    });

    // Listing status update (sold, reserved, etc.)
    socket.on('marketplace_listing_updated', (data) => {
        const { listingId, status, buyerId, sellerId } = data;

        // Notify seller if buyer is different
        if (buyerId && sellerId && buyerId !== sellerId) {
            io.to(`user_${sellerId}`).emit('listing_sold', {
                listingId,
                status,
                buyerId,
                timestamp: new Date(),
                message: `Your listing has been ${status}`
            });
        }

        // Notify interested users
        socket.to(`listing_${listingId}`).emit('listing_status_changed', {
            listingId,
            status,
            timestamp: new Date()
        });

        logger.debug(`Marketplace listing ${listingId} status updated to ${status}`);
    });

    // User joins a specific listing room (for real-time updates)
    socket.on('join_listing', (listingId) => {
        socket.join(`listing_${listingId}`);
        logger.debug(`User joined listing room: ${listingId}`);
    });

    // User leaves a specific listing room
    socket.on('leave_listing', (listingId) => {
        socket.leave(`listing_${listingId}`);
        logger.debug(`User left listing room: ${listingId}`);
    });

    // ========== NOTIFICATION EVENTS ==========

    // Send notification to specific user
    socket.on('send_notification', (data) => {
        const { userId, type, title, message, listingId } = data;

        const targetSocketId = userSockets.get(userId);
        if (targetSocketId) {
            io.to(targetSocketId).emit('notification', {
                type: type || 'info',
                title: title || 'Marketplace Notification',
                message,
                listingId,
                timestamp: new Date(),
                isRead: false
            });

            logger.debug(`Notification sent to user ${userId}: ${title}`);
        }
    });

    // ========== CONNECTION MANAGEMENT ==========

    // Handle disconnection
    socket.on('disconnect', (reason) => {
        logger.debug(`🔌 Socket disconnected: ${socket.id} | Reason: ${reason}`);

        // Remove user from socket map
        if (userId) {
            userSockets.delete(userId);
        }

        // Clean up any marketplace chat rooms
        const rooms = Array.from(socket.rooms);
        rooms.forEach(room => {
            if (room.startsWith('marketplace_chat_') || room.startsWith('listing_')) {
                socket.leave(room);
            }
        });
    });

    // Error handling
    socket.on('error', (error) => {
        logger.error(`Socket error for ${socket.id}:`, error);
    });

    // Heartbeat/ping for connection health
    socket.on('ping', (data) => {
        socket.emit('pong', {
            timestamp: new Date(),
            serverTime: Date.now(),
            ...data
        });
    });

    // Send connection confirmation
    socket.emit('connected', {
        socketId: socket.id,
        userId: userId,
        timestamp: new Date(),
        message: 'Connected to Marketplace WebSocket'
    });
});

// =============================================
// UTILITY FUNCTIONS FOR MARKETPLACE
// =============================================

/**
 * Send notification to a user
 * @param {string} userId - Target user ID
 * @param {Object} notification - Notification data
 */
function sendMarketplaceNotification(userId, notification) {
    const socketId = userSockets.get(userId);
    if (socketId) {
        io.to(socketId).emit('marketplace_notification', {
            ...notification,
            timestamp: new Date()
        });
    }
}

/**
 * Broadcast new listing to campus
 * @param {Object} listing - Listing data
 */
function broadcastNewListing(listing) {
    const { campus, sellerId } = listing;

    // Don't notify the seller
    io.to(`campus_${campus}`).except(`user_${sellerId}`).emit('new_listing_available', {
        ...listing,
        timestamp: new Date(),
        notificationType: 'new_listing'
    });
}

/**
 * Notify chat participants of new message
 * @param {string} chatId - Chat ID
 * @param {Object} message - Message data
 * @param {string} senderId - Sender user ID
 */
function notifyChatMessage(chatId, message, senderId) {
    io.to(`marketplace_chat_${chatId}`).except(`user_${senderId}`).emit('chat_message_received', {
        chatId,
        message,
        senderId,
        timestamp: new Date()
    });
}

// Make utility functions available globally
global.sendMarketplaceNotification = sendMarketplaceNotification;
global.broadcastNewListing = broadcastNewListing;
global.notifyChatMessage = notifyChatMessage;

// =============================================
// SERVER STARTUP
// =============================================

// Start server only if run directly
if (require.main === module) {
    server.listen(PORT, () => {
        logger.info(`------------------------------------------`);
        logger.info(`🔥 Sparkle Server running on port ${PORT}`);
        logger.info(`📁 Environment: ${process.env.NODE_ENV || 'development'}`);
        logger.info(`📁 Views directory: ${path.join(__dirname, 'views')}`);
        logger.info(`📁 Public directory: ${path.join(__dirname, 'public')}`);
        logger.info(`🔌 WebSocket Server: Ready for marketplace`);
        logger.info(`🏥 Health checks: /health, /health/db`);
        logger.info(`------------------------------------------`);
    });
}

// Export app for Vercel
module.exports = app;
// Attach server and io for testing/other uses
module.exports.server = server;
module.exports.io = io;
