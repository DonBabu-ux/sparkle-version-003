// Script to add sample marketplace listings to database
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function addSampleListings() {
    let connection;

    try {
        // Create database connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'sparkle_db',
            multipleStatements: true
        });

        console.log('✅ Connected to database');

        // Read SQL file
        const sqlPath = path.join(__dirname, 'migrations', 'add_sample_listings.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('📝 Executing SQL script...');

        // Execute SQL
        const [results] = await connection.query(sql);

        console.log('✅ Sample listings added successfully!');
        console.log('📊 Results:', results);

    } catch (error) {
        console.error('❌ Error adding sample listings:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed');
        }
    }
}

// Run the script
addSampleListings()
    .then(() => {
        console.log('\n✨ All done! Sample listings have been added to the marketplace.');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Failed to add sample listings:', error);
        process.exit(1);
    });
