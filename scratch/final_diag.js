require('dotenv').config();
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');

async function diagnostic() {
    console.log('--- SYSTEM CHECK ---');
    console.log('Node Version:', process.version);
    console.log('Platform:', process.platform);
    
    console.log('\n--- DATABASE CHECK ---');
    const dbConfig = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: 3306,
        connectTimeout: 10000
    };
    console.log('Target:', dbConfig.host);
    
    try {
        const conn = await mysql.createConnection(dbConfig);
        console.log('✅ MySQL: Connection Success!');
        await conn.query('SELECT 1');
        console.log('✅ MySQL: Query Success!');
        await conn.end();
    } catch (e) {
        console.log('❌ MySQL: Failed:', e.message);
        console.log('Code:', e.code);
    }

    console.log('\n--- EMAIL CHECK ---');
    const mailConfig = {
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        },
        connectionTimeout: 10000
    };
    console.log('Target:', mailConfig.host, 'Port:', mailConfig.port);
    
    try {
        const transporter = nodemailer.createTransport(mailConfig);
        await transporter.verify();
        console.log('✅ Email: SMTP Success!');
    } catch (e) {
        console.log('❌ Email: Failed:', e.message);
        console.log('Code:', e.code);
    }
}

diagnostic();
