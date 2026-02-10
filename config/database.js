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
    connectionLimit: 20, // Increased for production
    queueLimit: 100,
    connectTimeout: 30000,
    
    // SSL for production (most cloud DBs require this)
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: true
    } : undefined,
    
    // Performance
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    
    // Timezone
    timezone: 'Z', // UTC
    
    // Connection retry
    enableResetConnection: true
});

// Connection validation
pool.on('connection', (connection) => {
    console.log('✅ New database connection established');
});

pool.on('acquire', (connection) => {
    console.log('🔗 Connection acquired');
});

pool.on('release', (connection) => {
    console.log('🔄 Connection released');
});

pool.on('enqueue', () => {
    console.log('⏳ Waiting for available connection...');
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
