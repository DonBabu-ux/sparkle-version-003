require('dotenv').config();
const pool = require('../config/database');

async function test() {
    try {
        console.log('Testing Marketplace Conversations Query...');
        
        const userId = 'f8637979-873e-4d33-b92a-32ef53a87174'; // From user logs
        
        const query = `
            SELECT c.*, 
                   u1.username as buyer_username, u1.name as buyer_name, u1.avatar_url as buyer_avatar,
                   u2.username as seller_username, u2.name as seller_name, u2.avatar_url as seller_avatar,
                   l.title as listing_title, l.price as listing_price, l.image_url as listing_image, 
                   l.description as listing_description, l.status as listing_status
            FROM marketplace_conversations c
            LEFT JOIN users u1 ON c.buyer_id = u1.user_id
            LEFT JOIN users u2 ON c.seller_id = u2.user_id
            LEFT JOIN marketplace_listings l ON c.listing_id = l.listing_id
            WHERE c.buyer_id = ? OR c.seller_id = ?
            ORDER BY c.last_activity_at DESC
        `;
        const [conversations] = await pool.query(query, [userId, userId]);
        console.log('✅ Conversations query SUCCESS. Count:', conversations.length);

        process.exit(0);
    } catch (err) {
        console.error('❌ Query FAILED:', err.message);
        process.exit(1);
    }
}

test();
