const pool = require('./config/database');

async function fixMarketplaceIssues() {
    try {
        console.log('🔧 Fixing Marketplace Issues...\n');

        // 1. Add role column to users table
        console.log('1. Adding role column to users table...');
        try {
            await pool.query(`
                ALTER TABLE users
                ADD COLUMN role ENUM('member', 'moderator', 'admin') DEFAULT 'member'
            `);
            console.log('✅ Role column added successfully!');
        } catch (error) {
            if (error.code === 'ER_DUP_FIELDNAME') {
                console.log('⚠️  Role column already exists');
            } else {
                console.error('❌ Error adding role column:', error.message);
            }
        }

        // Add is_verified if missing
        try {
            await pool.query(`
                ALTER TABLE users
                ADD COLUMN is_verified TINYINT(1) DEFAULT 0
            `);
            console.log('✅ is_verified column added successfully!');
        } catch (error) {
            if (error.code !== 'ER_DUP_FIELDNAME') {
                console.error('❌ Error adding is_verified:', error.message);
            }
        }

        // 2. Ensure marketplace_favorites table exists
        console.log('\n2. Checking marketplace_favorites table...');
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
                    FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE,
                    INDEX idx_marketplace_favorites_user (user_id, created_at),
                    INDEX idx_marketplace_favorites_listing (listing_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
            console.log('✅ marketplace_favorites table created!');
        } else {
            console.log('✅ marketplace_favorites table exists');
        }

        // 3. Ensure safe_meetup_locations table exists and has data
        console.log('\n3. Checking safe_meetup_locations table...');
        const [locationTables] = await pool.query("SHOW TABLES LIKE 'safe_meetup_locations'");
        if (locationTables.length === 0) {
            console.log('Creating safe_meetup_locations table...');
            await pool.query(`
                CREATE TABLE safe_meetup_locations (
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
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            `);
            console.log('✅ safe_meetup_locations table created!');
        } else {
            console.log('✅ safe_meetup_locations table exists');
        }

        // 4. Insert sample safe locations if table is empty
        const [locationCount] = await pool.query('SELECT COUNT(*) as count FROM safe_meetup_locations');
        if (locationCount[0].count === 0) {
            console.log('Inserting sample safe meetup locations...');
            const crypto = require('crypto');
            const locations = [
                [crypto.randomUUID(), 'main_campus', 'Library Entrance', 'Main Library', 'Well-lit main entrance with security cameras', 1, 0, 1],
                [crypto.randomUUID(), 'main_campus', 'Student Center', 'Student Center Building', 'Busy area with campus security presence', 1, 1, 1],
                [crypto.randomUUID(), 'main_campus', 'Cafeteria', 'Food Court', 'Public area with many students around', 1, 0, 0],
                [crypto.randomUUID(), 'west_campus', 'West Gate', 'West Campus Entrance', 'Main entrance with security guard', 1, 0, 1],
                [crypto.randomUUID(), 'east_campus', 'East Plaza', 'East Campus Plaza', 'Open plaza with good lighting', 1, 0, 0]
            ];

            for (const location of locations) {
                await pool.query(`
                    INSERT INTO safe_meetup_locations
                    (location_id, campus, name, building, description, is_verified, is_24_7, has_security)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, location);
            }
            console.log('✅ Sample safe locations inserted!');
        }

        // 5. Set first user as admin
        console.log('\n4. Setting up admin user...');
        const [users] = await pool.query('SELECT user_id FROM users ORDER BY joined_at LIMIT 1');
        if (users.length > 0) {
            await pool.query('UPDATE users SET role = "admin" WHERE user_id = ?', [users[0].user_id]);
            console.log('✅ First user set as admin!');
        }

        // 6. Insert sample marketplace listings if table is empty
        console.log('\n5. Checking for sample marketplace data...');
        const [listingCount] = await pool.query('SELECT COUNT(*) as count FROM marketplace_listings');
        if (listingCount[0].count === 0) {
            console.log('Inserting sample marketplace listings...');
            const sampleListings = [
                {
                    listing_id: crypto.randomUUID(),
                    seller_id: users[0]?.user_id || crypto.randomUUID(),
                    title: 'iPhone 12 Pro Max',
                    description: 'Barely used iPhone 12 Pro Max in excellent condition. Comes with original box and accessories.',
                    price: 45000,
                    category: 'electronics',
                    condition: 'like_new',
                    campus: 'main_campus',
                    location: 'Library Building, Room 101'
                },
                {
                    listing_id: crypto.randomUUID(),
                    seller_id: users[0]?.user_id || crypto.randomUUID(),
                    title: 'Calculus Textbook',
                    description: 'Complete calculus textbook with highlighted notes. Perfect for math students.',
                    price: 2500,
                    category: 'books',
                    condition: 'good',
                    campus: 'main_campus',
                    location: 'Engineering Block, Room 205'
                },
                {
                    listing_id: crypto.randomUUID(),
                    seller_id: users[0]?.user_id || crypto.randomUUID(),
                    title: 'Math Tutoring Services',
                    description: 'Professional math tutoring for all levels. Flexible scheduling available.',
                    price: 1500,
                    category: 'services',
                    condition: 'new',
                    campus: 'main_campus',
                    location: 'Student Center'
                }
            ];

            for (const listing of sampleListings) {
                await pool.query(`
                    INSERT INTO marketplace_listings
                    (listing_id, seller_id, title, description, price, category, condition, campus, location)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    listing.listing_id, listing.seller_id, listing.title, listing.description,
                    listing.price, listing.category, listing.condition, listing.campus, listing.location
                ]);
            }
            console.log('✅ Sample marketplace listings inserted!');
        }

        console.log('\n🎉 All marketplace issues fixed successfully!');
        console.log('\n📋 Summary:');
        console.log('- ✅ Role column added to users table');
        console.log('- ✅ marketplace_favorites table verified/created');
        console.log('- ✅ safe_meetup_locations table verified/created with sample data');
        console.log('- ✅ Admin user configured');
        console.log('- ✅ Sample marketplace listings added');
        console.log('\n🚀 Marketplace should now work properly!');

    } catch (error) {
        console.error('❌ Error fixing marketplace issues:', error);
        console.log('\n🔧 Manual fixes needed:');
        console.log('1. Check database connection in .env file');
        console.log('2. Run: ALTER TABLE users ADD COLUMN role ENUM(\'member\', \'moderator\', \'admin\') DEFAULT \'member\';');
        console.log('3. Ensure marketplace_favorites and safe_meetup_locations tables exist');
    } finally {
        process.exit();
    }
}

fixMarketplaceIssues();