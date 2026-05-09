require('dotenv').config();
const pool = require('../config/database');

async function cleanupMockNotifications() {
    const types = ['poll_ending', 'poll_result', 'poll_invite'];
    
    try {
        const [result] = await pool.query(`
            DELETE FROM notifications 
            WHERE type IN (?)
        `, [types]);
        
        console.log(`Successfully removed ${result.affectedRows} mock notifications.`);
        process.exit(0);
    } catch (err) {
        console.error('Error cleaning up mock notifications:', err);
        process.exit(1);
    }
}

cleanupMockNotifications();
