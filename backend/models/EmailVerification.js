const pool = require('../config/database');
const crypto = require('crypto');
const logger = require('../utils/logger');

class EmailVerification {
    static async create(userId, email) {
        const verificationId = crypto.randomUUID();
        const code = crypto.randomBytes(3).toString('hex').toUpperCase();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        await pool.query(
            `INSERT INTO email_verifications (verification_id, user_id, email, code, expires_at)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE code = ?, expires_at = ?`,
            [verificationId, userId, email, code, expiresAt, code, expiresAt]
        );

        return { verificationId, code };
    }

    static async verify(code) {
        const [rows] = await pool.query(
            `SELECT * FROM email_verifications 
             WHERE code = ? AND expires_at > NOW() AND verified_at IS NULL`,
            [code]
        );

        if (rows.length === 0) {
            return null;
        }

        const verification = rows[0];

        // Mark as verified
        await pool.query(
            `UPDATE email_verifications 
             SET verified_at = NOW() 
             WHERE verification_id = ?`,
            [verification.verification_id]
        );

        // Update user's email verified status
        await pool.query(
            `UPDATE users 
             SET email_verified = true, updated_at = NOW() 
             WHERE user_id = ?`,
            [verification.user_id]
        );

        return verification;
    }

    static async findByUser(userId) {
        const [rows] = await pool.query(
            'SELECT * FROM email_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
            [userId]
        );
        return rows[0] || null;
    }
}

module.exports = EmailVerification;
