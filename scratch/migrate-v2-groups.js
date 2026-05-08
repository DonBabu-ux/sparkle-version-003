require('dotenv').config();
const pool = require('../config/database');

async function migrate() {
    try {
        console.log('🚀 Starting Advanced Group System Migration...');

        // 1. Update groups table
        console.log('Updating groups table...');
        await pool.query(`
            ALTER TABLE groups 
            ADD COLUMN require_post_approval TINYINT(1) DEFAULT 0,
            ADD COLUMN who_can_post ENUM('anyone', 'admins') DEFAULT 'anyone',
            ADD COLUMN who_can_invite ENUM('anyone', 'admins') DEFAULT 'anyone'
        `).catch(e => console.log('Groups columns might already exist, skipping...'));

        // 2. Update group_members table
        console.log('Updating group_members table...');
        await pool.query(`
            ALTER TABLE group_members 
            ADD COLUMN muted TINYINT(1) DEFAULT 0,
            ADD COLUMN banned TINYINT(1) DEFAULT 0
        `).catch(e => console.log('Group members columns might already exist, skipping...'));

        // 3. Update posts table
        console.log('Updating posts table...');
        await pool.query(`
            ALTER TABLE posts 
            ADD COLUMN approval_status ENUM('pending', 'approved', 'rejected') DEFAULT 'approved'
        `).catch(e => console.log('Posts approval_status might already exist, skipping...'));

        console.log('✅ Migration successful!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
