require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    });
    const [usersRows] = await conn.query('SHOW CREATE TABLE users');
    const [messagesRows] = await conn.query('SHOW CREATE TABLE messages');
    console.log('--- users CREATE TABLE ---');
    console.log(usersRows[0]['Create Table']);
    console.log('--- messages CREATE TABLE ---');
    console.log(messagesRows[0]['Create Table']);
    await conn.end();
  } catch (err) {
    console.error('Error fetching schema:', err);
    process.exit(1);
  }
})();
