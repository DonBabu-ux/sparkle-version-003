require('dotenv').config();
const pool = require('./config/database');

async function migrate() {
    try {
        console.log('🚀 Starting Stories v4 features migration...');
        
        // Add thumbnail_url column
        try {
            await pool.query(`ALTER TABLE stories ADD COLUMN thumbnail_url VARCHAR(500) DEFAULT NULL`);
            console.log('✅ Added thumbnail_url column');
        } catch (e) { console.log('ℹ️ thumbnail_url might already exist'); }
        
        // Add width column
        try {
            await pool.query(`ALTER TABLE stories ADD COLUMN width INT DEFAULT NULL`);
            console.log('✅ Added width column');
        } catch (e) { console.log('ℹ️ width might already exist'); }

        // Add height column
        try {
            await pool.query(`ALTER TABLE stories ADD COLUMN height INT DEFAULT NULL`);
            console.log('✅ Added height column');
        } catch (e) { console.log('ℹ️ height might already exist'); }

        // Add duration column
        try {
            await pool.query(`ALTER TABLE stories ADD COLUMN duration DOUBLE DEFAULT NULL`);
            console.log('✅ Added duration column');
        } catch (e) { console.log('ℹ️ duration might already exist'); }

        // Add file_size column
        try {
            await pool.query(`ALTER TABLE stories ADD COLUMN file_size INT DEFAULT NULL`);
            console.log('✅ Added file_size column');
        } catch (e) { console.log('ℹ️ file_size might already exist'); }

        // Add processing_status column
        try {
            await pool.query(`ALTER TABLE stories ADD COLUMN processing_status VARCHAR(50) DEFAULT 'PUBLISHED'`);
            console.log('✅ Added processing_status column');
        } catch (e) { console.log('ℹ️ processing_status might already exist'); }

        console.log('✅ Migration v4 completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrate();
