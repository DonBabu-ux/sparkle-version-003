const mysql = require('mysql2/promise');
require('dotenv').config({ path: './backend/.env' });

async function checkConnection() {
  console.log('Attempting to connect to database at:', process.env.DB_HOST);
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306,
      connectTimeout: 10000
    });
    console.log('✅ Success! Database is reachable.');
    await connection.end();
  } catch (err) {
    console.error('❌ Connection Failed:', err.message);
    if (err.message.includes('ECONNREFUSED')) {
      console.error('Hint: Make sure the database host and port are correct and that the database server is running.');
    }
  }
}

checkConnection();
