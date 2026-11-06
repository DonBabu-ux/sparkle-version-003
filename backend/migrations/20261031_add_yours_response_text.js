// migrations/20261031_add_yours_response_text.js
// "Add yours" responses recorded the who/when but never the what: the viewer's
// typed reply was dropped because add_yours_responses had no content column.
// Adds `content TEXT DEFAULT NULL` so respondToAddYours can persist it.
// Idempotent (ER_DUP_FIELDNAME-safe), additive only — nothing is dropped.
'use strict';

require('dotenv').config();
const pool = require('../config/database');

async function runMigration() {
    console.log('Starting add_yours_responses content migration...');
    try {
        const addColumn = async (table, columnDef) => {
            try {
                await pool.query(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
                console.log(`  Added column ${columnDef.split(' ')[0]} to ${table}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME' || err.message?.includes('Duplicate column')) {
                    // Already applied — safe to ignore.
                } else {
                    console.warn(`  Column check on ${table} (${columnDef.split(' ')[0]}):`, err.message);
                }
            }
        };

        await addColumn('add_yours_responses', 'content TEXT DEFAULT NULL');

        console.log('Migration completed successfully!');
        return;
    } catch (err) {
        console.error('Migration failed:', err);
        throw err;
    }
}

// Runner-compatible entry point. Exit only when invoked directly
// (`node migrations/20261031_add_yours_response_text.js`). require()-ing this
// file from utils/database/schemaLedger.js must not terminate the booting
// process, which is what the previous bare `runMigration()` + process.exit did.
if (require.main === module) {
    runMigration()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = runMigration;
