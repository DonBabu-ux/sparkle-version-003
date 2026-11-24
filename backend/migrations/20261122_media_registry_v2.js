/**
 * Migration Runner: 20261122_media_registry_v2.js
 * Evolve media_registry table with multi-tier storage columns and indexes.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const pool = require('../config/database');

async function runMigration() {
    console.log('[Migration] Starting media_registry v2 evolution...');

    try {
        const [existingColumns] = await pool.query('SHOW COLUMNS FROM media_registry');
        const colNames = new Set(existingColumns.map(c => c.Field.toLowerCase()));

        const columnsToAdd = [
            { name: 'storage_provider', sql: "ALTER TABLE media_registry ADD COLUMN storage_provider VARCHAR(32) NOT NULL DEFAULT 'cloudinary' AFTER owner_id" },
            { name: 'bucket_name', sql: "ALTER TABLE media_registry ADD COLUMN bucket_name VARCHAR(128) NULL AFTER storage_provider" },
            { name: 'object_key', sql: "ALTER TABLE media_registry ADD COLUMN object_key VARCHAR(512) NULL AFTER bucket_name" },
            { name: 'mime_type', sql: "ALTER TABLE media_registry ADD COLUMN mime_type VARCHAR(128) NULL AFTER object_key" },
            { name: 'checksum_sha256', sql: "ALTER TABLE media_registry ADD COLUMN checksum_sha256 VARCHAR(64) NULL AFTER hash_checksum" },
            { name: 'width', sql: "ALTER TABLE media_registry ADD COLUMN width INT NULL AFTER file_size_bytes" },
            { name: 'height', sql: "ALTER TABLE media_registry ADD COLUMN height INT NULL AFTER width" },
            { name: 'duration_seconds', sql: "ALTER TABLE media_registry ADD COLUMN duration_seconds FLOAT NULL AFTER height" },
            { name: 'lifecycle_tier', sql: "ALTER TABLE media_registry ADD COLUMN lifecycle_tier VARCHAR(32) NOT NULL DEFAULT 'active' AFTER lifecycle_state" },
            { name: 'migration_status', sql: "ALTER TABLE media_registry ADD COLUMN migration_status VARCHAR(32) NOT NULL DEFAULT 'pending' AFTER lifecycle_tier" },
            { name: 'migrated_at', sql: "ALTER TABLE media_registry ADD COLUMN migrated_at DATETIME NULL AFTER migration_status" },
            { name: 'migration_error', sql: "ALTER TABLE media_registry ADD COLUMN migration_error TEXT NULL AFTER migrated_at" }
        ];

        for (const col of columnsToAdd) {
            if (!colNames.has(col.name.toLowerCase())) {
                console.log(`[Migration] Adding column ${col.name}...`);
                await pool.query(col.sql);
                console.log(`[Migration] Successfully added column ${col.name}`);
            } else {
                console.log(`[Migration] Column ${col.name} already exists. Skipping.`);
            }
        }

        // Check indexes
        const [existingIndexes] = await pool.query('SHOW INDEX FROM media_registry');
        const indexNames = new Set(existingIndexes.map(idx => idx.Key_name.toLowerCase()));

        const indexesToAdd = [
            { name: 'idx_storage_provider_key', sql: 'CREATE INDEX idx_storage_provider_key ON media_registry (storage_provider, object_key(191))' },
            { name: 'idx_checksum_sha256', sql: 'CREATE INDEX idx_checksum_sha256 ON media_registry (checksum_sha256)' },
            { name: 'idx_migration_status', sql: 'CREATE INDEX idx_migration_status ON media_registry (migration_status)' },
            { name: 'idx_lifecycle_tier', sql: 'CREATE INDEX idx_lifecycle_tier ON media_registry (lifecycle_tier)' }
        ];

        for (const idx of indexesToAdd) {
            if (!indexNames.has(idx.name.toLowerCase())) {
                console.log(`[Migration] Creating index ${idx.name}...`);
                await pool.query(idx.sql);
                console.log(`[Migration] Successfully created index ${idx.name}`);
            } else {
                console.log(`[Migration] Index ${idx.name} already exists. Skipping.`);
            }
        }

        console.log('[Migration] media_registry v2 evolution successfully completed!');
        process.exit(0);
    } catch (err) {
        console.error('[Migration Error]:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    runMigration();
}

module.exports = runMigration;
