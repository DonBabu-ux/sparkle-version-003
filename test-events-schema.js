const db = require('./config/database');
const fs = require('fs');
require('dotenv').config();

async function test() {
    try {
        const [events] = await db.query('DESCRIBE campus_events');
        const [rsvps] = await db.query('DESCRIBE event_rsvps');
        const output = { campus_events: events, event_rsvps: rsvps };
        fs.writeFileSync('schema_events.json', JSON.stringify(output, null, 2), 'utf-8');
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
}
test();
