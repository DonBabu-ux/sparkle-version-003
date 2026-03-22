require('dotenv').config();
const pool = require('./config/database');

const columns = [
    { name: 'headline', type: 'VARCHAR(255)' },
    { name: 'website', type: 'VARCHAR(255)' },
    { name: 'relationship_status', type: 'VARCHAR(100)' },
    { name: 'partner_id', type: 'CHAR(36)' },
    { name: 'relationship_since', type: 'TIMESTAMP NULL DEFAULT NULL' },
    { name: 'linkedin_url', type: 'VARCHAR(255)' },
    { name: 'github_url', type: 'VARCHAR(255)' },
    { name: 'instagram_url', type: 'VARCHAR(255)' },
    { name: 'twitter_url', type: 'VARCHAR(255)' }
];

async function migrateProfileFields() {
    try {
        console.log('🚀 Starting profile fields migration...');

        for (const col of columns) {
            try {
                // Check if column exists
                const [check] = await pool.query(`SHOW COLUMNS FROM users LIKE ?`, [col.name]);
                if (check.length === 0) {
                    console.log(`Adding column: ${col.name}...`);
                    await pool.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type} DEFAULT NULL`);
                } else {
                    console.log(`Column ${col.name} already exists.`);
                }
            } catch (colErr) {
                console.error(`Error adding ${col.name}:`, colErr.message);
            }
        }

        // Add foreign key if not exists
        try {
            console.log('Adding foreign key constraint...');
            await pool.query(`
                ALTER TABLE users 
                ADD CONSTRAINT fk_partner 
                FOREIGN KEY (partner_id) REFERENCES users(user_id) 
                ON DELETE SET NULL
            `);
        } catch (fkErr) {
            if (fkErr.code === 'ER_DUP_CONSTRAINT_NAME' || fkErr.code === 'ER_FK_DUP_NAME') {
                console.log('Foreign key constraint already exists.');
            } else {
                console.error('Error adding foreign key:', fkErr.message);
            }
        }

        // Update mock data
        const [users] = await pool.query('SELECT user_id, username FROM users LIMIT 1');
        if (users.length > 0) {
            const userId = users[0].user_id;
            await pool.query(`
                UPDATE users SET 
                headline = 'C.E.O LilBee logics',
                website = 'lilbeelogics.vercel.app',
                relationship_status = 'In a relationship',
                relationship_since = '2024-05-21 00:00:00',
                github_url = 'https://github.com/donthetechie',
                linkedin_url = 'https://linkedin.com/in/donthetechie'
                WHERE user_id = ?
            `, [userId]);
            console.log(`✅ Updated profile for user: ${users[0].username}`);
        }

        console.log('🎉 Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

migrateProfileFields();
