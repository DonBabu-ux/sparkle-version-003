const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function resetPassword() {
    try {
        const password = 'Babu@0117';
        const hash = await bcrypt.hash(password, 12);
        
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306
        });

        const userId = 'd75fe3b5-7a45-4581-ab13-91934d8b54de';
        
        const [result] = await connection.execute(
            'UPDATE users SET password_hash = ? WHERE user_id = ?',
            [hash, userId]
        );
        
        console.log('Password reset successfully. Rows affected:', result.affectedRows);
        await connection.end();
    } catch (err) {
        console.error('Error resetting password:', err);
    }
}

resetPassword();
