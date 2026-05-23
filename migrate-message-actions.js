require('dotenv').config();
const pool = require('./config/database');

async function migrate() {
    try {
        console.log('🚀 Starting message actions table migration...');
        const [columns] = await pool.query('SHOW COLUMNS FROM messages');
        const columnNames = columns.map(c => c.Field.toLowerCase());

        const addColumn = async (colName, definition) => {
            if (!columnNames.includes(colName.toLowerCase())) {
                const sql = `ALTER TABLE messages ADD COLUMN \`${colName}\` ${definition}`;
                await pool.query(sql);
                console.log(`✅ Added column: ${colName}`);
            } else {
                console.log(`ℹ️ Column already exists: ${colName}`);
            }
        };

        await addColumn('pinned', 'TINYINT(1) DEFAULT 0');
        await addColumn('pinned_at', 'TIMESTAMP NULL DEFAULT NULL');
        await addColumn('pinned_by', 'CHAR(36) NULL DEFAULT NULL');
        await addColumn('edited', 'TINYINT(1) DEFAULT 0');
        await addColumn('deleted_for', 'TEXT NULL');
        await addColumn('forwarded', 'TINYINT(1) DEFAULT 0');
        await addColumn('forwarded_from', 'VARCHAR(255) NULL DEFAULT NULL');

        console.log('✨ Migration complete!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
