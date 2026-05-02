require('dotenv').config();
const pool = require('../config/database');

async function migrate() {
    try {
        console.log('Starting marketplace messaging migration...');

        await pool.query('SET FOREIGN_KEY_CHECKS = 0');

        await pool.query('DROP TABLE IF EXISTS marketplace_message_status');
        await pool.query('DROP TABLE IF EXISTS marketplace_message_reactions');
        await pool.query('DROP TABLE IF EXISTS marketplace_messages');
        await pool.query('DROP TABLE IF EXISTS marketplace_conversations');
        await pool.query('DROP TABLE IF EXISTS marketplace_chats');

        await pool.query(`
            CREATE TABLE marketplace_conversations (
                id VARCHAR(36) PRIMARY KEY,
                buyer_id VARCHAR(36) NOT NULL,
                seller_id VARCHAR(36) NOT NULL,
                listing_id INT NOT NULL,
                last_message TEXT,
                last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reminder_sent BOOLEAN DEFAULT FALSE,
                UNIQUE KEY unique_conversation (buyer_id, seller_id, listing_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('marketplace_conversations created.');

        await pool.query(`
            CREATE TABLE marketplace_messages (
                id VARCHAR(36) PRIMARY KEY,
                conversation_id VARCHAR(36) NOT NULL,
                sender_id VARCHAR(36) NOT NULL,
                message_text TEXT,
                message_type ENUM('text', 'image', 'offer', 'system') DEFAULT 'text',
                is_edited BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (conversation_id) REFERENCES marketplace_conversations(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('marketplace_messages created.');

        await pool.query(`
            CREATE TABLE marketplace_message_status (
                message_id VARCHAR(36) PRIMARY KEY,
                delivered_at TIMESTAMP NULL,
                read_at TIMESTAMP NULL,
                FOREIGN KEY (message_id) REFERENCES marketplace_messages(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('marketplace_message_status created.');

        await pool.query(`
            CREATE TABLE marketplace_message_reactions (
                id VARCHAR(36) PRIMARY KEY,
                message_id VARCHAR(36) NOT NULL,
                user_id VARCHAR(36) NOT NULL,
                reaction_type VARCHAR(10) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (message_id) REFERENCES marketplace_messages(id) ON DELETE CASCADE,
                UNIQUE KEY unique_reaction (message_id, user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        console.log('marketplace_message_reactions created.');

        await pool.query('SET FOREIGN_KEY_CHECKS = 1');

        console.log('Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        pool.end();
    }
}

migrate();
