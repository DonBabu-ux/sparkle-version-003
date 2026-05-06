require('dotenv').config();
const pool = require('./config/database');
const crypto = require('crypto');

async function migrate() {
    try {
        console.log('🚀 Starting group_posts migration...');
        
        // 1. Get all group posts
        const [groupPosts] = await pool.query('SELECT * FROM group_posts');
        console.log(`Found ${groupPosts.length} posts to migrate.`);

        for (const gp of groupPosts) {
            console.log(`Migrating post ${gp.post_id}...`);
            
            // Check if already in posts table
            const [existing] = await pool.query('SELECT post_id FROM posts WHERE post_id = ?', [gp.post_id]);
            if (existing.length > 0) {
                console.log(`Post ${gp.post_id} already exists in posts table, skipping.`);
                continue;
            }

            // 2. Insert into posts table
            await pool.query(
                `INSERT INTO posts (post_id, user_id, content, group_id, post_type, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [gp.post_id, gp.user_id, gp.content, gp.group_id, 'public', gp.created_at]
            );

            // 3. Handle media (multiple images)
            if (gp.image_url) {
                const urls = gp.image_url.split(',');
                for (let i = 0; i < urls.length; i++) {
                    await pool.query(
                        `INSERT INTO post_media (media_id, post_id, media_url, media_type, upload_order) 
                         VALUES (?, ?, ?, ?, ?)`,
                        [crypto.randomUUID(), gp.post_id, urls[i], 'image', i]
                    );
                }
                
                // Update main media_url for legacy support
                await pool.query(
                    'UPDATE posts SET media_url = ?, media_type = ? WHERE post_id = ?',
                    [urls[0], 'image', gp.post_id]
                );
            }

            console.log(`Successfully migrated post ${gp.post_id}`);
        }

        console.log('✅ Migration complete!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrate();
