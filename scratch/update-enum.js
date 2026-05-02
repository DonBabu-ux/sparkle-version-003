require('dotenv').config();
const pool = require('../config/database');

async function run() {
    try {
        await pool.query("ALTER TABLE marketplace_messages MODIFY COLUMN message_type ENUM('text','image','video','offer','system') DEFAULT 'text'");
        console.log('Success: Enum updated');
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}
run();
