// config/database.js - PRODUCTION VERSION
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,

    // Production optimizations
    waitForConnections: true,
    connectionLimit: 50,
    queueLimit: 0,
    connectTimeout: 60000,

    // SSL for production (most cloud DBs require this)
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false // Often required for shared hosting with self-signed certs
    } : undefined,

    // Performance & Resilience
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    idleTimeout: 30000, // Faster recycling of idle connections for low-limit DBs

    // Timezone
    timezone: 'Z' // UTC
});

// Connection validation
pool.on('connection', (connection) => {
    // logger.debug('✅ New database connection established');
});

pool.on('acquire', (connection) => {
    // logger.debug('🔗 Connection acquired');
});

pool.on('release', (connection) => {
    // logger.debug('🔄 Connection released');
});

pool.on('enqueue', () => {
    // logger.debug('⏳ Waiting for available connection...');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    try {
        await pool.end();
        console.log('Database pool closed gracefully');
        process.exit(0);
    } catch (err) {
        console.error('Error closing database pool:', err);
        process.exit(1);
    }
});

module.exports = pool;
