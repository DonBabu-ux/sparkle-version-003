const pool = require('./backend/config/database');
const { v4: uuidv4 } = require('uuid');

async function migrate() {
    try {
        console.log('Migrating Support System...');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS support_tickets (
                ticket_id CHAR(36) PRIMARY KEY,
                user_id CHAR(36) NOT NULL,
                category ENUM('verification', 'payment', 'abuse', 'listing', 'account', 'other') NOT NULL,
                subject VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                status ENUM('open', 'in_progress', 'resolved', 'closed') DEFAULT 'open',
                priority ENUM('low', 'medium', 'high') DEFAULT 'low',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS support_messages (
                message_id CHAR(36) PRIMARY KEY,
                ticket_id CHAR(36) NOT NULL,
                sender_id CHAR(36) NOT NULL,
                message TEXT NOT NULL,
                is_admin TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (ticket_id) REFERENCES support_tickets(ticket_id) ON DELETE CASCADE,
                FOREIGN KEY (sender_id) REFERENCES users(user_id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log('Migration successful');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
