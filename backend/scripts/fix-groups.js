require('dotenv').config();
const pool = require('../config/database');

async function fixGroups() {
    try {
        console.log('🚀 Rebranding Marketplace Groups...');

        // 1. Rebrand existing "Campus" groups to "Sparkle"
        await pool.query(`
            UPDATE groups 
            SET name = REPLACE(name, 'Campus', 'Sparkle'),
                campus = REPLACE(campus, 'Main Campus', 'Sparkle Global'),
                description = REPLACE(description, 'Campus', 'Sparkle')
            WHERE name LIKE '%Campus%' OR campus = 'Main Campus'
        `);

        // 2. Specific rebrands for tech and books
        await pool.query("UPDATE groups SET name = 'Sparkle Tech Hub', campus = 'Sparkle Global' WHERE name = 'Nairobi Tech Marketplace'");
        await pool.query("UPDATE groups SET name = 'Sparkle Book Exchange', campus = 'Sparkle Global' WHERE name = 'University Book Exchange'");
        await pool.query("UPDATE groups SET name = 'Sparkle Thrift & Fashion', campus = 'Sparkle Global' WHERE name = 'Campus Thrift & Fashion'");

        // 3. Add seed members if they have 0 members
        const [groups] = await pool.query('SELECT group_id FROM groups');
        
        for (const g of groups) {
            const [members] = await pool.query('SELECT COUNT(*) as count FROM group_members WHERE group_id = ?', [g.group_id]);
            if (members[0].count === 0) {
                console.log(`Adding seed members to group ${g.group_id}`);
                // Add at least 5-15 random members from existing users
                const [users] = await pool.query('SELECT user_id FROM users ORDER BY RAND() LIMIT 12');
                for (const u of users) {
                    await pool.query('INSERT IGNORE INTO group_members (group_id, user_id, role, status) VALUES (?, ?, "member", "active")', [g.group_id, u.user_id]);
                }
            }
        }

        console.log('✨ Groups modernized and populated!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Failed to fix groups:', err);
        process.exit(1);
    }
}

fixGroups();
