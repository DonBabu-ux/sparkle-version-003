require('dotenv').config();
const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

async function testMarketplaceFlow() {
    try {
        console.log('--- Testing Marketplace Database & Queries ---');
        
        // 1. Get sample users
        const [users] = await pool.query('SELECT user_id, username FROM users LIMIT 2');
        if (users.length < 2) {
            console.log('Not enough users to test.');
            process.exit(0);
        }
        const u1 = users[0].user_id;
        const u2 = users[1].user_id;
        console.log(`User 1: ${u1} (${users[0].username}), User 2: ${u2} (${users[1].username})`);

        // 2. Find or create a listing
        const [listings] = await pool.query('SELECT listing_id FROM marketplace_listings LIMIT 1');
        let listingId;
        if (listings.length > 0) {
            listingId = listings[0].listing_id;
        } else {
            listingId = uuidv4();
            await pool.query(
                `INSERT INTO marketplace_listings (listing_id, seller_id, title, price, category, status) VALUES (?, ?, ?, ?, ?, ?)`,
                [listingId, u2, 'Test Item', 10, 'General', 'active']
            );
        }
        console.log(`Listing ID: ${listingId}`);

        // 3. Test finding/creating a conversation
        const [convs] = await pool.query(
            `SELECT * FROM marketplace_conversations WHERE buyer_id = ? AND seller_id = ? AND listing_id = ?`,
            [u1, u2, listingId]
        );
        let convId;
        if (convs.length > 0) {
            convId = convs[0].id;
        } else {
            convId = uuidv4();
            await pool.query(
                `INSERT INTO marketplace_conversations (id, buyer_id, seller_id, listing_id, last_message) VALUES (?, ?, ?, ?, ?)`,
                [convId, u1, u2, listingId, 'Hello world']
            );
        }
        console.log(`Conversation ID: ${convId}`);

        // 4. Test Inserting Message into marketplace_messages
        const msgId = uuidv4();
        await pool.query(
            `INSERT INTO marketplace_messages (id, conversation_id, sender_id, message_text, message_type) VALUES (?, ?, ?, ?, 'text')`,
            [msgId, convId, u1, 'Test message from test script']
        );
        await pool.query(`INSERT INTO marketplace_message_status (message_id) VALUES (?)`, [msgId]);
        console.log(`Inserted message ID: ${msgId}`);

        // 5. Test Fetching Messages Query from marketplaceChatRoutes
        const [fetchedMsgs] = await pool.query(`
            SELECT m.id, m.conversation_id, m.sender_id, m.message_text, m.message_type, m.media_url, m.reply_to_id, m.created_at, m.is_edited,
                   s.delivered_at, s.read_at, u.username as sender_username, u.name as sender_name, u.avatar_url as sender_avatar
            FROM marketplace_messages m
            LEFT JOIN marketplace_message_status s ON m.id = s.message_id
            LEFT JOIN users u ON m.sender_id = u.user_id
            WHERE m.conversation_id = ?
            ORDER BY m.created_at ASC
        `, [convId]);

        console.log(`Fetched ${fetchedMsgs.length} messages for conversation ${convId}`);
        console.log('Latest message:', fetchedMsgs[fetchedMsgs.length - 1]);

        // Cleanup test message
        await pool.query(`DELETE FROM marketplace_message_status WHERE message_id = ?`, [msgId]);
        await pool.query(`DELETE FROM marketplace_messages WHERE id = ?`, [msgId]);
        console.log('Cleaned up test message.');

        console.log('--- TEST PASSED ---');
    } catch (err) {
        console.error('Test failed with error:', err);
    } finally {
        process.exit(0);
    }
}

testMarketplaceFlow();
