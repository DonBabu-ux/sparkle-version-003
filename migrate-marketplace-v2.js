require('dotenv').config();
const pool = require('./config/database');
const logger = require('./utils/logger');

async function migrate() {
    console.log('Starting Marketplace V2 migration...');
    
    try {
        // 1. Update marketplace_listings table
        console.log('Updating marketplace_listings table...');
        await pool.query(`
            ALTER TABLE marketplace_listings 
            ADD COLUMN IF NOT EXISTS is_promoted TINYINT(1) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS promotion_expires_at TIMESTAMP NULL,
            ADD COLUMN IF NOT EXISTS priority_score INT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2) DEFAULT 0.00
        `);

        // 2. Create marketplace_favorite_sellers table
        console.log('Creating marketplace_favorite_sellers table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS marketplace_favorite_sellers (
                favorite_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                seller_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_seller (user_id, seller_id),
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE,
                INDEX idx_user (user_id),
                INDEX idx_seller (seller_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 3. Create marketplace_orders table
        console.log('Creating marketplace_orders table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS marketplace_orders (
                order_id CHAR(36) PRIMARY KEY,
                buyer_id CHAR(36) NOT NULL,
                seller_id CHAR(36) NOT NULL,
                listing_id CHAR(36) NOT NULL,
                status ENUM('pending', 'accepted', 'completed', 'cancelled') DEFAULT 'pending',
                price DECIMAL(10, 2) NOT NULL,
                order_details TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (buyer_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE,
                INDEX idx_buyer (buyer_id),
                INDEX idx_seller (seller_id),
                INDEX idx_listing (listing_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log('Marketplace V2 migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
