// services/notifications/templates/passwordChanged.js
// Template: Sent after the user successfully changes their password.

module.exports = function passwordChangedTemplate({ time } = {}) {
    const timestamp = time || new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    return {
        type: 'password_changed',
        icon: 'lock',
        priority: 'critical',
        category: 'security',
        isOfficial: true,
        title: 'Password changed',
        body: `Your Sparkle password was changed at ${timestamp}. If you didn't make this change, secure your account right away.`,
        entities: [],
        actions: [
            { label: 'Secure Account', route: '/settings?tab=security', style: 'primary' },
        ],
    };
};
