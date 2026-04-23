require('dotenv').config();
const mysql = require('mysql2/promise');

async function check() {
    const config = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: 3306,
        connectTimeout: 15000
    };
    
    console.log('Testing createConnection first...');
    try {
        const conn = await mysql.createConnection(config);
        console.log('✅ Connection Success!');
        await conn.end();
    } catch (e) {
        console.log('❌ Connection Failed:', e.message);
    }

    console.log('Testing createPool...');
    const pool = mysql.createPool(config);
    try {
        await pool.query('SELECT 1');
        console.log('✅ Pool Success!');
    } catch (e) {
        console.log('❌ Pool Failed:', e.message);
    } finally {
        await pool.end();
    }
}

check();
