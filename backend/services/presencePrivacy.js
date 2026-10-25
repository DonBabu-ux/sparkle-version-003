const pool = require('../config/database');

/**
 * Server-authoritative presence privacy.
 *
 * Enforces the subject user's Active Status settings for every surface that
 * exposes online / last-seen data:
 *   - activity_status_enabled = 0  → presence hidden from everyone
 *   - last_seen_privacy = 'no_one' → presence hidden from everyone
 *   - last_seen_privacy = 'everyone' → visible
 *   - last_seen_privacy = 'followers' → visible only to the subject's followers
 *
 * Self always sees own presence. Callers remain responsible for applying block
 * rules where those already exist (chat queries null out blocked partners).
 */

// User ids in this schema are CHAR(36) UUID strings (see utils/database/init.js),
// so normalising through Number() turned every id into NaN/null and made
// canViewPresence return false for everyone — presence was silently disabled
// app-wide. Compare identifiers as opaque strings instead.
function normalizeId(id) {
    if (id === null || id === undefined) return null;
    const s = String(id).trim();
    return s === '' ? null : s;
}

async function fetchPresenceSettings(subjectId) {
    const [rows] = await pool.query(
        'SELECT activity_status_enabled, last_seen_privacy FROM users WHERE user_id = ?',
        [subjectId]
    );
    return rows && rows[0] ? rows[0] : null;
}

function isPresenceVisible(row) {
    if (!row) return false;
    const enabled = row.activity_status_enabled === null || row.activity_status_enabled === undefined
        ? 1
        : Number(row.activity_status_enabled);
    if (!enabled) return false;
    const privacy = row.last_seen_privacy || 'everyone';
    return privacy !== 'no_one';
}

/**
 * Whether `viewerId` may see `subjectId`'s online/last-seen information.
 */
async function canViewPresence(viewerId, subjectId) {
    const sid = normalizeId(subjectId);
    const vid = normalizeId(viewerId);
    if (!sid) return false;
    if (vid !== null && vid === sid) return true;

    const row = await fetchPresenceSettings(sid);
    if (!isPresenceVisible(row)) return false;

    const privacy = row.last_seen_privacy || 'everyone';
    if (privacy !== 'followers') return true;
    if (vid === null) return false;

    const [f] = await pool.query(
        'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ? LIMIT 1',
        [vid, sid]
    );
    return f.length > 0;
}

/**
 * Filters a candidate viewer list down to ids allowed to see subjectId's
 * presence. Returns [] when the subject hides their presence entirely.
 */
async function filterPresenceViewers(subjectId, candidateIds) {
    const sid = normalizeId(subjectId);
    const unique = [...new Set((candidateIds || []).map(normalizeId).filter((id) => id !== null && id !== sid))];
    if (unique.length === 0 || !sid) return [];

    const row = await fetchPresenceSettings(sid);
    if (!isPresenceVisible(row)) return [];

    const privacy = row.last_seen_privacy || 'everyone';
    if (privacy !== 'followers') return unique;

    const [followers] = await pool.query(
        'SELECT follower_id FROM follows WHERE following_id = ?',
        [sid]
    );
    const allowed = new Set(followers.map((f) => normalizeId(f.follower_id)));
    return unique.filter((id) => allowed.has(id));
}

module.exports = { canViewPresence, filterPresenceViewers };
