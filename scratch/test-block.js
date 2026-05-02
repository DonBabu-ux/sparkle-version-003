require('dotenv').config();
const pool = require('../config/database');

async function testBlock() {
    try {
        const { v4: uuidv4 } = require('uuid');
        const blockerId = uuidv4();
        const blockedId = uuidv4();
        
        console.log('--- Testing Block Logic ---');
        // Check if conversation exists
        const [convs] = await pool.query('SELECT id, is_archived FROM marketplace_conversations WHERE (buyer_id = ? AND seller_id = ?) OR (buyer_id = ? AND seller_id = ?)', [blockerId, blockedId, blockedId, blockerId]);
        console.log('Existing conversations:', convs);
        
        // Run block logic
        console.log('Blocking user...');
        await pool.query(
            `UPDATE marketplace_conversations SET is_archived = 1 WHERE (buyer_id = ? AND seller_id = ?) OR (buyer_id = ? AND seller_id = ?)`,
            [blockerId, blockedId, blockedId, blockerId]
        );
        
        const [updated] = await pool.query('SELECT id, is_archived FROM marketplace_conversations WHERE (buyer_id = ? AND seller_id = ?) OR (buyer_id = ? AND seller_id = ?)', [blockerId, blockedId, blockedId, blockerId]);
        console.log('Updated conversations:', updated);
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
testBlock();
