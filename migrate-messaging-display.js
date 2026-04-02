require('dotenv').config();
const pool = require('./config/database');

async function migrate() {
    try {
        console.log('Migrating Messaging & Display columns...');
        const [columns] = await pool.query('SHOW COLUMNS FROM users');
        const columnNames = columns.map(c => c.Field);

        const adds = [];
        if (!columnNames.includes('dm_permission')) adds.push("ADD COLUMN dm_permission VARCHAR(20) DEFAULT 'everyone'");
        if (!columnNames.includes('last_seen')) adds.push("ADD COLUMN last_seen VARCHAR(20) DEFAULT 'everyone'");
        if (!columnNames.includes('font_scale')) adds.push("ADD COLUMN font_scale VARCHAR(20) DEFAULT 'standard'");
        // language is already there in migrate-appearance.js, but let's ensure it's here
        if (!columnNames.includes('language')) adds.push("ADD COLUMN language VARCHAR(10) DEFAULT 'en'");

        if (adds.length > 0) {
            await pool.query(`ALTER TABLE users ${adds.join(', ')}`);
            console.log('Added columns:', adds.map(a => a.split(' ')[2]).join(', '));
        } else {
            console.log('All columns already exist.');
        }

        console.log('Migration complete!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
