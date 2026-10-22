const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const db = require(path.join(__dirname, '../backend/config/database'));

async function testQueries() {
    try {
        console.log('=== 1. EXPLAIN delivery_queue retry query ===');
        const [plan1] = await db.query(`
            EXPLAIN
            SELECT dq.queue_id, dq.message_id, dq.recipient_id, dq.session_id, dq.attempts,
                   m.chat_id, m.conversation_id, m.content, m.type, m.media_url, m.metadata, m.sender_id,
                   m.sent_at, m.server_sequence,
                   u.name as sender_name, u.username as sender_username, u.avatar_url as sender_avatar
            FROM delivery_queue dq
            JOIN messages m ON dq.message_id = m.message_id
            JOIN users u ON m.sender_id = u.user_id
            WHERE dq.next_retry_at <= NOW()
            ORDER BY dq.next_retry_at
            LIMIT 50
        `);
        console.table(plan1.map(p => ({
            table: p.table,
            type: p.type,
            possible_keys: p.possible_keys,
            key: p.key,
            ref: p.ref,
            rows: p.rows,
            Extra: p.Extra
        })));

        console.log('\n=== 2. EXPLAIN orphan cleanup query ===');
        const [plan2] = await db.query(`
            EXPLAIN
            SELECT dq.queue_id 
            FROM delivery_queue dq 
            LEFT JOIN messages m ON dq.message_id = m.message_id 
            WHERE m.message_id IS NULL AND dq.message_id IS NOT NULL 
            LIMIT 50
        `);
        console.table(plan2.map(p => ({
            table: p.table,
            type: p.type,
            possible_keys: p.possible_keys,
            key: p.key,
            ref: p.ref,
            rows: p.rows,
            Extra: p.Extra
        })));

        console.log('\n=== 3. Delivery queue row count ===');
        const [[dqCount]] = await db.query('SELECT COUNT(*) as c FROM delivery_queue');
        console.log('Delivery queue rows:', dqCount.c);

        console.log('\n=== 4. Messages row count ===');
        const [[msgCount]] = await db.query('SELECT COUNT(*) as c FROM messages');
        console.log('Messages rows:', msgCount.c);

        console.log('\n=== 5. EXPLAIN inbox / conversations query for sample user ===');
        const [userSample] = await db.query('SELECT user_id FROM users LIMIT 1');
        if (userSample.length > 0) {
            const uid = userSample[0].user_id;
            console.log('Testing inbox query for user:', uid);
            const t0 = Date.now();
            const Message = require(path.join(__dirname, '../backend/models/Message'));
            const convs = await Message.getUserConversations(uid);
            const duration = Date.now() - t0;
            console.log(`Retrieved ${convs.length} conversations in ${duration}ms`);
            if (convs.length > 0) {
                console.log('Sample conversation unread_count:', convs[0].unread_count, 'chat_id:', convs[0].chat_id);
            }
        }

    } catch (err) {
        console.error('Error during query verification:', err);
    } finally {
        process.exit(0);
    }
}
testQueries();
