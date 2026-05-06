const pool = require('./config/database');

const fix = async () => {
    try {
        console.log('Testing DB connection...');
        try {
            await pool.query('SELECT 1');
            console.log('✅ DB Connected');
        } catch (connErr) {
            console.error('❌ DB Connection failed:', connErr);
            process.exit(1);
        }

        const columns = [
            { name: 'feeling', type: 'VARCHAR(255) DEFAULT NULL' },
            { name: 'activity', type: 'VARCHAR(255) DEFAULT NULL' },
            { name: 'tagged_users', type: 'TEXT DEFAULT NULL' } // Using TEXT instead of JSON for compatibility
        ];

        for (const col of columns) {
            try {
                await pool.query(`ALTER TABLE posts ADD COLUMN ${col.name} ${col.type}`);
                console.log(`✅ Added ${col.name}`);
            } catch (err) {
                if (err.code === 'ER_DUP_FIELDNAME') {
                    console.log(`ℹ️ ${col.name} already exists`);
                } else {
                    console.error(`❌ Error adding ${col.name}:`, err);
                }
            }
        }
        console.log('Fix script finished.');
        process.exit(0);
    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    }
};

fix();
