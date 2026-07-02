// services/notifications/templates/loginAlert.js
// Template: Sent when the user logs in from a new device or location.

module.exports = function loginAlertTemplate({ device = 'Unknown device', location = 'Unknown location', time } = {}) {
    const timestamp = time || new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
    return {
        type: 'login_alert',
        icon: 'shield',
        priority: 'critical',
        category: 'security',
        isOfficial: true,
        title: 'New login detected',
        body: `Your Sparkle account was accessed from ${device} in ${location} at ${timestamp}. If this wasn't you, secure your account immediately.`,
        entities: [],
        actions: [
            { label: 'Secure Account', route: '/settings?tab=security', style: 'primary' },
            { label: 'This was me',    route: null,                     style: 'ghost'   },
        ],
    };
};
