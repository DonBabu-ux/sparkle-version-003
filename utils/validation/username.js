// utils/validation/username.js

/**
 * Canonical username normalization for Sparkle.
 * Shared across:
 * - registration
 * - username login
 * - username availability
 * - username change
 * - username search
 * - username suggestions
 * - profile lookup
 * - uniqueness validation
 */
function normalizeUsername(username) {
    if (!username) return '';
    return String(username)
        .trim()
        .replace(/^@+/, '')
        .toLowerCase();
}

/**
 * Validate a username according to Sparkle rules.
 * Rules:
 *  - 3 to 30 characters
 *  - only letters, numbers, periods, underscores
 */
function validateUsername(username) {
    if (!username || typeof username !== 'string') {
        return {
            valid: false,
            error: {
                field: 'username',
                code: 'USERNAME_REQUIRED',
                message: 'Username is required.'
            }
        };
    }

    const normalized = normalizeUsername(username);

    if (normalized.length < 3) {
        return {
            valid: false,
            error: {
                field: 'username',
                code: 'USERNAME_TOO_SHORT',
                message: 'Username must be at least 3 characters long.'
            }
        };
    }

    if (normalized.length > 30) {
        return {
            valid: false,
            error: {
                field: 'username',
                code: 'USERNAME_TOO_LONG',
                message: 'Username cannot exceed 30 characters.'
            }
        };
    }

    const regex = /^[a-z0-9._]+$/;
    if (!regex.test(normalized)) {
        return {
            valid: false,
            error: {
                field: 'username',
                code: 'INVALID_USERNAME',
                message: 'Username can only contain letters, numbers, periods and underscores.'
            }
        };
    }

    return { valid: true, value: normalized };
}

module.exports = { normalizeUsername, validateUsername };
