require('dotenv').config();
const pool = require('./config/database');

async function updateDB() {
    try {
        console.log('Adding location column to posts...');
        try {
            await pool.query('ALTER TABLE posts ADD COLUMN location VARCHAR(255) DEFAULT NULL AFTER group_id');
            await pool.query('ALTER TABLE posts ADD INDEX idx_posts_location (location)');
        } catch (e) {
            if (e.code === 'ER_DUP_COLUMN_NAME') {
                console.log('Location column already exists');
            } else {
                throw e;
            }
        }

        console.log('Creating post_media table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS post_media (
                media_id CHAR(36) NOT NULL,
                post_id CHAR(36) NOT NULL,
                media_url VARCHAR(500) NOT NULL,
                media_type ENUM('image', 'video') NOT NULL,
                upload_order INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (media_id),
                FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
                INDEX idx_post_media_post (post_id, upload_order)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        console.log('Creating post_hashtags table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS post_hashtags (
                post_id CHAR(36) NOT NULL,
                tag VARCHAR(100) NOT NULL,
                PRIMARY KEY (post_id, tag),
                FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
                INDEX idx_hashtags_tag (tag)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        console.log('Database updated successfully');
        process.exit(0);
    } catch (error) {
        console.error('Update failed:', error);
        process.exit(1);
    }
}

updateDB();
