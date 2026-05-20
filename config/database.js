const mysql = require('mysql2/promise');

// High-Concurrency Database Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,

    // Aggressively optimized for massive concurrency & shared hosting
    waitForConnections: true,
    connectionLimit: 40, 
    maxIdle: 20, 
    idleTimeout: 30000, 
    queueLimit: 0,
    connectTimeout: 20000,

    ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: false
    } : undefined,

    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    timezone: 'Z',
    
    // Performance tuning
    namedPlaceholders: true,
    multipleStatements: true // Required for transaction batching
});

pool.on('error', (err) => {
    console.error('CRITICAL: Unexpected error on idle database connection', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('Database connection lost. Reconnecting...');
    }
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

// Transaction helper for safer abstraction
pool.executeTransaction = async (queries) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const results = [];
        for (const query of queries) {
            const [rows] = await connection.query(query.sql, query.values);
            results.push(rows);
        }
        await connection.commit();
        return results;
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
};

module.exports = pool;
