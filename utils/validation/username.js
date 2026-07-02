// utils/validation/username.js
/**
 * Validate a username according to Sparkle rules.
 * Rules:
 *  - 3 to 30 characters
 *  - only letters, numbers, periods, underscores
 */
function validateUsername(username) {
    const trimmed = username.trim();
    const regex = /^[a-zA-Z0-9._]{3,30}$/;
    if (!regex.test(trimmed)) {
        return {
            valid: false,
            error: {
                field: 'username',
                code: 'INVALID_USERNAME',
                message: 'Username may only contain letters, numbers, periods and underscores.'
            }
        };
    }
    return { valid: true, value: trimmed };
}
module.exports = { validateUsername };
