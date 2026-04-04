const db = require('./config/database');
require('dotenv').config();

async function updateSchema() {
    let connection;
    try {
        connection = await db.getConnection();
        
        console.log("Altering event_rsvps status enum...");
        await connection.query("ALTER TABLE event_rsvps MODIFY COLUMN status ENUM('going','maybe','not_going','attended') DEFAULT 'going'");
        
        console.log("Schema update completed.");
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    } finally {
        if(connection) connection.release();
    }
}
updateSchema();
