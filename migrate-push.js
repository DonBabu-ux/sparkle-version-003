require('dotenv').config();
const pool = require('./config/database');

async function migrate() {
    try {
        console.log('Creating push_subscriptions table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                endpoint TEXT NOT NULL,
                p256dh VARCHAR(255) NOT NULL,
                auth VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX (user_id),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        `);
        console.log('Done.');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
migrate();
