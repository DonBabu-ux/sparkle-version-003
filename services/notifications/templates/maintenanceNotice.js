// services/notifications/templates/maintenanceNotice.js
// Template: Scheduled or emergency maintenance windows.

module.exports = function maintenanceNoticeTemplate({
    startTime = '',
    duration = '30 minutes',
    affectedServices = 'all services',
    isEmergency = false,
} = {}) {
    return {
        type: 'maintenance_notice',
        icon: 'tool',
        priority: isEmergency ? 'high' : 'normal',
        category: 'system',
        isOfficial: true,
        title: isEmergency ? '🔧 Emergency Maintenance' : '🔧 Scheduled Maintenance',
        body: startTime
            ? `Sparkle will be down for maintenance on ${startTime} for approximately ${duration}. Affected: ${affectedServices}.`
            : `Sparkle maintenance is in progress (est. ${duration}). Affected: ${affectedServices}. We'll be back soon.`,
        entities: [],
        actions: [
            { label: 'Learn More', route: '/status', style: 'ghost' },
        ],
    };
};
