require('dotenv').config();
const pool = require('./config/database');

async function fixTables() {
    console.log('Verifying Marketplace Tables...');
    try {
        // 1. marketplace_listings - already exists but we want to ensure it has all cols and proper constraints
        // Instead of re-creating, we'll just check if listing_media exists
        
        const [tables] = await pool.query("SHOW TABLES LIKE 'listing_media'");
        if (tables.length === 0) {
            console.log('Creating listing_media table...');
            await pool.query(`
                CREATE TABLE listing_media (
                  media_id CHAR(36) NOT NULL,
                  listing_id CHAR(36) NOT NULL,
                  media_url VARCHAR(500) NOT NULL,
                  media_type ENUM('image', 'video') NOT NULL,
                  upload_order INT DEFAULT 0,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (media_id),
                  FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);
        }

        const [favTables] = await pool.query("SHOW TABLES LIKE 'marketplace_favorites'");
        if (favTables.length === 0) {
            console.log('Creating marketplace_favorites table...');
            await pool.query(`
                CREATE TABLE marketplace_favorites (
                  favorite_id CHAR(36) NOT NULL,
                  user_id CHAR(36) NOT NULL,
                  listing_id CHAR(36) NOT NULL,
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  PRIMARY KEY (favorite_id),
                  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                  FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);
        }

        const [revTables] = await pool.query("SHOW TABLES LIKE 'marketplace_reviews'");
        if (revTables.length === 0) {
            console.log('Creating marketplace_reviews table...');
            await pool.query(`
                CREATE TABLE marketplace_reviews (
                    review_id CHAR(36) PRIMARY KEY,
                    reviewer_id CHAR(36) NOT NULL,
                    reviewee_id CHAR(36) NOT NULL,
                    listing_id CHAR(36),
                    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
                    comment TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (reviewer_id) REFERENCES users(user_id) ON DELETE CASCADE,
                    FOREIGN KEY (reviewee_id) REFERENCES users(user_id) ON DELETE CASCADE,
                    FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            `);
        }

        console.log('Table verification complete!');
        process.exit(0);
    } catch (err) {
        console.error('Table verification FAILED:', err);
        process.exit(1);
    }
}

fixTables();
