require('dotenv').config();
const mysql = require('mysql2/promise');

async function check() {
    console.log('--- Env Check ---');
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('DB_USER:', process.env.DB_USER);
    console.log('DB_NAME:', process.env.DB_NAME);
    console.log('DB_PORT:', process.env.DB_PORT);
    console.log('DB_PASSWORD length:', process.env.DB_PASSWORD ? process.env.DB_PASSWORD.length : 0);
    console.log('--- Pool Check ---');
    
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306,
        connectTimeout: 10000
    });

    try {
        console.log('Attempting pool.query(SELECT 1)...');
        await pool.query('SELECT 1');
        console.log('✅ Success!');
    } catch (err) {
        console.error('❌ Failed:', err.message);
        console.error('Code:', err.code);
        console.error('Errno:', err.errno);
    } finally {
        await pool.end();
    }
}

check();
