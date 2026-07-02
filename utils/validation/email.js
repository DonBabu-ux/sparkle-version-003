// utils/validation/email.js
/**
 * Validate an email address.
 * Normalizes by trimming and lower‑casing.
 */
function validateEmail(email) {
    const trimmed = email.trim().toLowerCase();
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(trimmed)) {
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
module.exports = { validateEmail };
