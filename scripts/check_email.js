const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkAndUpdate() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306
        });

        const userId = 'd75fe3b5-7a45-4581-ab13-91934d8b54de';
        
        const [rows] = await connection.execute(
            'SELECT user_id, email, username FROM users WHERE user_id = ?',
            [userId]
        );
        
        console.log('Current Account Details:');
        console.log(rows[0]);

        if (rows.length > 0 && rows[0].email !== 'sparkleofficial@sparkle.app') {
            await connection.execute(
                'UPDATE users SET email = ? WHERE user_id = ?',
                ['sparkleofficial@sparkle.app', userId]
            );
            console.log('Updated email to sparkleofficial@sparkle.app');
        } else if (rows.length === 0) {
            console.log('User ID not found in database!');
        }

        await connection.end();
    } catch (err) {
        console.error('Error:', err);
    }
}

checkAndUpdate();
