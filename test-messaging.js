const { v4: uuidv4 } = require('uuid');
const db = require('./config/database');
const Message = require('./models/Message');

async function test() {
    try {
        const [users] = await db.query('SELECT user_id, username FROM users LIMIT 2');
        if (users.length < 2) {
            console.log('Need at least 2 users to test messaging');
            process.exit(0);
        }

        const user1 = users[0];
        const user2 = users[1];

        console.log(`Creating test data for ${user1.username} and ${user2.username}`);

        // 1. Create a notification for user 1
        const notifId = uuidv4();
        await db.query(`
            INSERT INTO notifications (
                notification_id, user_id, type, title, content, actor_id, is_read, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 0, NOW())
        `, [notifId, user1.user_id, 'NEW_MESSAGE', 'New Message', `You have a test message from ${user2.username}`, user2.user_id]);

        console.log('Created test notification');

        // 2. Create a chat message from user 2 to user 1
        const msgId = uuidv4();
        await db.query(`
            INSERT INTO messages (
                message_id, recipient_id, sender_id, content, type, sent_at
            ) VALUES (?, ?, ?, ?, 'text', NOW())
        `, [msgId, user1.user_id, user2.user_id, 'Hello! This is an automated test message to verify the inbox works!']);

        console.log('Created test message');
        console.log(`Test data created successfully! Check dashboard as ${user1.username}`);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

test();
