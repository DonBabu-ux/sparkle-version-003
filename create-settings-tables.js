const pool = require('./backend/config/database');

async function createTables() {
    try {
        console.log('Creating marketplace settings tables...');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS marketplace_verifications (
                verification_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                id_front_url VARCHAR(512) NOT NULL,
                id_back_url VARCHAR(512) DEFAULT NULL,
                selfie_url VARCHAR(512) NOT NULL,
                match_score DECIMAL(4,3) DEFAULT NULL,
                status ENUM('pending', 'verified', 'rejected', 'manual_review') DEFAULT 'pending',
                rejection_reason TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS marketplace_seller_settings (
                user_id CHAR(36) PRIMARY KEY,
                profile_visibility ENUM('public', 'private', 'verified_only') DEFAULT 'public',
                message_permissions ENUM('everyone', 'verified_only') DEFAULT 'everyone',
                notifications_messages TINYINT(1) DEFAULT 1,
                notifications_offers TINYINT(1) DEFAULT 1,
                notifications_marketing TINYINT(1) DEFAULT 0,
                auto_reply_enabled TINYINT(1) DEFAULT 0,
                auto_reply_text TEXT DEFAULT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS marketplace_payout_settings (
                payout_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                provider ENUM('mpesa', 'bank', 'wallet') NOT NULL,
                account_number VARCHAR(255) NOT NULL,
                account_name VARCHAR(255) NOT NULL,
                is_default TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log('Successfully created tables.');
        process.exit(0);
    } catch (err) {
        console.error('Error creating tables:', err);
        process.exit(1);
    }
}

createTables();
