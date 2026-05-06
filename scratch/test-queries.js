require('dotenv').config();
const pool = require('../config/database');

async function test() {
    try {
        console.log('Testing Marketplace Queries...');
        
        // 1. Check if we can fetch conversations
        const [convs] = await pool.query('SELECT id FROM marketplace_conversations LIMIT 1');
        if (convs.length === 0) {
            console.log('No conversations found in DB to test.');
            return;
        }
        const convId = convs[0].id;
        console.log(`Found conversation: ${convId}`);

        // 2. Test the message + reactions query
        const query = `
            SELECT m.*, 
                   (SELECT JSON_ARRAYAGG(JSON_OBJECT('user_id', user_id, 'reaction', emoji)) 
                    FROM marketplace_message_reactions 
                    WHERE message_id = m.id) as reactions
            FROM marketplace_messages m
            WHERE m.conversation_id = ?
            LIMIT 5
        `;
        const [messages] = await pool.query(query, [convId]);
        console.log('✅ Messages query SUCCESS');
        console.log('Sample reactions:', messages.map(m => m.reactions));

        process.exit(0);
    } catch (err) {
        console.error('❌ Query FAILED:', err.message);
        process.exit(1);
    }
}

test();
