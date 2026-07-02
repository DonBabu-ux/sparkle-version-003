// services/notifications/templates/welcome.js
// Template: Welcome message sent on first account bootstrap.

module.exports = function welcomeTemplate({ userName = 'there' } = {}) {
    return {
        type: 'welcome',
        icon: 'party',
        priority: 'low',
        category: 'onboarding',
        isOfficial: true,
        title: `Welcome to Sparkle ✨`,
        body: `Hey ${userName}! We're excited to have you here. Start exploring moments, connect with creators, and share your first spark.`,
        entities: [],
        actions: [
            { label: 'Complete Profile', route: '/settings?tab=profile', style: 'primary' },
            { label: 'Discover Moments', route: '/moments',             style: 'secondary' },
            { label: 'Find People',      route: '/connect',             style: 'secondary' },
            { label: 'Help Center',      route: '/help',                style: 'ghost' },
        ],
    };
};
