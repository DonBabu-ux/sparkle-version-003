require('dotenv').config();
const pool = require('./config/database');
const logger = require('./utils/logger');

async function setup() {
    try {
        console.log('Creating marketplace_wishlist table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS marketplace_wishlist (
                wishlist_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                listing_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_wishlist (user_id, listing_id),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE
            )
        `);
        console.log('marketplace_wishlist table ready.');
    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        process.exit();
    }
}
setup();
