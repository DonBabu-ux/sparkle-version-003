require('dotenv').config();
const pool = require('../config/database');
const userId = 'f8637979-873e-4d33-b92a-32ef53a87174';

async function test() {
    try {
        const query = `
            SELECT c.*, 
                   u1.username as buyer_username, u1.name as buyer_name, u1.avatar_url as buyer_avatar,
                   u2.username as seller_username, u2.name as seller_name, u2.avatar_url as seller_avatar,
                   l.title as listing_title, l.price as listing_price
            FROM marketplace_conversations c
            LEFT JOIN users u1 ON c.buyer_id = u1.user_id
            LEFT JOIN users u2 ON c.seller_id = u2.user_id
            LEFT JOIN marketplace_listings l ON c.listing_id = l.listing_id
            WHERE c.buyer_id = ? OR c.seller_id = ?
        `;
        const [res] = await pool.query(query, [userId, userId]);
        console.log('Success! Found rows:', res.length);
        if (res.length > 0) console.log('First row:', JSON.stringify(res[0], null, 2));
    } catch (err) {
        console.error('Query failed with error:', err.message);
        console.error('Full error:', err);
    } finally {
        process.exit();
    }
}

test();
