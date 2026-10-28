const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Admin elevation sessions.
 *
 * A verified admin password mints a short-lived session token that authorizes
 * the whole admin surface (reads + writes), not just single mutations. The
 * token is shown once and only its SHA-256 hash is stored, so a DB dump can
 * never replay it. TTL is deliberately short: elevation expires fast and the
 * admin password is re-entered to extend.
 */
const ADMIN_SESSION_TTL_MINUTES = 15;
const ADMIN_SESSION_HEADER = 'x-admin-session';

/**
 * Admin credential layer.
 *
 * Guarantee: the admin password hash is a SEPARATE credential from the user
 * login password. It is stored in users.admin_password_hash, verified only
 * against itself, and:
 *   - can never equal the account's login password (checked at write time)
 *   - can never equal the account's previous admin password
 *   - fails closed: a NULL hash denies every admin mutation
 *
 * bcrypt cost 12 — same as signup, above the 10 used by the password-change
 * routes (this is the highest-privilege credential in the system).
 */

const BCRYPT_COST = 12;
const ADMIN_ROLES = ['admin', 'moderator'];

const loadUser = async (userId) => {
    const [rows] = await pool.query(
        'SELECT user_id, role, password_hash, admin_password_hash FROM users WHERE user_id = ? LIMIT 1',
        [userId]
    );
    return rows[0] || null;
};

const hasAdminPassword = async (userId) => {
    const user = await loadUser(userId);
    return !!(user && user.admin_password_hash);
};

/**
 * Set (or rotate) the admin password for an admin/moderator account.
 *
 * @param {string} userId            caller (from auth middleware)
 * @param {string} currentUserPassword  proof of account ownership — verified
 *                                      against password_hash
 * @param {string} newAdminPassword     the new admin credential
 * @returns {Promise<{ok: boolean, code: string, message: string}>}
 */
const setAdminPassword = async (userId, currentUserPassword, newAdminPassword) => {
    if (!newAdminPassword || newAdminPassword.length < 12) {
        return { ok: false, code: 'weak', message: 'Admin password must be at least 12 characters.' };
    }

    const user = await loadUser(userId);
    if (!user) return { ok: false, code: 'no_user', message: 'Account not found.' };
    if (!ADMIN_ROLES.includes(user.role)) {
        return { ok: false, code: 'forbidden', message: 'Admin privileges required.' };
    }

    // 1. The caller must prove they own the account.
    if (!user.password_hash || !(await bcrypt.compare(currentUserPassword, user.password_hash))) {
        return { ok: false, code: 'current_password', message: 'Your current login password is incorrect.' };
    }

    // 2. HARD GUARANTEE #1: admin password must never equal the login password.
    if (await bcrypt.compare(newAdminPassword, user.password_hash)) {
        return {
            ok: false,
            code: 'equals_login_password',
            message: 'The admin password must be different from your login password.'
        };
    }

    // 3. HARD GUARANTEE #2: never reuse the previous admin password.
    if (user.admin_password_hash && (await bcrypt.compare(newAdminPassword, user.admin_password_hash))) {
        return {
            ok: false,
            code: 'equals_previous',
            message: 'Choose a new password — this one is already your admin password.'
        };
    }

    const hash = await bcrypt.hash(newAdminPassword, BCRYPT_COST);

    // 4. Defense in depth: the two hashes must not be byte-identical either
    //    (they never are — different salts — but assert it before persisting).
    if (hash === user.password_hash) {
        return { ok: false, code: 'hash_collision', message: 'Could not set a distinct admin password.' };
    }

    await pool.query('UPDATE users SET admin_password_hash = ? WHERE user_id = ?', [hash, userId]);
    logger.info(`Admin password ${user.admin_password_hash ? 'rotated' : 'set'} for user ${userId}`);
    return { ok: true, code: 'ok', message: user.admin_password_hash ? 'Admin password updated.' : 'Admin password set.' };
};

/**
 * Verify a candidate against the ADMIN credential only — never against
 * password_hash. Returns false when no admin password is set (fail-closed).
 */
const verifyAdminPassword = async (userId, candidate) => {
    const user = await loadUser(userId);
    if (!user || !user.admin_password_hash) return false;
    if (!candidate) return false;
    return bcrypt.compare(candidate, user.admin_password_hash);
};

/**
 * Exchange a verified admin password for an elevation session token.
 * Returns null when the credential is unset or wrong (fail-closed).
 */
const createAdminSession = async (userId, candidate) => {
    if (!(await verifyAdminPassword(userId, candidate))) return null;
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await pool.query(
        'INSERT INTO admin_sessions (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))',
        [tokenHash, userId, ADMIN_SESSION_TTL_MINUTES]
    );
    return { token, expiresInMinutes: ADMIN_SESSION_TTL_MINUTES };
};

/** Resolve a token to its user id, or null (expired/unknown/revoked). */
const verifyAdminSession = async (token) => {
    if (!token || typeof token !== 'string') return null;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const [rows] = await pool.query(
        'SELECT user_id FROM admin_sessions WHERE token_hash = ? AND expires_at > NOW() LIMIT 1',
        [tokenHash]
    );
    return rows[0] ? rows[0].user_id : null;
};

const endAdminSession = async (token) => {
    if (!token || typeof token !== 'string') return;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await pool.query('DELETE FROM admin_sessions WHERE token_hash = ?', [tokenHash]);
};

module.exports = {
    BCRYPT_COST,
    ADMIN_SESSION_TTL_MINUTES,
    ADMIN_SESSION_HEADER,
    setAdminPassword,
    verifyAdminPassword,
    hasAdminPassword,
    loadUser,
    createAdminSession,
    verifyAdminSession,
    endAdminSession,
};
