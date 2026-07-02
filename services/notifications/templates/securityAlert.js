// services/notifications/templates/securityAlert.js
// Template: Generic security alert (e.g., suspicious activity, 2FA changes).

module.exports = function securityAlertTemplate({
    alertType = 'suspicious_activity',
    detail = 'We detected unusual activity on your account.',
} = {}) {
    return {
        type: 'security_alert',
        icon: 'alert-triangle',
        priority: 'critical',
        category: 'security',
        isOfficial: true,
        title: '⚠️ Security Alert',
        body: detail,
        entities: [],
        actions: [
            { label: 'Review Activity', route: '/settings?tab=security', style: 'primary' },
            { label: 'Contact Support', route: '/support',               style: 'secondary' },
        ],
    };
};
