require('dotenv').config();
const pool = require('../config/database');
const convId = '83a88d64-d4ae-4fd4-9f03-02ca7e473752';

async function test() {
    try {
        const query = `
            SELECT m.*, s.delivered_at, s.read_at, u.username as sender_username, u.name as sender_name, u.avatar_url as sender_avatar,
                   (SELECT JSON_ARRAYAGG(JSON_OBJECT('user_id', user_id, 'reaction', reaction)) FROM marketplace_message_reactions WHERE message_id = m.id) as reactions
            FROM marketplace_messages m
            LEFT JOIN marketplace_message_status s ON m.id = s.message_id
            LEFT JOIN users u ON m.sender_id = u.user_id
            WHERE m.conversation_id = ?
            ORDER BY m.created_at ASC
        `;
        const [res] = await pool.query(query, [convId]);
        console.log('Success! Found messages:', res.length);
    } catch (err) {
        console.error('Query failed with error:', err.message);
        console.error('Full error:', err);
    } finally {
        process.exit();
    }
}

test();
