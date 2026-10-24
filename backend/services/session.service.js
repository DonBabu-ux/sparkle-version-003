const db = require('../config/database');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Heartbeat interval used by the frontend PresenceManager (20 s).
 * Stale-session expiry threshold = 2 × heartbeat + server grace (60 s) + buffer (30 s) = 110 s.
 * A session that has not pinged within this window is considered dead.
 */
const STALE_SESSION_THRESHOLD_SEC = 110;

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
        // Only sessions that can actually RECEIVE something: a live socket
        // (is_online) or a registered push token. Zombie rows from old logins
        // (no socket, no token) must not be enqueued — they multiplied the
        // delivery queue and caused the FCM notification bomb.
        const [rows] = await db.query(`
            SELECT session_id, socket_id, platform, push_token, is_online 
            FROM user_sessions 
            WHERE user_id = ?
              AND (is_online = 1 OR push_token IS NOT NULL)
        `, [userId]);
        return rows;
    }

    /**
     * Remove expired sessions older than 7 days
     */
    static async cleanupStaleSessions() {
        await db.query(`
            DELETE FROM user_sessions 
            WHERE last_active_at < DATE_SUB(NOW(), INTERVAL 7 DAY)
        `);
    }

    /**
     * Server-restart cleanup: on a fresh process start no active socket
     * connections exist, so every session marked is_online=1 is stale.
     *
     * Steps:
     *   1. Mark all user_sessions rows as is_online=0.
     *   2. Reset users.is_online=0 and record last_seen_at=UTC_TIMESTAMP()
     *      for every user who was previously marked online.
     *
     * This is idempotent — safe to run even if the DB was already clean.
     */
    static async resetAllPresenceOnStartup() {
        try {
            // 1. Deactivate all sessions — no real socket connections on boot.
            await db.query(`
                UPDATE user_sessions
                SET is_online = 0, socket_id = NULL
                WHERE is_online = 1
            `);

            // 2. Mark every user that was online as offline, recording last_seen_at
            //    only when they were actually online (avoid overwriting a legitimate
            //    recent last_seen with a stale boot timestamp).
            await db.query(`
                UPDATE users
                SET is_online = 0,
                    last_seen_at = CASE
                        WHEN is_online = 1 THEN UTC_TIMESTAMP()
                        ELSE last_seen_at
                    END
                WHERE is_online = 1
            `);

            logger.info('✅ [SessionService] Startup presence reset: all stale online flags cleared.');
        } catch (err) {
            logger.warn('[SessionService] resetAllPresenceOnStartup failed (non-fatal):', err.message);
        }
    }

    /**
     * Periodic stale-session expiry.
     *
     * A session is stale when its last_active_at is older than
     * STALE_SESSION_THRESHOLD_SEC (2 × heartbeat + grace + buffer).
     * For each stale session we:
     *   1. Collect the affected user IDs.
     *   2. Mark those sessions as offline.
     *   3. For each affected user, check if they have any remaining
     *      active sessions. If not, mark them offline in the users table.
     *
     * Returns the number of users whose presence was cleared.
     */
    static async expireStalePresence() {
        try {
            // 1. Find all stale is_online sessions.
            const [staleRows] = await db.query(`
                SELECT DISTINCT user_id
                FROM user_sessions
                WHERE is_online = 1
                  AND last_active_at < DATE_SUB(NOW(), INTERVAL ? SECOND)
            `, [STALE_SESSION_THRESHOLD_SEC]);

            if (!staleRows || staleRows.length === 0) return 0;

            // 2. Deactivate the stale sessions.
            await db.query(`
                UPDATE user_sessions
                SET is_online = 0, socket_id = NULL
                WHERE is_online = 1
                  AND last_active_at < DATE_SUB(NOW(), INTERVAL ? SECOND)
            `, [STALE_SESSION_THRESHOLD_SEC]);

            // 3. For each affected user, check if any session is still healthy.
            let offlineCount = 0;
            for (const row of staleRows) {
                const uid = row.user_id;
                try {
                    const [alive] = await db.query(`
                        SELECT 1 FROM user_sessions
                        WHERE user_id = ? AND is_online = 1
                        LIMIT 1
                    `, [uid]);

                    if (!alive || alive.length === 0) {
                        // No remaining active session — mark user offline.
                        await db.query(`
                            UPDATE users
                            SET is_online = 0,
                                last_seen_at = UTC_TIMESTAMP()
                            WHERE user_id = ? AND is_online = 1
                        `, [uid]);
                        offlineCount++;
                    }
                } catch (innerErr) {
                    logger.warn(`[SessionService] expireStalePresence user ${uid}:`, innerErr.message);
                }
            }

            if (offlineCount > 0) {
                logger.info(`⏱️  [SessionService] Stale-session sweep: ${offlineCount} user(s) marked offline.`);
            }
            return offlineCount;
        } catch (err) {
            logger.warn('[SessionService] expireStalePresence failed (non-fatal):', err.message);
            return 0;
        }
    }
}

module.exports = SessionService;
