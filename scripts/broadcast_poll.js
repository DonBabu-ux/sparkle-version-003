require('dotenv').config();
const { safeQuery } = require('../config/database');
const SystemMessageService = require('../services/systemMessage.service');
const logger = require('../utils/logger');
const crypto = require('crypto');

async function broadcastPoll() {
    try {
        console.log('Fetching all users...');
        const users = await safeQuery('SELECT user_id FROM users WHERE user_type != "system"');
        console.log(`Found ${users.length} users to broadcast to.`);

        const messageText = "We want your feedback! Should we open the Sparkle Official Account for direct replies? Cast your vote below. The majority vote will decide our next update!";
        
        const payload = {
            title: 'Community Poll: Open Replies?',
            badge: 'Community Poll',
            actions: [
                { label: 'Yes, Open Replies', route: '/vote-official-replies/yes', style: 'primary' },
                { label: 'No, Keep Closed', route: '/vote-official-replies/no', style: 'secondary' }
            ]
        };

        let sentCount = 0;

        for (const user of users) {
            const chatId = await SystemMessageService.ensureSystemConversation(user.user_id);
            if (chatId) {
                const msgId = crypto.randomUUID();
                await safeQuery(
                    `INSERT INTO messages
                       (message_id, conversation_id, sender_id, content, type, context, message_category, payload, is_read, sent_at)
                     VALUES (?, ?, ?, ?, ?, 'system', ?, ?, 0, NOW())`,
                    [
                        msgId, 
                        chatId, 
                        process.env.SPARKLE_SYSTEM_USER_ID || 'd75fe3b5-7a45-4581-ab13-91934d8b54de', 
                        messageText, 
                        'system', 
                        'announcement', 
                        JSON.stringify(payload)
                    ]
                );

                await safeQuery(
                    'UPDATE personal_chats SET last_message_time = NOW(), conversation_type = "system" WHERE chat_id = ?',
                    [chatId]
                );
                
                sentCount++;
            }
        }

        console.log(`Successfully broadcasted poll to ${sentCount} users.`);
        process.exit(0);
    } catch (err) {
        console.error('Error broadcasting poll:', err);
        process.exit(1);
    }
}

broadcastPoll();
