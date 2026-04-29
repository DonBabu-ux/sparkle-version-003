const redis = require('./redis.service');
const logger = require('../utils/logger');
const pool = require('../config/database');

const CATEGORIES = ['Sports', 'Technology', 'Entertainment', 'Academic', 'Social', 'Music', 'Lifestyle', 'Gaming', 'Comedy', 'Education', 'Politics', 'Viral', 'Dance', 'Nature', 'Fashion', 'Health', 'Travel'];

/**
 * Session Interest Service (SIV Engine)
 * Formalizes Moments as a "Controlled Exploration Layer".
 * Tracks real-time session behavior and feeds signals back to Home Feed v7.7.
 */
class SessionInterestService {
    /**
     * Records a behavioral event from the Moments telemetry pipeline
     * @param {string} userId 
     * @param {string} momentId 
     * @param {Object} event { type: 'watch_time'|'skip'|'like'|'share'|'save', value?: number, category?: string }
     */
    async recordEvent(userId, momentId, event) {
        try {
            const sessionKey = `siv:${userId}`;
            
            // 1. Calculate weighted increment (SIV = w_t T + w_l L + w_c C + w_s S + w_r R - w_k K)
            let weight = 0;
            switch (event.type) {
                case 'watch_time_tick': 
                    weight = 1; // T: accumulated time spent (frontend sends tick every few seconds)
                    break;
                case 'watch_time': 
                    // Fallback for completion percentage (0 to 1)
                    weight = (event.value > 0.8) ? 5 : (event.value > 0.4 ? 2 : -1); 
                    break;
                case 'skip': 
                    weight = -5; // K: skips (negative weight)
                    break;
                case 'like': weight = 10; break; // L
                case 'comment': weight = 15; break; // C
                case 'share': weight = 20; break; // S
                case 'save': weight = 15; break; // R
                case 'rewatch': weight = 8; break; // R (rewatch frequency)
                case 'search': weight = 25; break; // Explicit Search intent
            }

            if (weight === 0) return;

            // 2. Update Session Interest Vector (SIV) in Redis
            if (event.category) {
                const currentWeight = await redis.get(`${sessionKey}:${event.category}`) || 0;
                await redis.set(`${sessionKey}:${event.category}`, Number(currentWeight) + weight, 3600); // 1 hour TTL
            }

            // 3. Aggregate Signal for Home Feed Bridge (Async, fire-and-forget)
            this.bridgeSignal(userId, event.category, weight).catch(err => logger.error('Signal Bridge Error:', err));

            return true;
        } catch (error) {
            logger.error('SIV Record Event Error:', error);
            return false;
        }
    }

    /**
     * Bridges Moments signals to the Home Feed v7.7 system
     */
    async bridgeSignal(userId, category, weight) {
        if (!category) return;
        await pool.query(`
            INSERT INTO user_signals_bridge (user_id, category, signal_strength)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE signal_strength = signal_strength + ?
        `, [userId, category, weight, weight]);
    }

    /**
     * Returns the current session's interest profile.
     * OPTIMIZED: All 17 Redis GETs run in parallel via Promise.all
     * — eliminates the sequential waterfall that caused 17× round-trip latency.
     */
    async getSessionProfile(userId) {
        const sessionKey = `siv:${userId}`;

        // Fire all Redis GETs simultaneously instead of one-by-one
        const values = await Promise.all(
            CATEGORIES.map(cat => redis.get(`${sessionKey}:${cat}`))
        );

        const profile = {};
        CATEGORIES.forEach((cat, i) => {
            if (values[i]) profile[cat] = Number(values[i]);
        });

        return profile;
    }
}

module.exports = new SessionInterestService();
