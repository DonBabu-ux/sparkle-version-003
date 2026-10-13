// migrations/20261013_advanced_settings_enhancement.js
require('dotenv').config();
const pool = require('../config/database');
const logger = require('../utils/logger');

async function migrateAdvancedSettingsEnhancement() {
    console.log('🚀 Running Advanced Settings Enhancement migration...');
    try {
        const [existingCols] = await pool.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
        `);
        const colMap = new Map(existingCols.map(c => [c.COLUMN_NAME.toLowerCase(), c.COLUMN_TYPE.toLowerCase()]));

        const settingsCols = [
            { name: 'high_contrast', ddl: 'TINYINT(1) DEFAULT 0' },
            { name: 'video_autoplay', ddl: "VARCHAR(20) DEFAULT 'wifi'" },
            { name: 'auto_suppress_notifications', ddl: 'TINYINT(1) DEFAULT 0' },
            { name: 'priority_mention_bypass', ddl: 'TINYINT(1) DEFAULT 1' },
            { name: 'data_saving_mode', ddl: 'TINYINT(1) DEFAULT 0' },
            { name: 'request_filtering', ddl: "VARCHAR(20) DEFAULT 'standard'" },
            { name: 'cellular_low_data', ddl: 'TINYINT(1) DEFAULT 1' },
            { name: 'background_sync_throttling', ddl: 'TINYINT(1) DEFAULT 0' },
            { name: 'link_safety_sandbox', ddl: 'TINYINT(1) DEFAULT 1' },
            { name: 'unverified_dm_filter', ddl: 'TINYINT(1) DEFAULT 0' }
        ];

        for (const col of settingsCols) {
            if (!colMap.has(col.name.toLowerCase())) {
                console.log(`➕ Adding column users.${col.name}...`);
                await pool.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.ddl}`);
                console.log(`✅ Column users.${col.name} added`);
            } else {
                console.log(`ℹ️ Column users.${col.name} already exists`);
            }
        }

        console.log('✅ Advanced Settings Enhancement migration completed successfully!');
        return true;
    } catch (err) {
        console.error('❌ Migration error:', err);
        throw err;
    }
}

if (require.main === module) {
    migrateAdvancedSettingsEnhancement()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = migrateAdvancedSettingsEnhancement;
