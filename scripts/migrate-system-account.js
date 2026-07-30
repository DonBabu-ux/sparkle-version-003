require('dotenv').config();
const db = require('../config/database');

async function queryWithRetry(sql, params = [], retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await db.query(sql, params);
        } catch (err) {
            if (i === retries - 1) throw err;
            console.warn(`[Migration] Query attempt ${i + 1} failed, retrying in 1.5s... (${err.message})`);
            await new Promise(res => setTimeout(res, 1500));
        }
    }
}

async function migrateSystemAccount() {
    console.log('Updating Sparkle Official Account...');

    // 1. Ensure columns exist on users table
    try { await queryWithRetry("ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type ENUM('user', 'system', 'business', 'creator', 'bot', 'organization') NOT NULL DEFAULT 'user'"); } catch (_) {}
    try { await queryWithRetry("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_system_account TINYINT(1) DEFAULT 0"); } catch (_) {}
    try { await queryWithRetry("ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255) DEFAULT NULL"); } catch (_) {}
    try { await queryWithRetry("ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255) DEFAULT 'Sparkle Official'"); } catch (_) {}

    // Find primary system user or username = 'sparkleofficial'
    const [rows] = await queryWithRetry(
        "SELECT user_id FROM users WHERE username = 'sparkleofficial' OR is_system_account = 1 OR account_type = 'system' LIMIT 1"
    );

    let systemUserId;
    if (rows && rows.length > 0) {
        systemUserId = rows[0].user_id;
    } else {
        systemUserId = process.env.SPARKLE_SYSTEM_USER_ID || '00000000-0000-4000-a000-000000000001';
        await queryWithRetry(
            `INSERT INTO users (user_id, username, email, password_hash, display_name, name, bio, is_verified, is_system_account, account_type, avatar_url)
             VALUES (?, 'sparkleofficial', 'official@sparkle.app', 'SYSTEM_ACCOUNT_LOCKED', 'Sparkle Official', 'Sparkle Official', 'Official Sparkle Account • Helping you discover Sparkle', 1, 1, 'system', '/assets/system/sparkle-logo.svg')`,
            [systemUserId]
        );
    }

    await queryWithRetry(`
        UPDATE users
        SET
            display_name = 'Sparkle Official',
            name = 'Sparkle Official',
            username = 'sparkleofficial',
            bio = 'Official Sparkle Account • Helping you discover Sparkle',
            is_verified = 1,
            is_system_account = 1,
            account_type = 'system',
            avatar_url = '/assets/system/sparkle-logo.svg'
        WHERE user_id = ?
    `, [systemUserId]);

    console.log('✓ Sparkle Official Account updated successfully.');
    try { await db.end(); } catch (_) {}
    process.exit(0);
}

migrateSystemAccount().catch(err => {
    console.error(err);
    process.exit(1);
});
