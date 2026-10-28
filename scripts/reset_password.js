/**
 * Operational password reset for a single account.
 *
 * SECURITY: this script used to carry a hardcoded password for a fixed user
 * id — anyone with repo access knew a privileged account's credential. It is
 * now env-driven and refuses to run without explicit inputs:
 *
 *   RESET_USER_EMAIL=user@example.com RESET_NEW_PASSWORD='...' node scripts/reset_password.js
 *
 * A one-time password in shell history is still a real credential — prefer
 * the in-app "forgot password" flow whenever possible.
 */
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

const email = (process.env.RESET_USER_EMAIL || '').trim().toLowerCase();
const password = process.env.RESET_NEW_PASSWORD;

async function resetPassword() {
    if (!email || !password) {
        console.error('Refusing to run: set RESET_USER_EMAIL and RESET_NEW_PASSWORD.');
        console.error('Example: RESET_USER_EMAIL=admin@campus.edu RESET_NEW_PASSWORD="..." node scripts/reset_password.js');
        process.exit(1);
    }
    if (password.length < 12) {
        console.error('Refusing to run: RESET_NEW_PASSWORD must be at least 12 characters.');
        process.exit(1);
    }

    try {
        const hash = await bcrypt.hash(password, 12);

        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: process.env.DB_PORT || 3306
        });

        const [result] = await connection.execute(
            'UPDATE users SET password_hash = ? WHERE LOWER(email) = ?',
            [hash, email]
        );

        if (result.affectedRows === 0) {
            console.error(`No user found with email ${email}. Nothing was changed.`);
            await connection.end();
            process.exit(1);
        }

        console.log(`Password reset successfully for ${email}. Rows affected:`, result.affectedRows);
        console.log('Reminder: if this is an admin account, its admin password is a SEPARATE credential — set one in Admin settings.');
        await connection.end();
    } catch (err) {
        console.error('Error resetting password:', err.message);
        process.exit(1);
    }
}

resetPassword();
