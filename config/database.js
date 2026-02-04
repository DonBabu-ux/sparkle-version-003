const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Keep-Alive Mechanism to prevent ECONNRESET on remote DBs
setInterval(async () => {
    try {
        await pool.query('SELECT 1');
    } catch (err) {
        // Ignore errors, just trying to keep connection open
    }
}, 10000); // Ping every 10 seconds

module.exports = pool;
