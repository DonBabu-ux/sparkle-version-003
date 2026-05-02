require('dotenv').config();
const pool = require('../config/database');

async function testBatch1() {
    const buyerId = 'f8637979-873e-4d33-b92a-32ef53a87174'; // Current user
    const sellerId = '608ef7ca-4e2e-4911-9293-6988b111195b'; // Real user ID
    const listingId = 'test-listing-id';

    try {
        console.log('--- Testing Batch 1: Core Settings ---');

        // 1. Setup seller settings: none
        await pool.query("INSERT INTO marketplace_message_settings (user_id, who_can_message_me) VALUES (?, 'none') ON DUPLICATE KEY UPDATE who_can_message_me = 'none'", [sellerId]);
        console.log('Case 1: Seller set to "none"');
        
        // Simulating the API check (since I can't easily hit the actual endpoint with auth in a script)
        const checkResult = await simulatePostConversation(buyerId, sellerId);
        console.log('Result:', checkResult);

        // 2. Setup block
        await pool.query("INSERT INTO user_blocks (block_id, blocker_id, blocked_id) VALUES (UUID(), ?, ?) ON DUPLICATE KEY UPDATE blocker_id = blocker_id", [sellerId, buyerId]);
        console.log('Case 2: Seller blocked Buyer');
        const checkResult2 = await simulatePostConversation(buyerId, sellerId);
        console.log('Result:', checkResult2);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

async function simulatePostConversation(buyerId, sellerId) {
    // A simplified version of the logic in marketplaceChatRoutes.js
    const [blocks] = await pool.query(
        `SELECT * FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
        [sellerId, buyerId, buyerId, sellerId]
    );

    if (blocks.length > 0) return { status: 403, error: 'Message blocked. You or the other user have blocked each other.' };

    const [settings] = await pool.query(
        `SELECT who_can_message_me FROM marketplace_message_settings WHERE user_id = ?`,
        [sellerId]
    );

    if (settings.length > 0) {
        const restriction = settings[0].who_can_message_me;
        if (restriction === 'none') return { status: 403, error: 'This user is not accepting new marketplace messages at this time.' };
        if (restriction === 'vouched_only') return { status: 403, error: 'Vouched only restriction active' };
    }

    return { status: 200, success: true };
}

testBatch1();
