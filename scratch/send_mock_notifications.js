require('dotenv').config();
const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');

async function sendMockNotifications() {
    const users = [
        "edc39ce6-bcb3-48ae-9bd9-61e7196c24e7", // alicejohnson
        "dc014fa0-a91b-431d-99f2-12dfcb467c57", // bobsmith
        "e3d51846-85b6-4e83-81d5-a224c64f87e9", // carolwhite
        "2ffb181e-1b52-404a-abc9-bb408c249508", // collo
        "5a4037df-bbae-4779-9574-cd5399b9d889"  // davidlee
    ];

    const pollId = "0dafcf19-d4fa-48bb-b314-dce97004952b";
    const pollQuestion = "Best time for classes?";

    const mockData = [
        {
            type: 'poll_ending',
            title: 'Campus Consensus',
            content: `Consensus ending soon: ${pollQuestion}`,
            action_url: `/polls/${pollId}`
        },
        {
            type: 'poll_result',
            title: 'Consensus Reached',
            content: `A final decision has been reached for: ${pollQuestion}`,
            action_url: `/polls/${pollId}`
        },
        {
            type: 'poll_invite',
            title: 'Consensus Invite',
            content: `You've been invited to participate in the consensus: ${pollQuestion}`,
            action_url: `/polls/${pollId}`
        }
    ];

    try {
        for (const userId of users) {
            for (const data of mockData) {
                const id = uuidv4();
                await pool.query(`
                    INSERT INTO notifications (
                        notification_id, user_id, type, title, content, 
                        action_url, is_read, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
                `, [id, userId, data.type, data.title, data.content, data.action_url]);
                console.log(`Sent ${data.type} to user ${userId}`);
            }
        }
        console.log('Successfully sent mock notifications to all users.');
        process.exit(0);
    } catch (err) {
        console.error('Error sending mock notifications:', err);
        process.exit(1);
    }
}

sendMockNotifications();
