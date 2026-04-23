// config/database.js - PRODUCTION VERSION
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,

    // Optimized for shared hosting resilience
    waitForConnections: true,
    connectionLimit: 10, // Lowered for shared hosting
    queueLimit: 0,
    connectTimeout: 30000,

    // SSL for remote DBs
    ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
    } : undefined,

    // Performance & Resilience
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    idleTimeout: 30000, 

    // Timezone
    timezone: 'Z' 
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle database connection', err);
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
