require('dotenv').config();
const pool = require('./config/database');

async function run() {
    try {
        console.log('Creating skill_bookings table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS skill_bookings (
                booking_id VARCHAR(36) PRIMARY KEY,
                offer_id VARCHAR(36) NOT NULL,
                booker_id VARCHAR(36) NOT NULL,
                booking_date DATETIME NOT NULL,
                duration_minutes INT DEFAULT 60,
                notes TEXT,
                status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX(offer_id),
                INDEX(booker_id)
            )
        `);

        console.log('Creating skill_reviews table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS skill_reviews (
                review_id VARCHAR(36) PRIMARY KEY,
                offer_id VARCHAR(36) NOT NULL,
                booking_id VARCHAR(36) NOT NULL,
                reviewer_id VARCHAR(36) NOT NULL,
                rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
                review TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_booking_review (booking_id),
                INDEX(offer_id)
            )
        `);

        console.log('Tables created successfully!');
    } catch (e) {
        console.error('Error creating tables:', e);
    }
    process.exit();
}
run();
