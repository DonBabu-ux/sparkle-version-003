const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixMarketplace() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });
    
    try {
        console.log('🔧 Fixing marketplace tables...');
        
        // Run the migration
        await connection.query(`
            ALTER TABLE marketplace_orders 
            MODIFY COLUMN accepted_at TIMESTAMP NULL DEFAULT NULL,
            MODIFY COLUMN rejected_at TIMESTAMP NULL DEFAULT NULL,
            MODIFY COLUMN cancelled_at TIMESTAMP NULL DEFAULT NULL,
            MODIFY COLUMN completed_at TIMESTAMP NULL DEFAULT NULL,
            MODIFY COLUMN disputed_at TIMESTAMP NULL DEFAULT NULL;
            
            CREATE TABLE IF NOT EXISTS listing_tags (
                listing_id CHAR(36) NOT NULL,
                tag_name VARCHAR(100) NOT NULL,
                PRIMARY KEY (listing_id, tag_name),
                FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE
            );
        `);
        
        console.log('✅ Marketplace tables fixed!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await connection.end();
    }
}

fixMarketplace();
