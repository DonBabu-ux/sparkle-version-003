const mysql = require('mysql2/promise');

async function apply() {
    const connection = await mysql.createConnection({
        host: 'mysql-lilbee.alwaysdata.net',
        user: 'lilbee',
        password: '@lilbeeLogics',
        database: 'lilbee_sparkle'
    });

    try {
        console.log('Adding indices to user_actions...');
        await connection.query('CREATE INDEX idx_user_actions_created ON user_actions(created_at)');
        await connection.query('CREATE INDEX idx_user_actions_user_created ON user_actions(user_id, created_at)');
        console.log('✅ user_actions indices added');
        
        // Optimize posts indices if needed
        console.log('Optimizing posts indices...');
        // Ensure index on (group_id, created_at) to avoid filesort on group feeds
        await connection.query('CREATE INDEX idx_posts_group_created ON posts(group_id, created_at)');
        console.log('✅ posts indices optimized');
        
    } catch (err) {
        console.error('Migration failed:', err.message);
    } finally {
        await connection.end();
    }
}

apply();
