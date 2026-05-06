require('dotenv').config();
const pool = require('../config/database');

async function run() {
    console.log('--- Force Database Collation Alignment (Ignoring FKs) ---');
    
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('🔓 Foreign key checks disabled');

    const tablesToFix = [
        'users',
        'marketplace_listings',
        'marketplace_message_settings'
    ];

    for (const table of tablesToFix) {
        try {
            process.stdout.write(`Converting ${table}... `);
            await pool.query(`ALTER TABLE ${table} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
            process.stdout.write('✅\n');
        } catch (err) {
            process.stdout.write(`❌ ERROR: ${err.message}\n`);
        }
    }

    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('🔒 Foreign key checks re-enabled');

    console.log('\n--- Verify Alignment ---');
    const [tables] = await pool.query('SHOW TABLE STATUS');
    const status = tables.filter(t => tablesToFix.includes(t.Name)).map(t => ({ Name: t.Name, Collation: t.Collation }));
    console.table(status);

    process.exit(0);
}

run().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
