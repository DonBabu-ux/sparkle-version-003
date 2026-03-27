const pool = require('./config/database');

async function migrate() {
    console.log('🚀 Starting theme migration...');
    try {
        await pool.query("ALTER TABLE users ADD COLUMN chat_theme VARCHAR(50) DEFAULT 'classic_doodle'");
        console.log('✅ Success: chat_theme column added to users table.');
        process.exit(0);
    } catch (err) {
        if (err.code === 'ER_DUP_COLUMN_NAME' || err.sqlState === '42S21') {
            console.log('ℹ️ Note: chat_theme column already exists.');
            process.exit(0);
        } else {
            console.error('❌ Migration failed:', err.message);
            console.log('\n--- Manual Instruction ---');
            console.log('If the automated script fails, please run the following SQL manually in your database tool:');
            console.log("ALTER TABLE users ADD COLUMN chat_theme VARCHAR(50) DEFAULT 'classic_doodle';");
            process.exit(1);
        }
    }
}

migrate();
