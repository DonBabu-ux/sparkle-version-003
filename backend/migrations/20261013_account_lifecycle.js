// migrations/20261013_account_lifecycle.js
require('dotenv').config();
const pool = require('../config/database');
const logger = require('../utils/logger');

async function migrateAccountLifecycle() {
    console.log('🚀 Running Account Lifecycle migration (Suspend, Terminate, Delete)...');
    try {
        // 1. Check existing columns in users table
        const [existingCols] = await pool.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
        `);
        const colMap = new Map(existingCols.map(c => [c.COLUMN_NAME.toLowerCase(), c.COLUMN_TYPE.toLowerCase()]));

        // 2. Modify account_status to VARCHAR(32) to support all lifecycle states
        // Conceptual states: 'active', 'suspended', 'terminated', 'pending_deletion', 'deleted', 'deactivated'
        if (colMap.has('account_status')) {
            const currentType = colMap.get('account_status');
            if (currentType.startsWith('enum')) {
                console.log('🔄 Altering users.account_status from ENUM to VARCHAR(32)...');
                await pool.query(`
                    ALTER TABLE users 
                    MODIFY COLUMN account_status VARCHAR(32) NOT NULL DEFAULT 'active'
                `);
                console.log('✅ users.account_status modified to VARCHAR(32)');
            }
        }

        // 3. Define new lifecycle columns
        const lifecycleCols = [
            { name: 'suspended_at', ddl: 'TIMESTAMP NULL DEFAULT NULL' },
            { name: 'suspension_reason', ddl: 'VARCHAR(255) NULL DEFAULT NULL' },
            { name: 'suspended_by', ddl: 'VARCHAR(36) NULL DEFAULT NULL' },
            { name: 'suspension_expires_at', ddl: 'TIMESTAMP NULL DEFAULT NULL' },
            { name: 'terminated_at', ddl: 'TIMESTAMP NULL DEFAULT NULL' },
            { name: 'termination_reason', ddl: 'VARCHAR(255) NULL DEFAULT NULL' },
            { name: 'terminated_by', ddl: 'VARCHAR(36) NULL DEFAULT NULL' },
            { name: 'deletion_requested_at', ddl: 'TIMESTAMP NULL DEFAULT NULL' },
            { name: 'deletion_scheduled_at', ddl: 'TIMESTAMP NULL DEFAULT NULL' },
            { name: 'deletion_completed_at', ddl: 'TIMESTAMP NULL DEFAULT NULL' },
            { name: 'deletion_reason', ddl: 'VARCHAR(255) NULL DEFAULT NULL' }
        ];

        for (const col of lifecycleCols) {
            if (!colMap.has(col.name.toLowerCase())) {
                console.log(`➕ Adding column users.${col.name}...`);
                await pool.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.ddl}`);
                console.log(`✅ Column users.${col.name} added`);
            }
        }

        // 4. Create account_lifecycle_audit table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS account_lifecycle_audit (
                id VARCHAR(36) NOT NULL PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                action VARCHAR(50) NOT NULL,
                previous_status VARCHAR(32) DEFAULT NULL,
                new_status VARCHAR(32) NOT NULL,
                initiated_by VARCHAR(36) NOT NULL,
                actor_role VARCHAR(32) DEFAULT 'user',
                reason VARCHAR(255) DEFAULT NULL,
                ip_address VARCHAR(45) DEFAULT NULL,
                user_agent VARCHAR(255) DEFAULT NULL,
                metadata TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_lifecycle_user (user_id),
                INDEX idx_lifecycle_action (action),
                INDEX idx_lifecycle_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('✅ account_lifecycle_audit table verified/created');

        // 5. Add index on users.account_status and users.deletion_scheduled_at if not present
        const [existingIndexes] = await pool.query(`
            SELECT INDEX_NAME 
            FROM INFORMATION_SCHEMA.STATISTICS 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'
        `);
        const indexSet = new Set(existingIndexes.map(i => i.INDEX_NAME.toLowerCase()));

        if (!indexSet.has('idx_users_account_status')) {
            await pool.query(`ALTER TABLE users ADD INDEX idx_users_account_status (account_status)`);
            console.log('✅ Index idx_users_account_status created');
        }
        if (!indexSet.has('idx_users_deletion_scheduled')) {
            await pool.query(`ALTER TABLE users ADD INDEX idx_users_deletion_scheduled (deletion_scheduled_at)`);
            console.log('✅ Index idx_users_deletion_scheduled created');
        }

        console.log('🎉 Account lifecycle migration completed successfully.');
    } catch (error) {
        console.error('❌ Account lifecycle migration error:', error);
        throw error;
    }
}

if (require.main === module) {
    migrateAccountLifecycle()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = migrateAccountLifecycle;
