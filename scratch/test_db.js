const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
    try {
        console.log('Testing connection to:', process.env.DB_HOST);
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT || '3306'),
            connectTimeout: 10000,
            ssl: {
                rejectUnauthorized: false
            }
        });
        console.log('✅ Connection successful!');
        const [rows] = await connection.execute('SELECT 1 + 1 AS result');
        console.log('✅ Query successful! Result:', rows[0].result);
        await connection.end();
    } catch (error) {
        console.error('❌ Connection failed:');
        console.error(error);
    }
}

testConnection();
