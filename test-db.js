const pool = require('./config/database');

async function test() {
    try {
        const [rows] = await pool.query('SELECT 1 as test');
        console.log('✅ Database connection successful:', rows);
        
        // Test marketplace table
        const [tables] = await pool.query("SHOW TABLES LIKE 'marketplace_listings'");
        console.log('Marketplace table exists:', tables.length > 0);
        
        if (tables.length > 0) {
            const [columns] = await pool.query('DESCRIBE marketplace_listings');
            console.log('Table columns:', columns.map(c => c.Field));
        }
    } catch (error) {
        console.error('❌ Database error:', error.message);
    }
    process.exit();
}

test();