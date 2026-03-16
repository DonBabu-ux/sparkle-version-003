require('dotenv').config();
const db = require('./config/database');
const Message = require('./models/Message');

async function testQuery() {
    try {
        console.log('Testing getUserConversations query...');
        // Let's use a dummy userId
        const userId = 'some-uuid'; 
        const convs = await Message.getUserConversations(userId);
        console.log('Query successful! Count:', convs.length);
        process.exit(0);
    } catch (err) {
        console.error('Query FAILED!');
        console.error(err);
        process.exit(1);
    }
}
testQuery();
