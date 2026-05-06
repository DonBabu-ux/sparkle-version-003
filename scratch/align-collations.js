require('dotenv').config();
const pool = require('../config/database');

async function run() {
    console.log('--- Database Collation Alignment ---');
    
    // Get database name
    const [dbResult] = await pool.query('SELECT DATABASE() as db');
    const dbName = dbResult[0].db;
    console.log(`Targeting database: ${dbName}`);

    // Convert database default
    await pool.query(`ALTER DATABASE ${dbName} CHARACTER SET = utf8mb4 COLLATE = utf8mb4_unicode_ci`);
    console.log(`✅ Database ${dbName} default collation set to utf8mb4_unicode_ci`);

    const tablesToFix = [
        'users',
        'marketplace_listings',
        'marketplace_message_status',
        'marketplace_message_settings',
        'marketplace_conversations', // Re-enforce
        'marketplace_messages',      // Re-enforce
        'marketplace_message_reactions' // Re-enforce
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

    console.log('\n--- Final Collation Check ---');
    const [tables] = await pool.query('SHOW TABLE STATUS');
    const status = tables.filter(t => tablesToFix.includes(t.Name)).map(t => ({ Name: t.Name, Collation: t.Collation }));
    console.table(status);

    process.exit(0);
}

run().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
