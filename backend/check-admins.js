require('dotenv').config();
const pool = require('./config/database');

async function checkAdmin() {
    try {
        const [admins] = await pool.query('SELECT user_id, name, username, email, role FROM users WHERE role IN ("admin", "moderator")');
        if (admins.length > 0) {
            console.log('--- Admin/Moderator Users Found ---');
            console.table(admins);
        } else {
            console.log('No Admin or Moderator users found in the database.');
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        process.exit();
    }
}

checkAdmin();
