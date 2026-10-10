// services/notifications/templates/featureAnnouncement.js
// Template: Platform feature launches, product updates, community announcements.

module.exports = function featureAnnouncementTemplate({
    featureName = 'New Feature',
    description = 'We shipped something new for you.',
    ctaLabel = 'Try it now',
    ctaRoute = '/',
    badge = null,       // optional: 'NEW' | 'BETA' | string
} = {}) {
    return {
        type: 'feature_announcement',
        icon: 'zap',
        priority: 'high',
        category: 'announcement',
        isOfficial: true,
        title: featureName,
        body: description,
        badge,
        entities: [],
        actions: [
            { label: ctaLabel,     route: ctaRoute, style: 'primary' },
            { label: 'Learn More', route: '/help',  style: 'ghost'   },
        ],
    };
};
