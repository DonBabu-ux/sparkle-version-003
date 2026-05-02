require('dotenv').config();
const pool = require('../config/database');

async function test插入() {
    try {
        // Need real user IDs for foreign keys
        const [users] = await pool.query('SELECT user_id FROM users LIMIT 2');
        if (users.length < 2) {
            console.log('Need at least 2 users in DB to test blocking');
            process.exit(0);
        }
        
        const blockerId = users[0].user_id;
        const blockedId = users[1].user_id;
        
        console.log(`Testing block between ${blockerId} and ${blockedId}`);
        
        // Try to insert
        try {
            await pool.query(
                'INSERT INTO user_blocks (block_id, blocker_id, blocked_id) VALUES (UUID(), ?, ?)',
                [blockerId, blockedId]
            );
            console.log('Insert successful');
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                console.log('Block already exists, testing archival...');
            } else {
                throw err;
            }
        }
        
        // Test archival
        await pool.query(
            `UPDATE marketplace_conversations SET is_archived = 1 WHERE (buyer_id = ? AND seller_id = ?) OR (buyer_id = ? AND seller_id = ?)`,
            [blockerId, blockedId, blockedId, blockerId]
        );
        console.log('Archive update successful');
        
        process.exit(0);
    } catch (err) {
        console.error('DIAGNOSTIC ERROR:', err);
        process.exit(1);
    }
}
test插入();
