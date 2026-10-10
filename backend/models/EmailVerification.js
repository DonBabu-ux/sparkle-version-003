const pool = require('../config/database');
const crypto = require('crypto');
const logger = require('../utils/logger');
const redisService = require('../services/redis.service');

class EmailVerification {
    static async create(userId, email) {
        const verificationId = crypto.randomUUID();
        // Generate a 6-digit numeric code for better mobile UX
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const ttl = 15 * 60; // 15 minutes for security
        
        // 1. Store in Redis for fast verification (primary)
        await redisService.set(`otp:${code}`, { userId, email }, ttl);
        
        // 2. Store in MySQL (audit trail/fallback)
        const expiresAt = new Date(Date.now() + ttl * 1000);
        await pool.query(
            `INSERT INTO email_verifications (verification_id, user_id, email, code, expires_at)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE code = ?, expires_at = ?`,
            [verificationId, userId, email, code, expiresAt, code, expiresAt]
        ).catch(err => logger.error('MySQL OTP Storage Error:', err));

        return { verificationId, code };
    }

    static async verify(code) {
        // 1. Try Redis first (fast path)
        let data = await redisService.get(`otp:${code}`);
        
        if (!data) {
            // 2. Fallback to MySQL if Redis failed or data evicted
            const [rows] = await pool.query(
                `SELECT * FROM email_verifications 
                 WHERE code = ? AND expires_at > NOW() AND verified_at IS NULL`,
                [code]
            );
            if (rows.length > 0) {
                data = { userId: rows[0].user_id, email: rows[0].email, mysqlId: rows[0].verification_id };
            }
        }

        if (!data) return null;

        // 3. Mark as verified in both systems
        await Promise.all([
            redisService.del(`otp:${code}`),
            pool.query(
                'UPDATE email_verifications SET verified_at = NOW() WHERE code = ?',
                [code]
            ),
            pool.query(
                'UPDATE users SET email_verified = true, updated_at = NOW() WHERE user_id = ?',
                [data.userId]
            )
        ]);

        return { user_id: data.userId, email: data.email };
    }

    static async isRateLimited(email) {
        const key = `ratelimit:otp:${email}`;
        const count = await redisService.incr(key);
        if (count === 1) {
            await redisService.expire(key, 60); // 1 minute window
        }
        return count > 3; // Max 3 requests per minute
    }
}

module.exports = EmailVerification;

