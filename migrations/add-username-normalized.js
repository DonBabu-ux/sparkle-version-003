// migrations/add-username-normalized.js
require('dotenv').config();
const pool = require('../config/database');

async function migrate() {
    try {
        console.log('🚀 Starting Username Normalization Migration...');

        // 1. Check if username_normalized already exists
        const [columns] = await pool.query(`
            SELECT COLUMN_NAME, EXTRA 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'users' 
              AND COLUMN_NAME = 'username_normalized'
        `);

        if (columns.length === 0) {
            console.log('  Adding username_normalized column as STORED GENERATED column...');
            // MariaDB / MySQL stored generated column
            await pool.query(`
                ALTER TABLE users 
                ADD COLUMN username_normalized VARCHAR(100) 
                GENERATED ALWAYS AS (LOWER(TRIM(username))) STORED 
                AFTER username
            `);
            console.log('  + Added username_normalized column.');
        } else {
            console.log('  . Column username_normalized already exists.');
        }

        // 2. Check if UNIQUE index on username_normalized exists
        const [indexes] = await pool.query(`
            SELECT INDEX_NAME 
            FROM INFORMATION_SCHEMA.STATISTICS 
            WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = 'users' 
              AND INDEX_NAME = 'uq_users_username_normalized'
        `);

        if (indexes.length === 0) {
            console.log('  Creating UNIQUE index uq_users_username_normalized...');
            await pool.query(`
                ALTER TABLE users 
                ADD UNIQUE KEY uq_users_username_normalized (username_normalized)
            `);
            console.log('  + Added UNIQUE KEY uq_users_username_normalized.');
        } else {
            console.log('  . Index uq_users_username_normalized already exists.');
        }

        // 3. Verify index and run EXPLAIN test
        const [explain] = await pool.query(`
            EXPLAIN SELECT user_id, username, username_normalized 
            FROM users 
            WHERE username_normalized = 'sparkle_team' 
            LIMIT 1
        `);
        console.log('--- EXPLAIN QUERY PLAN ---');
        console.table(explain);

        console.log('✅ Username Normalization Migration Completed Successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration Failed:', error);
        process.exit(1);
    }
}

migrate();
