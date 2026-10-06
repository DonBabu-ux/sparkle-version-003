require('dotenv').config();
const pool = require('./config/database');

async function migrate() {
    try {
        console.log('🚀 Starting Profile Cooldowns DB Migration...');

        const columnsToAdd = [
            { name: 'name_updated_at', type: "TIMESTAMP NULL DEFAULT NULL" },
            { name: 'username_updated_at', type: "TIMESTAMP NULL DEFAULT NULL" }
        ];

        for (const col of columnsToAdd) {
            try {
                await pool.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
                console.log(`  + Added column users.${col.name}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060) {
                    console.log(`  . Column users.${col.name} already exists`);
                } else {
                    console.warn(`  ! Note on column ${col.name}:`, err.message);
                }
            }
        }

        console.log('✅ Profile Cooldowns Migration Completed Successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration Failed:', error);
        process.exit(1);
    }
}

migrate();
