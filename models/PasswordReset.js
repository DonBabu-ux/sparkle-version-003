const pool = require('../config/database');
const crypto = require('crypto');

class PasswordReset {
    static async create(userId, email) {
        const resetId = crypto.randomUUID();
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await pool.query(
            `INSERT INTO password_resets (reset_id, user_id, email, token, expires_at)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE token = ?, expires_at = ?`,
            [resetId, userId, email, token, expiresAt, token, expiresAt]
        );

        return { resetId, token };
    }

    static async verify(token) {
        const [rows] = await pool.query(
            `SELECT * FROM password_resets 
             WHERE token = ? AND expires_at > NOW() AND used_at IS NULL`,
            [token]
        );

        if (rows.length === 0) {
            return null;
        }

        return rows[0];
    }

    static async markAsUsed(resetId) {
        await pool.query(
            'UPDATE password_resets SET used_at = NOW() WHERE reset_id = ?',
            [resetId]
        );
    }
}

module.exports = PasswordReset;
