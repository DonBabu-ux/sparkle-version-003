// utils/validation/email.js
/**
 * Canonical email normalization for Sparkle.
 * Shared across:
 * - registration
 * - login
 * - email availability
 * - password recovery
 * - bloom filter insertion
 * - bloom filter lookup
 * - outbox identity hmac generation
 *
 * Policy (unchanged from the original implementation):
 *  - surrounding whitespace is trimmed
 *  - the whole address is lower-cased (local part included), which matches the
 *    case-insensitive `utf8mb4_general_ci` unique index on `users.email`
 *  - plus-addressing suffixes and dots in the local part are preserved
 *  - no provider-specific rewriting is applied
 */
function normalizeEmail(email) {
    if (typeof email !== 'string') return '';
    return email.trim().toLowerCase();
}

/**
 * Validate an email address.
 * Normalizes by trimming and lower-casing.
 */
function validateEmail(email) {
    const trimmed = normalizeEmail(email);
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmed || !regex.test(trimmed)) {
        return {
            valid: false,
            error: {
                field: 'email',
                code: 'INVALID_EMAIL',
                message: 'Email format is invalid.'
            }
        };
    }
    return { valid: true, value: trimmed };
}
module.exports = { normalizeEmail, validateEmail };
