require('dotenv').config();
const pool = require('./config/database');

async function run() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS refresh_tokens (
                token_id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                token VARCHAR(255) NOT NULL UNIQUE,
                device_id VARCHAR(255),
                expires_at DATETIME NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX(user_id),
                INDEX(token)
            )
        `);
        console.log('Created refresh_tokens');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS login_activity (
                activity_id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                device_id VARCHAR(255) NOT NULL,
                ip_address VARCHAR(45),
                user_agent TEXT,
                is_verified BOOLEAN DEFAULT FALSE,
                last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_device (user_id, device_id),
                INDEX(user_id)
            )
        `);
        console.log('Created login_activity');
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS login_attempts (
                attempt_id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36),
                login_id VARCHAR(255) NOT NULL,
                ip_address VARCHAR(45),
                is_successful BOOLEAN,
                attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX(login_id),
                INDEX(ip_address)
            )
        `);
        console.log('Created login_attempts');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS verification_requests (
                request_id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL,
                type VARCHAR(50) NOT NULL,
                requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX(user_id)
            )
        `);
        console.log('Created verification_requests');
    } catch(e) {
        console.error(e);
    }
    process.exit();
}
run();
