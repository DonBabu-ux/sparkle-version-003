require('dotenv').config();
const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

async function seed() {
    try {
        console.log('🌱 Seeding Marketplace Extras...');

        // 1. Create some Buy and Sell Groups
        const groups = [
            { name: 'Nairobi Tech Marketplace', category: 'electronics', campus: 'Nairobi' },
            { name: 'University Book Exchange', category: 'books', campus: 'Main Campus' },
            { name: 'Campus Thrift & Fashion', category: 'clothing', campus: 'Main Campus' },
            { name: 'Dorm Essentials Sale', category: 'furniture', campus: 'Main Campus' }
        ];

        for (const g of groups) {
            const [exists] = await pool.query('SELECT group_id FROM groups WHERE name = ?', [g.name]);
            if (exists.length === 0) {
                const groupId = uuidv4();
                await pool.query(
                    'INSERT INTO groups (group_id, name, description, campus, category, is_public, icon_url) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [groupId, g.name, `A group for ${g.name}`, g.campus, g.category, true, '/uploads/groups/default.png']
                );
                console.log(`✅ Created group: ${g.name}`);
            }
        }

        // 2. Mark some listings as promoted (if column exists)
        // Check if is_promoted exists in marketplace_listings
        const [cols] = await pool.query('SHOW COLUMNS FROM marketplace_listings LIKE "is_promoted"');
        if (cols.length > 0) {
            await pool.query('UPDATE marketplace_listings SET is_promoted = 1 ORDER BY RAND() LIMIT 5');
            console.log('✅ Promoted some random listings');
        }

        console.log('✨ Seeding complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding failed:', err);
        process.exit(1);
    }
}

seed();
