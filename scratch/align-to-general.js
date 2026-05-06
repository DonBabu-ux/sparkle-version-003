require('dotenv').config();
const pool = require('../config/database');

async function run() {
    console.log('--- Aligning Marketplace Tables to General Collation ---');
    
    const tablesToAlign = [
        'marketplace_conversations',
        'marketplace_messages',
        'marketplace_message_reactions',
        'marketplace_message_status'
    ];

    for (const table of tablesToAlign) {
        try {
            process.stdout.write(`Aligning ${table} to general collation... `);
            await pool.query(`ALTER TABLE ${table} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
            process.stdout.write('✅\n');
        } catch (err) {
            process.stdout.write(`❌ ERROR: ${err.message}\n`);
        }
    }

    console.log('\n--- Final Collation Audit ---');
    const [tables] = await pool.query('SHOW TABLE STATUS');
    const relevant = [...tablesToAlign, 'users', 'marketplace_listings'];
    const status = tables.filter(t => relevant.includes(t.Name)).map(t => ({ Name: t.Name, Collation: t.Collation }));
    console.table(status);

    process.exit(0);
}

run().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
