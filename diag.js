const pool = require('./config/database');
require('dotenv').config();

console.log('--- DB Diagnostics ---');
console.log('Host:', process.env.DB_HOST);
console.log('User:', process.env.DB_USER);
console.log('Database:', process.env.DB_NAME);
console.log('Port:', process.env.DB_PORT);

pool.query('SELECT 1')
    .then(() => console.log('✅ Connection Successful'))
    .catch(err => {
        console.error('❌ Connection Failed');
        console.error('Code:', err.code);
        console.error('Message:', err.message);
        process.exit(1);
    });
