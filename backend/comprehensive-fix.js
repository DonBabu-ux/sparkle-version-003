const pool = require('./config/database');
const { v4: uuidv4 } = require('uuid');

async function fixAll() {
    console.log('🚀 Starting Comprehensive Fix...');
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('✅ Connected to database.');

        // 1. Fix Users Table (Role & Is Verified)
        console.log('\n--- Checking Users Table ---');
        const [userCols] = await connection.query('DESCRIBE users');
        const colNames = userCols.map(c => c.Field);

        if (!colNames.includes('role')) {
            console.log('Adding role column...');
            await connection.query("ALTER TABLE users ADD COLUMN role ENUM('member', 'moderator', 'admin') DEFAULT 'member'");
            console.log('✅ role column added.');
        }

        if (!colNames.includes('is_verified')) {
            console.log('Adding is_verified column...');
            await connection.query("ALTER TABLE users ADD COLUMN is_verified TINYINT(1) DEFAULT 0");
            console.log('✅ is_verified column added.');
        }

        // Set first user as admin
        const [users] = await connection.query('SELECT user_id FROM users ORDER BY joined_at LIMIT 1');
        if (users.length > 0) {
            await connection.query('UPDATE users SET role = "admin" WHERE user_id = ?', [users[0].user_id]);
            console.log('✅ First user set as admin.');
        }

        // 2. Ensure Marketplace Tables exist and are synchronized
        console.log('\n--- Verifying Marketplace Tables ---');
        const marketplaceTables = [
            `CREATE TABLE IF NOT EXISTS marketplace_listings (
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
            
            `CREATE TABLE IF NOT EXISTS listing_media (
                media_id VARCHAR(36) PRIMARY KEY,
                listing_id VARCHAR(36) NOT NULL,
                media_url VARCHAR(500) NOT NULL,
                media_type VARCHAR(50) DEFAULT 'image',
                upload_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

            `CREATE TABLE IF NOT EXISTS marketplace_favorites (
                favorite_id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                listing_id VARCHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE,
                UNIQUE KEY unique_user_listing (user_id, listing_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

            `CREATE TABLE IF NOT EXISTS safe_meetup_locations (
                location_id CHAR(36) NOT NULL,
                campus VARCHAR(100) NOT NULL,
                name VARCHAR(255) NOT NULL,
                building VARCHAR(255),
                description TEXT,
                is_verified TINYINT(1) DEFAULT 0,
                is_24_7 TINYINT(1) DEFAULT 0,
                has_security TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (location_id),
                INDEX idx_safe_locations_campus (campus, is_verified)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
        ];

        for (const sql of marketplaceTables) {
            await connection.query(sql);
        }
        console.log('✅ Marketplace tables verified/created.');

        // 3. Populate sample data if empty
        console.log('\n--- Checking Sample Data ---');
        const [listingCount] = await connection.query('SELECT COUNT(*) as count FROM marketplace_listings');
        if (listingCount[0].count === 0 && users.length > 0) {
            console.log('No listings found. Adding real sample data...');
            const sample = [
                [uuidv4(), users[0].user_id, 'MacBook Air M2', 'Mint condition, 8GB RAM, 256GB SSD. Used for one semester.', 120000, 'electronics', 'like_new', 'main_campus', 'Library fountain'],
                [uuidv4(), users[0].user_id, 'Psychology 101 Notes', 'Full set of notes for the current semester. Handwritten and digital.', 500, 'books', 'good', 'main_campus', 'Student center'],
                [uuidv4(), users[0].user_id, 'Nike Air Force 1', 'Size 42, white. Only worn twice, too small for me.', 4500, 'fashion', 'good', 'main_campus', 'Dorm block B']
            ];
            for (const item of sample) {
                await connection.query(
                    'INSERT INTO marketplace_listings (listing_id, seller_id, title, description, price, category, \`condition\`, campus, location) VALUES (?,?,?,?,?,?,?,?,?)',
                    item
                );
            }
            console.log('✅ Sample listings added.');
        }

        const [locCount] = await connection.query('SELECT COUNT(*) as count FROM safe_meetup_locations');
        if (locCount[0].count === 0) {
            console.log('No safe locations found. Adding them...');
            const locations = [
                [uuidv4(), 'main_campus', 'Campus Security Office', 'Gate A', 'Available 24/7, high visibility.', 1, 1, 1],
                [uuidv4(), 'main_campus', 'Student Union Lounge', 'B1', 'Busy public area.', 1, 0, 0],
                [uuidv4(), 'main_campus', 'Main Library Entrance', 'Admin Block', 'Monitored by cameras.', 1, 0, 1]
            ];
            for (const loc of locations) {
                await connection.query(
                    'INSERT INTO safe_meetup_locations (location_id, campus, name, building, description, is_verified, is_24_7, has_security) VALUES (?,?,?,?,?,?,?,?)',
                    loc
                );
            }
            console.log('✅ Safe locations added.');
        }

        console.log('\n🎉 ALL FIXES APPLIED SUCCESSFULLY!');
    } catch (error) {
        console.error('❌ ERROR DURING FIX:', error.message);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

fixAll();
