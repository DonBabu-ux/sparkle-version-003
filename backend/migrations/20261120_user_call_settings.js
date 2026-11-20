'use strict';

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../config/database');

async function run() {
    try {
        console.log('Ensuring user_call_settings table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_call_settings (
                user_id CHAR(36) PRIMARY KEY,
                silence_unknown_callers TINYINT(1) NOT NULL DEFAULT 0,
                allow_calls_from VARCHAR(32) NOT NULL DEFAULT 'everyone',
                ringtone VARCHAR(100) NOT NULL DEFAULT 'hangouts_ringtone.mp3',
                vibration TINYINT(1) NOT NULL DEFAULT 1,
                incoming_call_notifications TINYINT(1) NOT NULL DEFAULT 1,
                use_less_data TINYINT(1) NOT NULL DEFAULT 0,
                default_audio_route VARCHAR(20) NOT NULL DEFAULT 'earpiece',
                camera_quality VARCHAR(20) NOT NULL DEFAULT 'standard',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_ucs_updated (updated_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        console.log('user_call_settings table verified/created.');
        const [cols] = await pool.query('SHOW COLUMNS FROM user_call_settings');
        console.log('Columns:', cols.map(c => c.Field));
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

run();
