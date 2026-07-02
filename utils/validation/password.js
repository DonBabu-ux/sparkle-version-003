// utils/validation/password.js

/**
 * Validates password strength and returns a detailed report.
 * @param {string} password 
 * @returns {Object} Strength evaluation result.
 */
function validatePassword(password) {
    if (!password || typeof password !== 'string') {
        return {
            valid: false,
            error: {
                field: 'password',
                code: 'PASSWORD_REQUIRED',
                message: 'Password is required.'
            }
        };
    }

    const trimmed = password; // Do not trim password to allow spaces as password characters, but measure length
    const checks = {
        minLength: trimmed.length >= 8,
        hasUppercase: /[A-Z]/.test(trimmed),
        hasLowercase: /[a-z]/.test(trimmed),
        hasNumber: /[0-9]/.test(trimmed),
        hasSpecial: /[^A-Za-z0-9]/.test(trimmed)
    };

    const passedCount = Object.values(checks).filter(Boolean).length;
    let strength = 'Weak';
    if (passedCount === 5) {
        strength = 'Very Strong';
    } else if (passedCount === 4) {
        strength = 'Strong';
    } else if (passedCount === 3) {
        strength = 'Medium';
    }

    const valid = checks.minLength && checks.hasUppercase && checks.hasLowercase && checks.hasNumber && checks.hasSpecial;

    if (!valid) {
        const missing = [];
        if (!checks.minLength) missing.push('at least 8 characters');
        if (!checks.hasUppercase) missing.push('an uppercase letter');
        if (!checks.hasLowercase) missing.push('a lowercase letter');
        if (!checks.hasNumber) missing.push('a number');
        if (!checks.hasSpecial) missing.push('a special character');

        return {
            valid: false,
            strength,
            checks,
            error: {
                field: 'password',
                code: 'PASSWORD_TOO_WEAK',
                message: `Password must contain ${missing.join(', ')}.`
            }
        };
    }

    return {
        valid: true,
        strength,
        checks
    };
}

module.exports = { validatePassword };
