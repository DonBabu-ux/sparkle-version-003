require('dotenv').config();
const pool = require('./config/database');
const { v4: uuidv4 } = require('uuid');

async function repair() {
    const connection = await pool.getConnection();
    try {
        console.log('Repairing Marketplace Tables...');

        // 1. marketplace_listings
        await connection.query(`CREATE TABLE IF NOT EXISTS marketplace_listings (listing_id CHAR(36) PRIMARY KEY)`);
        
        const listingsCols = [
            { name: 'seller_id', type: 'CHAR(36) NOT NULL' },
            { name: 'title', type: 'VARCHAR(255) NOT NULL' },
            { name: 'description', type: 'TEXT' },
            { name: 'price', type: 'DECIMAL(10, 2) NOT NULL' },
            { name: 'category', type: "VARCHAR(50) DEFAULT 'other'" },
            { name: '`condition`', type: "ENUM('new', 'like_new', 'good', 'fair', 'poor') DEFAULT 'good'" },
            { name: 'campus', type: 'VARCHAR(100) NOT NULL' },
            { name: 'location', type: 'VARCHAR(1000) DEFAULT NULL' },
            { name: 'is_sold', type: 'TINYINT(1) DEFAULT 0' },
            { name: 'status', type: "ENUM('active', 'sold', 'pending', 'deleted') DEFAULT 'active'" },
            { name: 'view_count', type: 'INT DEFAULT 0' },
            { name: 'image_url', type: 'VARCHAR(500) DEFAULT NULL' },
            { name: 'boost_count', type: 'INT DEFAULT 0' },
            { name: 'created_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP' },
            { name: 'updated_at', type: 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP' }
        ];

        for (const col of listingsCols) {
            try {
                await connection.query(`ALTER TABLE marketplace_listings ADD COLUMN ${col.name} ${col.type}`);
                console.log(`Added ${col.name} to marketplace_listings`);
            } catch (err) {
                if (err.errno !== 1060) console.log(`Skipped ${col.name} (exists)`);
            }
        }

        // 2. listing_media
        await connection.query(`
            CREATE TABLE IF NOT EXISTS listing_media (
                media_id CHAR(36) PRIMARY KEY,
                listing_id CHAR(36) NOT NULL,
                media_url VARCHAR(500) NOT NULL,
                media_type ENUM('image', 'video') NOT NULL,
                upload_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. listing_tags (Missing!)
        await connection.query(`
            CREATE TABLE IF NOT EXISTS listing_tags (
                listing_id CHAR(36) NOT NULL,
                tag_name VARCHAR(50) NOT NULL,
                PRIMARY KEY (listing_id, tag_name)
            )
        `);

        // 4. marketplace_reviews
        await connection.query(`
            CREATE TABLE IF NOT EXISTS marketplace_reviews (
                review_id CHAR(36) PRIMARY KEY,
                listing_id CHAR(36),
                reviewer_id CHAR(36) NOT NULL,
                reviewee_id CHAR(36) NOT NULL,
                rating TINYINT NOT NULL,
                comment TEXT,
                transaction_type ENUM('buyer', 'seller') NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 5. marketplace_favorites
        await connection.query(`
            CREATE TABLE IF NOT EXISTS marketplace_favorites (
                favorite_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                listing_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ Repair complete!');
    } catch (err) {
        console.error('❌ Repair failed:', err);
    } finally {
        connection.release();
        process.exit();
    }
}

repair();
