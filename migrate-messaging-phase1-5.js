require('dotenv').config();
const pool = require('./config/database');

async function migrate() {
    try {
        console.log('🚀 Starting Phase 1-5 Messaging schema migration...');
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
        await addColumn('edited_at', 'TIMESTAMP NULL DEFAULT NULL');
        await addColumn('deleted_for', 'TEXT NULL');
        await addColumn('forwarded', 'TINYINT(1) DEFAULT 0');
        await addColumn('forwarded_from', 'VARCHAR(255) NULL DEFAULT NULL');
        await addColumn('delivered_at', 'TIMESTAMP NULL DEFAULT NULL');
        await addColumn('metadata', 'TEXT NULL');

        // Add useful indexes idempotently
        try {
            await pool.query(`CREATE INDEX idx_messages_chat_type ON messages(chat_id, type)`);
            console.log('✅ Created index idx_messages_chat_type');
        } catch (e) {
            console.log('ℹ️ Index idx_messages_chat_type exists or already created');
        }

        try {
            await pool.query(`CREATE INDEX idx_messages_chat_pinned ON messages(chat_id, pinned)`);
            console.log('✅ Created index idx_messages_chat_pinned');
        } catch (e) {
            console.log('ℹ️ Index idx_messages_chat_pinned exists or already created');
        }

        try {
            await pool.query(`CREATE INDEX idx_messages_sent_at ON messages(sent_at)`);
            console.log('✅ Created index idx_messages_sent_at');
        } catch (e) {
            console.log('ℹ️ Index idx_messages_sent_at exists or already created');
        }

        console.log('✨ Phase 1-5 Messaging migration completed successfully!');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    } finally {
        process.exit();
    }
}

migrate();
