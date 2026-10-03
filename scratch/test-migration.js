require('dotenv').config();
const pool = require('../config/database');

async function test() {
    try {
        console.log('Testing column creation...');
        // Check if username_normalized exists
        const [cols] = await pool.query(
            "SELECT COLUMN_NAME, EXTRA FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'username_normalized'"
        );
        console.log('Existing column:', cols);

        if (cols.length === 0) {
            // Test creating a temporary table with GENERATED ALWAYS AS (LOWER(TRIM(username))) STORED
            await pool.query(`
                CREATE TEMPORARY TABLE test_users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(100) NOT NULL,
                    username_normalized VARCHAR(100) GENERATED ALWAYS AS (LOWER(TRIM(username))) STORED,
                    UNIQUE KEY uq_test_username_norm (username_normalized)
                )
            `);
            console.log('Temporary table with generated stored column created successfully!');

            await pool.query("INSERT INTO test_users (username) VALUES ('DonTechie')");
            const [rows] = await pool.query("SELECT * FROM test_users");
            console.log('Inserted row:', rows);

            try {
                await pool.query("INSERT INTO test_users (username) VALUES ('dontechie')");
                console.log('ERROR: duplicate was NOT caught!');
            } catch (dupErr) {
                console.log('SUCCESS: duplicate was caught by unique constraint:', dupErr.code, dupErr.message);
            }
        }
    } catch (err) {
        console.error('Test error:', err);
    } finally {
        process.exit();
    }
}

test();
