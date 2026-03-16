require('dotenv').config();
const db = require('./config/database');
const fs = require('fs');

async function dump() {
    try {
        const [mCols] = await db.query('DESCRIBE messages');
        fs.writeFileSync('messages_cols.json', JSON.stringify(mCols, null, 2));
        const [pcCols] = await db.query('DESCRIBE personal_chats');
        fs.writeFileSync('pc_cols.json', JSON.stringify(pcCols, null, 2));
        console.log('Schemas dumped');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}
dump();
