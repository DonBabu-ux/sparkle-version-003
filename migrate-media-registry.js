require('dotenv').config();
const pool = require('./config/database');

async function migrate() {
    try {
        console.log('Starting Media Registry Migration...');

        // Create media_registry table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS media_registry (
                media_id VARCHAR(64) PRIMARY KEY,
                owner_id VARCHAR(64) NOT NULL,
                category ENUM('story', 'post', 'reel', 'confession', 'profile', 'message', 'temporary', 'system') NOT NULL,
                cloudinary_public_id VARCHAR(255) NOT NULL UNIQUE,
                secure_url VARCHAR(512) NOT NULL,
                thumbnail_url VARCHAR(512),
                
                lifecycle_state ENUM('active', 'expiring_soon', 'expired', 'archived', 'protected', 'reusable', 'pending_cleanup') DEFAULT 'active',
                expires_at DATETIME NULL,
                
                is_reusable BOOLEAN DEFAULT FALSE,
                referenced_by_features JSON,
                
                local_template_path VARCHAR(255) NULL,
                
                cleanup_priority ENUM('SAFE_TO_DELETE', 'IN_USE', 'PROTECTED', 'ARCHIVED_ONLY', 'TEMP_ONLY') DEFAULT 'IN_USE',
                hash_checksum VARCHAR(128) NULL,
                file_size_bytes INT NOT NULL DEFAULT 0,
                last_accessed_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_owner (owner_id),
                INDEX idx_category (category),
                INDEX idx_lifecycle (lifecycle_state)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('✅ media_registry table created successfully.');

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
