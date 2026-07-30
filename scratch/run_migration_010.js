// scratch/run_migration_010.js
require('dotenv').config();
const pool = require('../config/database');

async function run() {
    console.log('Running Migration 010: Official Account System Upgrade...');
    try {
        await pool.query('SET FOREIGN_KEY_CHECKS = 0');
        
        // 1. account_type
        try {
            await pool.query(`
                ALTER TABLE users 
                ADD COLUMN account_type ENUM('user', 'system', 'business', 'creator', 'bot', 'organization') NOT NULL DEFAULT 'user'
            `);
            console.log('✔ Added account_type to users');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME' || e.message.includes('Duplicate column')) {
                console.log('ℹ account_type already exists on users');
            } else {
                console.error('Error adding account_type:', e.message);
            }
        }

        // 2. conversation_type
        try {
            await pool.query(`
                ALTER TABLE personal_chats
                ADD COLUMN conversation_type ENUM('dm', 'group', 'system', 'marketplace', 'support', 'ai') NOT NULL DEFAULT 'dm'
            `);
            console.log('✔ Added conversation_type to personal_chats');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME' || e.message.includes('Duplicate column')) {
                console.log('ℹ conversation_type already exists on personal_chats');
            } else {
                console.error('Error adding conversation_type:', e.message);
            }
        }

        // 3. message_category, publish_at, expires_at, payload
        const messageCols = [
            { name: 'message_category', sql: `ALTER TABLE messages ADD COLUMN message_category ENUM('announcement', 'feature', 'security', 'welcome', 'tips', 'promotion', 'maintenance', 'warning') DEFAULT 'announcement'` },
            { name: 'publish_at', sql: `ALTER TABLE messages ADD COLUMN publish_at TIMESTAMP NULL DEFAULT NULL` },
            { name: 'expires_at', sql: `ALTER TABLE messages ADD COLUMN expires_at TIMESTAMP NULL DEFAULT NULL` },
            { name: 'payload', sql: `ALTER TABLE messages ADD COLUMN payload JSON DEFAULT NULL` }
        ];

        for (const item of messageCols) {
            try {
                await pool.query(item.sql);
                console.log(`✔ Added ${item.name} to messages`);
            } catch (e) {
                if (e.code === 'ER_DUP_FIELDNAME' || e.message.includes('Duplicate column')) {
                    console.log(`ℹ ${item.name} already exists on messages`);
                } else {
                    console.error(`Error adding ${item.name}:`, e.message);
                }
            }
        }

        // 4. Backfill
        const systemUserId = process.env.SPARKLE_SYSTEM_USER_ID || 'd75fe3b5-7a45-4581-ab13-91934d8b54de';
        await pool.query(`
            UPDATE users 
            SET account_type = 'system' 
            WHERE user_id = ? OR username IN ('sparkle', 'sparkleofficialaccount', 'sparkle_updates', 'sparkle_safety', 'sparkle_ai', 'sparkle_support', 'sparkle_marketplace', 'sparkle_campus')
        `, [systemUserId]);
        console.log('✔ Backfilled users account_type');

        await pool.query(`
            UPDATE personal_chats pc
            JOIN users u1 ON pc.participant1_id = u1.user_id
            JOIN users u2 ON pc.participant2_id = u2.user_id
            SET pc.conversation_type = 'system'
            WHERE u1.account_type = 'system' OR u2.account_type = 'system'
        `);
        console.log('✔ Backfilled personal_chats conversation_type');

        await pool.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('Migration 010 completed successfully!');
    } catch (err) {
        console.error('Migration failed:', err);
    }
    process.exit(0);
}

run();
