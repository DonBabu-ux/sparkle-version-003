const pool = require('./config/database');

async function addRoleColumn() {
    try {
        console.log('Adding role column to users table...');

        // Add role column to users table
        await pool.query(`
            ALTER TABLE users
            ADD COLUMN role ENUM('member', 'moderator', 'admin') DEFAULT 'member'
            AFTER language
        `);

        console.log('✅ Role column added successfully!');

        // Set first user as admin (you can modify this logic)
        const [users] = await pool.query('SELECT user_id FROM users ORDER BY joined_at LIMIT 1');
        if (users.length > 0) {
            await pool.query('UPDATE users SET role = "admin" WHERE user_id = ?', [users[0].user_id]);
            console.log('✅ First user set as admin!');
        }

    } catch (error) {
        console.error('❌ Error adding role column:', error);
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('⚠️  Role column already exists');
        } else {
            console.error('❌ Full error:', error);
        }
    } finally {
        process.exit();
    }
}

addRoleColumn();