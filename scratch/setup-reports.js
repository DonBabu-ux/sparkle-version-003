require('dotenv').config();
const pool = require('../config/database');

async function setupReports() {
    try {
        console.log('Checking for reports table...');
        const [tables] = await pool.query("SHOW TABLES LIKE 'reports'");
        
        if (tables.length === 0) {
            console.log('Creating reports table...');
            await pool.query(`
                CREATE TABLE reports (
                    report_id CHAR(36) PRIMARY KEY,
                    reporter_id CHAR(36) NOT NULL,
                    target_id CHAR(36) NOT NULL,
                    target_type ENUM('user', 'post', 'listing', 'comment') NOT NULL,
                    reason VARCHAR(255) NOT NULL,
                    description TEXT,
                    status ENUM('pending', 'reviewed', 'action_taken', 'dismissed') DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (reporter_id) REFERENCES users(user_id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
            `);
            console.log('Reports table created.');
        } else {
            console.log('Reports table already exists.');
        }
        
        process.exit(0);
    } catch (err) {
        console.error('Error setting up reports table:', err);
        process.exit(1);
    }
}
setupReports();
