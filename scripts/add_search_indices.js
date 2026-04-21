const mysql = require('mysql2/promise');
require('dotenv').config();

async function addIndices() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });

    try {
        console.log('Adding FULLTEXT indices...');

        const commands = [
            'ALTER TABLE users ADD FULLTEXT INDEX idx_users_search (username, name, bio)',
            'ALTER TABLE posts ADD FULLTEXT INDEX idx_posts_search (content)',
            'ALTER TABLE `groups` ADD FULLTEXT INDEX idx_groups_search (name, description)',
            'ALTER TABLE clubs ADD FULLTEXT INDEX idx_clubs_search (name, description)',
            'ALTER TABLE marketplace_listings ADD FULLTEXT INDEX idx_listings_search (title, description)'
        ];

        for (const cmd of commands) {
            try {
                console.log(`Executing: ${cmd}`);
                await connection.query(cmd);
                console.log('Success.');
            } catch (err) {
                if (err.code === 'ER_DUP_KEYNAME') {
                    console.log('Index already exists, skipping.');
                } else {
                    console.error(`Error: ${err.message}`);
                }
            }
        }

        console.log('Finished adding indices.');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await connection.end();
    }
}

addIndices();
