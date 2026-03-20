require('dotenv').config();
const pool = require('./config/database');

async function setupMarketplaceTables() {
    console.log('🔄 Checking and creating missing marketplace tables...');
    try {
        const connection = await pool.getConnection();

        // 1. marketplace_listings
        await connection.query(`
            CREATE TABLE IF NOT EXISTS marketplace_listings (
                listing_id VARCHAR(36) PRIMARY KEY,
                seller_id VARCHAR(36) NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                price DECIMAL(10, 2) NOT NULL,
                category VARCHAR(100) DEFAULT 'other',
                \`condition\` VARCHAR(50) DEFAULT 'good',
                campus VARCHAR(100) DEFAULT 'main_campus',
                location VARCHAR(255),
                image_url VARCHAR(500),
                status VARCHAR(50) DEFAULT 'active',
                is_sold BOOLEAN DEFAULT FALSE,
                view_count INT DEFAULT 0,
                boost_count INT DEFAULT 0,
                last_boosted_at TIMESTAMP NULL,
                is_promoted BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);

        // 2. listing_media
        await connection.query(`
            CREATE TABLE IF NOT EXISTS listing_media (
                media_id VARCHAR(36) PRIMARY KEY,
                listing_id VARCHAR(36) NOT NULL,
                media_url VARCHAR(500) NOT NULL,
                media_type VARCHAR(50) DEFAULT 'image',
                upload_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 3. listing_tags
        await connection.query(`
            CREATE TABLE IF NOT EXISTS listing_tags (
                tag_id INT AUTO_INCREMENT PRIMARY KEY,
                listing_id VARCHAR(36) NOT NULL,
                tag_name VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE,
                UNIQUE KEY unique_listing_tag (listing_id, tag_name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 4. marketplace_favorites
        await connection.query(`
            CREATE TABLE IF NOT EXISTS marketplace_favorites (
                favorite_id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                listing_id VARCHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_listing (user_id, listing_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 5. marketplace_favorite_sellers
        await connection.query(`
            CREATE TABLE IF NOT EXISTS marketplace_favorite_sellers (
                favorite_id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                seller_id VARCHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_seller (user_id, seller_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 6. marketplace_orders
        await connection.query(`
            CREATE TABLE IF NOT EXISTS marketplace_orders (
                order_id VARCHAR(36) PRIMARY KEY,
                listing_id VARCHAR(36) NOT NULL,
                buyer_id VARCHAR(36) NOT NULL,
                seller_id VARCHAR(36) NOT NULL,
                listing_title VARCHAR(255) NOT NULL,
                listing_description TEXT,
                price_at_time DECIMAL(10, 2) NOT NULL,
                status VARCHAR(50) DEFAULT 'pending',
                meetup_buyer_confirmed BOOLEAN DEFAULT FALSE,
                meetup_seller_confirmed BOOLEAN DEFAULT FALSE,
                meetupBothConfirmed BOOLEAN DEFAULT FALSE,
                cancellation_reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (buyer_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 7. marketplace_reviews
        await connection.query(`
            CREATE TABLE IF NOT EXISTS marketplace_reviews (
                review_id VARCHAR(36) PRIMARY KEY,
                listing_id VARCHAR(36),
                reviewer_id VARCHAR(36) NOT NULL,
                reviewee_id VARCHAR(36) NOT NULL,
                rating DECIMAL(3, 2) NOT NULL,
                comment TEXT,
                transaction_type VARCHAR(50) DEFAULT 'purchase',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE SET NULL,
                FOREIGN KEY (reviewer_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (reviewee_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 8. marketplace_user_blocks
        await connection.query(`
            CREATE TABLE IF NOT EXISTS marketplace_user_blocks (
                block_id VARCHAR(36) PRIMARY KEY,
                blocker_id VARCHAR(36) NOT NULL,
                blocked_id VARCHAR(36) NOT NULL,
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (blocker_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (blocked_id) REFERENCES users(user_id) ON DELETE CASCADE,
                UNIQUE KEY unique_block (blocker_id, blocked_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 9. order_audit_log
        await connection.query(`
            CREATE TABLE IF NOT EXISTS order_audit_log (
                log_id VARCHAR(36) PRIMARY KEY,
                order_id VARCHAR(36) NOT NULL,
                actor_id VARCHAR(36) NOT NULL,
                action VARCHAR(100) NOT NULL,
                new_status VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES marketplace_orders(order_id) ON DELETE CASCADE,
                FOREIGN KEY (actor_id) REFERENCES users(user_id) on DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);
        
         // 10. marketplace_chats
        await connection.query(`
             CREATE TABLE IF NOT EXISTS marketplace_chats (
                 chat_id VARCHAR(36) PRIMARY KEY,
                 buyer_id VARCHAR(36) NOT NULL,
                 seller_id VARCHAR(36) NOT NULL,
                 listing_id VARCHAR(36),
                 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                 FOREIGN KEY (buyer_id) REFERENCES users(user_id) ON DELETE CASCADE,
                 FOREIGN KEY (seller_id) REFERENCES users(user_id) ON DELETE CASCADE,
                 FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE SET NULL,
                 UNIQUE KEY unique_chat (buyer_id, seller_id, listing_id)
             ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
         `);

         // 11. marketplace_messages
         await connection.query(`
             CREATE TABLE IF NOT EXISTS marketplace_messages (
                 message_id VARCHAR(36) PRIMARY KEY,
                 chat_id VARCHAR(36) NOT NULL,
                 sender_id VARCHAR(36) NOT NULL,
                 content TEXT,
                 is_read BOOLEAN DEFAULT FALSE,
                 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                 FOREIGN KEY (chat_id) REFERENCES marketplace_chats(chat_id) ON DELETE CASCADE,
                 FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE
             ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
         `);

        console.log('✅ All marketplace tables have been created or verified successfully!');
        connection.release();
    } catch (error) {
        console.error('❌ Error creating tables:', error);
    } finally {
        process.exit();
    }
}

setupMarketplaceTables();
