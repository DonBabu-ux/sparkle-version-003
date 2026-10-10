const db = require('../config/database');
const crypto = require('crypto');

class SessionService {
    /**
     * Register or update an active user session (Web, Android, Desktop, etc.)
     */
    static async registerSession({ userId, sessionId = null, socketId = null, platform = 'web', pushToken = null }) {
        const id = sessionId || crypto.randomUUID();
        await db.query(`
            INSERT INTO user_sessions (session_id, user_id, socket_id, platform, push_token, last_active_at, is_online)
            VALUES (?, ?, ?, ?, ?, NOW(), 1)
            ON DUPLICATE KEY UPDATE 
                socket_id = VALUES(socket_id),
                platform = VALUES(platform),
                push_token = COALESCE(VALUES(push_token), push_token),
                last_active_at = NOW(),
                is_online = 1
        `, [id, userId, socketId, platform, pushToken]);
        return id;
    }

    /**
     * Update session status to offline on disconnect
     */
    static async deactivateSocket(socketId) {
        if (!socketId) return;
        await db.query(`
            UPDATE user_sessions 
            SET is_online = 0, socket_id = NULL, last_active_at = NOW() 
            WHERE socket_id = ?
        `, [socketId]);
    }

    /**
     * Get all active sessions for a recipient (for multi-device delivery)
     */
    static async getActiveSessions(userId) {
        const [rows] = await db.query(`
            SELECT session_id, socket_id, platform, push_token, is_online 
            FROM user_sessions 
            WHERE user_id = ?
        `, [userId]);
        return rows;
    }

    /**
     * Remove expired sessions older than 30 days
     */
    static async cleanupStaleSessions() {
        await db.query(`
            DELETE FROM user_sessions 
            WHERE last_active_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
        `);
    }
}

module.exports = SessionService;
