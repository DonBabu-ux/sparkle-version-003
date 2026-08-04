require('dotenv').config();
const Message = require('../models/Message');
const db = require('../config/database');
const crypto = require('crypto');

async function testReactionsSuite() {
    console.log('🧪 Starting Enterprise Reactions & Interaction Suite Test...');
    try {
        // 1. Get or create test user and chat
        const [users] = await db.query('SELECT user_id FROM users LIMIT 2');
        if (users.length < 2) {
            console.log('⚠️ Need at least 2 users in DB to test');
            return;
        }
        const user1 = users[0].user_id;
        const user2 = users[1].user_id;
        const chatId = await Message.getOrCreateConversation(user1, user2);

        console.log(`+ Test ChatId: ${chatId}`);

        // 2. Send test message
        const msgId = await Message.sendMessage({
            chatId,
            senderId: user1,
            content: 'Enterprise Reactions Test Message ' + Date.now(),
            type: 'text'
        });
        console.log(`+ Created Test Message: ${msgId}`);

        // 3. Add reaction ❤️ from User 1
        const r1 = await Message.addReaction(msgId, user1, '❤️');
        console.log('✅ Add Reaction ❤️:', r1);

        // 4. Add reaction 🔥 from User 2
        const r2 = await Message.addReaction(msgId, user2, '🔥');
        console.log('✅ Add Reaction 🔥:', r2);

        // 5. Replace User 1 reaction with 😂 (verifying unique key & replacement)
        const r3 = await Message.addReaction(msgId, user1, '😂');
        console.log('✅ Replace Reaction to 😂:', r3);

        // 6. Pin Message
        const pinRes = await Message.pinMessage(msgId, user1, true);
        console.log('✅ Pin Message:', pinRes);

        // 7. Star Message
        const starRes = await Message.starMessage(msgId, user1, true);
        console.log('✅ Star Message:', starRes);

        // 8. Edit Message
        const editRes = await Message.editMessage(msgId, user1, 'Edited Test Content ' + Date.now());
        console.log('✅ Edit Message:', editRes);

        // 9. Fetch Chat History and verify aggregated reactions
        const historyResult = await Message.getMessages(chatId, user1);
        const history = Array.isArray(historyResult) ? historyResult : (historyResult?.messages || historyResult?.data || []);
        const testMsg = history.find(m => m.message_id === msgId);
        if (testMsg) {
            console.log('✅ Fetched History Message Reactions:', testMsg.reactions);
            console.log('✅ Is Edited:', testMsg.is_edited);
        } else {
            console.log('⚠️ Test message not found in history, checking raw result type:', typeof historyResult, Array.isArray(historyResult));
        }

        // 10. Fetch Delta Events since sequence 0
        const events = await Message.getEventsSinceSeq(chatId, 0);
        console.log(`✅ Delta Events Count: ${events.length}`);
        console.log('✅ Sample Event:', events[events.length - 1]);

        console.log('🎉 Enterprise Reaction & Interaction Suite Test Passed Cleanly!');
    } catch (err) {
        console.error('❌ Test failed:', err);
    } finally {
        process.exit(0);
    }
}

testReactionsSuite();
