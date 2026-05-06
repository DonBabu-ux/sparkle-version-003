require('dotenv').config();
const pool = require('../config/database');

async function run() {
    console.log('--- Force Column Collation Alignment ---');
    
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');

    // These are the join columns that are causing the mismatch
    const columnFixes = [
        { table: 'marketplace_conversations', column: 'buyer_id', type: 'VARCHAR(36)' },
        { table: 'marketplace_conversations', column: 'seller_id', type: 'VARCHAR(36)' },
        { table: 'marketplace_conversations', column: 'listing_id', type: 'VARCHAR(36)' },
        { table: 'marketplace_messages', column: 'sender_id', type: 'VARCHAR(36)' },
        { table: 'marketplace_messages', column: 'id', type: 'VARCHAR(36)' },
        { table: 'marketplace_conversations', column: 'id', type: 'VARCHAR(36)' }
    ];

    for (const fix of columnFixes) {
        try {
            console.log(`Fixing ${fix.table}.${fix.column}...`);
            await pool.query(`ALTER TABLE ${fix.table} MODIFY ${fix.column} ${fix.type} CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
        } catch (err) {
            console.error(`Error on ${fix.table}.${fix.column}:`, err.message);
        }
    }

    await pool.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('Done.');
    process.exit(0);
}

run();
