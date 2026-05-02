const pool = require('../config/database');

async function migrate() {
    try {
        console.log('🚀 Starting notification table migration...');
        
        // Add columns if they don't exist
        await pool.query(`
            ALTER TABLE notifications 
            ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50) AFTER related_type,
            ADD COLUMN IF NOT EXISTS entity_id VARCHAR(50) AFTER entity_type,
            ADD COLUMN IF NOT EXISTS sub_entity_id VARCHAR(50) AFTER entity_id;
        `);
        
        console.log('✅ Migration successful!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
