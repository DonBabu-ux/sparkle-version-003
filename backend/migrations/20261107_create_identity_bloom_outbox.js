// migrations/20261107_create_identity_bloom_outbox.js
require('dotenv').config();
const pool = require('../config/database');

const TABLE = 'identity_bloom_outbox';

async function createIdentityBloomOutbox() {
    console.log('🚀 Running Identity Bloom Outbox migration...');
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS ${TABLE} (
                outbox_id CHAR(36) NOT NULL,
                entity_type VARCHAR(32) NOT NULL DEFAULT 'user',
                entity_id CHAR(36) NOT NULL,
                identity_type VARCHAR(16) NOT NULL,
                identity_hmac CHAR(64) NOT NULL,
                operation VARCHAR(16) NOT NULL DEFAULT 'add',
                status VARCHAR(16) NOT NULL DEFAULT 'pending',
                attempts INT NOT NULL DEFAULT 0,
                last_error VARCHAR(500) NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                processed_at DATETIME NULL,
                next_attempt_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                claimed_by VARCHAR(64) NULL,
                claimed_at DATETIME NULL,
                PRIMARY KEY (outbox_id),
                UNIQUE KEY uq_identity_bloom_outbox_entity (entity_type, entity_id, identity_type, identity_hmac),
                KEY idx_identity_bloom_outbox_pending (status, next_attempt_at, created_at),
                KEY idx_identity_bloom_outbox_hmac (identity_hmac, status),
                KEY idx_identity_bloom_outbox_claim (status, claimed_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        `);
        console.log(`✅ ${TABLE} table verified/created`);

        const [indexes] = await pool.query(`
            SELECT INDEX_NAME
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        `, [TABLE]);
        const indexSet = new Set(indexes.map((row) => row.INDEX_NAME.toLowerCase()));

        if (!indexSet.has('idx_identity_bloom_outbox_pending')) {
            await pool.query(`ALTER TABLE ${TABLE} ADD INDEX idx_identity_bloom_outbox_pending (status, next_attempt_at, created_at)`);
            console.log('✅ Index idx_identity_bloom_outbox_pending created');
        }
        if (!indexSet.has('idx_identity_bloom_outbox_hmac')) {
            await pool.query(`ALTER TABLE ${TABLE} ADD INDEX idx_identity_bloom_outbox_hmac (identity_hmac, status)`);
            console.log('✅ Index idx_identity_bloom_outbox_hmac created');
        }
        if (!indexSet.has('idx_identity_bloom_outbox_claim')) {
            await pool.query(`ALTER TABLE ${TABLE} ADD INDEX idx_identity_bloom_outbox_claim (status, claimed_at)`);
            console.log('✅ Index idx_identity_bloom_outbox_claim created');
        }

        console.log('🎉 Identity Bloom Outbox migration completed successfully.');
    } catch (error) {
        console.error('❌ Identity Bloom Outbox migration error:', error);
        throw error;
    }
}

if (require.main === module) {
    createIdentityBloomOutbox()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

module.exports = createIdentityBloomOutbox;
