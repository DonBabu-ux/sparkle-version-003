// services/notifications/templates/verificationSuccess.js
// Template: Sent when an account is verified (email or badge).

module.exports = function verificationSuccessTemplate({ verificationType = 'email' } = {}) {
    const isEmail = verificationType === 'email';
    return {
        type: 'verification_success',
        icon: 'check-circle',
        priority: 'high',
        category: 'system',
        isOfficial: true,
        title: isEmail ? 'Email verified ✓' : 'Account verified ✓',
        body: isEmail
            ? 'Your email address has been verified. Your account is now fully active.'
            : 'Congratulations! Your Sparkle account has been verified. You now have a verified badge.',
        entities: [],
        actions: [
            { label: isEmail ? 'Go to Profile' : 'View Profile', route: '/profile', style: 'primary' },
        ],
    };
};
