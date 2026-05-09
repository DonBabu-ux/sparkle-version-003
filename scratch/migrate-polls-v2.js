require('dotenv').config();
const pool = require('../config/database');

async function migrate() {
    console.log('🚀 Starting Advanced Polls Migration...');
    try {
        // 1. Alter Polls Table
        console.log('📝 Adding engagement fields to polls table...');
        await pool.query(`
            ALTER TABLE polls 
            ADD COLUMN IF NOT EXISTS is_expired TINYINT(1) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS allow_invites TINYINT(1) DEFAULT 1,
            ADD COLUMN IF NOT EXISTS notification_priority INT DEFAULT 0,
            ADD COLUMN IF NOT EXISTS engagement_score FLOAT DEFAULT 0.0
        `);

        // 2. Create Poll Invites Table
        console.log('📝 Creating poll_invites table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS poll_invites (
                invite_id CHAR(36) PRIMARY KEY,
                poll_id CHAR(36) NOT NULL,
                inviter_id CHAR(36) NOT NULL,
                invitee_id CHAR(36) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX (poll_id),
                INDEX (invitee_id)
            )
        `);

        // 3. Update Notifications Enum
        console.log('📝 Updating notifications type enum...');
        // We'll use a safer approach for the enum update
        await pool.query(`
            ALTER TABLE notifications 
            MODIFY COLUMN type ENUM(
                'spark', 'comment', 'follow', 'message', 'group_invite', 
                'achievement', 'mention', 'share', 'marketplace_contact', 
                'story_like', 'story_share', 'event_update', 'club_update', 'poll_invite'
            ) NOT NULL
        `);

        console.log('✅ Migration complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
