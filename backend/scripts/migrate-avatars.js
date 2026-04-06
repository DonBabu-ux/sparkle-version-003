/**
 * scripts/migrate-avatars.js
 * Scans the database for users with external avatar URLs (CDN links)
 * and downloads them locally to prevent 403 Forbidden errors.
 */

require('dotenv').config();
const { query } = require('../utils/database/query');
const { downloadExternalImage } = require('../utils/media.utils');
const logger = require('../utils/logger');
const path = require('path');

async function migrateAvatars() {
    console.log('🚀 Starting Avatar Migration...');

    try {
        // 1. Find users with external avatar URLs
        const [users] = await query(
            "SELECT user_id, username, avatar_url FROM users WHERE avatar_url LIKE 'http%' AND avatar_url NOT LIKE ?",
            [`%${process.env.APP_URL || 'localhost'}%`]
        );

        console.log(`Found ${users.length} users with external avatar URLs.`);

        let successCount = 0;
        let failCount = 0;

        for (const user of users) {
            console.log(`Processing user: ${user.username} (${user.avatar_url})`);

            try {
                // 2. Download the image
                const localPath = await downloadExternalImage(user.avatar_url, 'avatars');

                if (localPath && localPath.startsWith('/uploads/')) {
                    // 3. Update the database with local path
                    await query(
                        "UPDATE users SET avatar_url = ? WHERE user_id = ?",
                        [localPath, user.user_id]
                    );
                    console.log(`✅ Success: Updated ${user.username} -> ${localPath}`);
                    successCount++;
                } else {
                    console.warn(`⚠️ Warning: Could not download avatar for ${user.username}, falling back to default.`);
                    await query(
                        "UPDATE users SET avatar_url = ? WHERE user_id = ?",
                        ['/uploads/avatars/default.png', user.user_id]
                    );
                    failCount++;
                }
            } catch (error) {
                console.error(`❌ Error processing ${user.username}:`, error.message);
                failCount++;
            }
        }

        console.log('\n--- Migration Results ---');
        console.log(`Total: ${users.length}`);
        console.log(`Success: ${successCount}`);
        console.log(`Failed: ${failCount}`);
        console.log('-------------------------\n');

    } catch (error) {
        console.error('🔥 Migration failed:', error);
    } finally {
        // Close database connection if needed (pool.end() usually not called if it's a global pool)
        process.exit(0);
    }
}

migrateAvatars();
