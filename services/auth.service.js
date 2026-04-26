const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/database');
const logger = require('../utils/logger');

class AuthService {
    /**
     * Generate Access and Refresh tokens
     */
    async generateTokens(user, deviceId = 'unknown') {
        const accessToken = jwt.sign(
            { 
                userId: user.user_id, 
                email: user.email, 
                username: user.username,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '15m' } // Short lived
        );

        const refreshToken = crypto.randomBytes(40).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

        // Store refresh token in DB
        await pool.query(
            'INSERT INTO refresh_tokens (token_id, user_id, token, device_id, expires_at) VALUES (?, ?, ?, ?, ?)',
            [crypto.randomUUID(), user.user_id, refreshToken, deviceId, expiresAt]
        );

        return { accessToken, refreshToken };
    }

    /**
     * Verify and rotate refresh token
     */
    async refreshAccessToken(oldRefreshToken) {
        // 1. Find token in DB
        const [tokens] = await pool.query(
            'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > NOW()',
            [oldRefreshToken]
        );

        if (tokens.length === 0) {
            throw new Error('Invalid or expired refresh token');
        }

        const tokenData = tokens[0];

        // 2. Get user data
        const [users] = await pool.query(
            'SELECT * FROM users WHERE user_id = ?',
            [tokenData.user_id]
        );

        if (users.length === 0) {
            throw new Error('User not found');
        }

        const user = users[0];

        // 3. Generate new tokens (Rotation)
        const newTokens = await this.generateTokens(user, tokenData.device_id);

        // 4. Delete old refresh token (to prevent reuse)
        await pool.query('DELETE FROM refresh_tokens WHERE token = ?', [oldRefreshToken]);

        return newTokens;
    }

    /**
     * Track login activity for multi-device detection
     */
    async trackLoginActivity(userId, details) {
        const { deviceId, ipAddress, userAgent } = details;
        const redisService = require('./redis.service');
        const cacheKey = `session:verified:${userId}:${deviceId}`;
        
        // 1. Check Redis Cache first (Soft failure if Redis is down)
        try {
            const isCached = await redisService.get(cacheKey);
            if (isCached) return { isNewDevice: false };
        } catch (e) {
            logger.warn('Redis read failed in trackLoginActivity:', e.message);
        }

        // 2. Check Database
        const [existing] = await pool.query(
            'SELECT * FROM login_activity WHERE user_id = ? AND device_id = ?',
            [userId, deviceId]
        );

        const isNewDevice = existing.length === 0;

        await pool.query(
            `INSERT INTO login_activity (activity_id, user_id, device_id, ip_address, user_agent, is_verified) 
             VALUES (?, ?, ?, ?, ?, ?) 
             ON DUPLICATE KEY UPDATE ip_address = ?, user_agent = ?, last_active = NOW()`,
            [
                crypto.randomUUID(), 
                userId, 
                deviceId, 
                ipAddress, 
                userAgent, 
                !isNewDevice, // If already seen, consider verified
                ipAddress, 
                userAgent
            ]
        );

        // 3. Cache the verification status in Redis (30 days) - Soft failure
        if (!isNewDevice) {
            try {
                await redisService.set(cacheKey, 'true', 30 * 24 * 60 * 60);
            } catch (e) {
                logger.warn('Redis write failed in trackLoginActivity:', e.message);
            }
        }

        return { isNewDevice };
    }
}


module.exports = new AuthService();
