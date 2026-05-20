// scripts/add-performance-indexes.js
// Run once: node scripts/add-performance-indexes.js
// Adds missing indexes that prevent full table scans on high-traffic queries

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('../config/database');

const indexes = [
    // Auth — login by email or username (hit on every login)
    { table: 'users', name: 'idx_users_email', sql: 'ALTER TABLE users ADD INDEX idx_users_email (email)' },
    { table: 'users', name: 'idx_users_username', sql: 'ALTER TABLE users ADD INDEX idx_users_username (username)' },

    // Refresh token lookup
    { table: 'refresh_tokens', name: 'idx_rt_token', sql: 'ALTER TABLE refresh_tokens ADD INDEX idx_rt_token (token)' },
    { table: 'refresh_tokens', name: 'idx_rt_user_id', sql: 'ALTER TABLE refresh_tokens ADD INDEX idx_rt_user_id (user_id)' },

    // Messages — conversation lookup (primary hot path)
    { table: 'messages', name: 'idx_msg_conversation', sql: 'ALTER TABLE messages ADD INDEX idx_msg_conversation (conversation_id, sent_at DESC)' },
    { table: 'messages', name: 'idx_msg_sender', sql: 'ALTER TABLE messages ADD INDEX idx_msg_sender (sender_id)' },
    { table: 'messages', name: 'idx_msg_status', sql: 'ALTER TABLE messages ADD INDEX idx_msg_status (status)' },
    { table: 'messages', name: 'idx_msg_chat_id', sql: 'ALTER TABLE messages ADD INDEX idx_msg_chat_id (chat_id)' },

    // Personal chats
    { table: 'personal_chats', name: 'idx_pc_user1', sql: 'ALTER TABLE personal_chats ADD INDEX idx_pc_user1 (participant1_id)' },
    { table: 'personal_chats', name: 'idx_pc_user2', sql: 'ALTER TABLE personal_chats ADD INDEX idx_pc_user2 (participant2_id)' },

    // Notifications — unread count fetch
    { table: 'notifications', name: 'idx_notif_user_read', sql: 'ALTER TABLE notifications ADD INDEX idx_notif_user_read (user_id, is_read)' },

    // Posts feed
    { table: 'posts', name: 'idx_posts_user_created', sql: 'ALTER TABLE posts ADD INDEX idx_posts_user_created (user_id, created_at DESC)' },
    { table: 'posts', name: 'idx_posts_created', sql: 'ALTER TABLE posts ADD INDEX idx_posts_created (created_at DESC)' },

    // Follows — feed & presence
    { table: 'follows', name: 'idx_follows_following', sql: 'ALTER TABLE follows ADD INDEX idx_follows_following (following_id)' },
    { table: 'follows', name: 'idx_follows_follower', sql: 'ALTER TABLE follows ADD INDEX idx_follows_follower (follower_id)' },

    // Email verifications
    { table: 'email_verifications', name: 'idx_ev_email_code', sql: 'ALTER TABLE email_verifications ADD INDEX idx_ev_email_code (email, code)' },

    // Password resets
    { table: 'password_resets', name: 'idx_pr_token', sql: 'ALTER TABLE password_resets ADD INDEX idx_pr_token (token)' },
];

async function run() {
    console.log('🔧 Adding performance indexes...\n');
    let added = 0, skipped = 0, errors = 0;
    const conn = await pool.getConnection();

    for (const idx of indexes) {
        try {
            // Check if index already exists
            const [rows] = await conn.query(
                `SELECT COUNT(*) as cnt FROM information_schema.STATISTICS 
                 WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`,
                [idx.table, idx.name]
            );

            if (rows[0].cnt > 0) {
                console.log(`  ⏭  SKIP  ${idx.name} (already exists)`);
                skipped++;
                continue;
            }

            await conn.query(idx.sql);
            console.log(`  ✅ ADDED ${idx.name}`);
            added++;
        } catch (err) {
            if (err.code === 'ER_DUP_KEYNAME') {
                console.log(`  ⏭  SKIP  ${idx.name} (duplicate key name)`);
                skipped++;
            } else if (err.code === 'ER_NO_SUCH_TABLE') {
                console.log(`  ⚠️  MISS  ${idx.name} (table '${idx.table}' not found)`);
                errors++;
            } else {
                console.error(`  ❌ FAIL  ${idx.name}: [${err.code}] ${err.message}`);
                errors++;
            }
        }
    }

    conn.release();
    console.log(`\nDone: ${added} added, ${skipped} skipped, ${errors} errors`);
    await pool.end();
    process.exit(errors > 0 ? 1 : 0);
}

run().catch(err => {
    console.error('Fatal:', err.message || err);
    process.exit(1);
});

