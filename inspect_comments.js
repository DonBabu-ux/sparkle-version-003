const mysql = require('mysql2/promise');
require('dotenv').config();

async function inspect() {
    let connection;
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306,
        });
        console.log('--- comments table columns ---');
        const [columns] = await connection.query('SHOW COLUMNS FROM comments');
        columns.forEach(c => console.log(`${c.Field} (${c.Type})`));
        await connection.end();
    } catch (err) {
        console.error('Inspection failed:', err.message);
        if (connection) await connection.end();
    }
}
inspect();
