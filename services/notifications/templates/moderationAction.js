// services/notifications/templates/moderationAction.js
// Template: Content removals, warnings, suspensions, account holds.

module.exports = function moderationActionTemplate({
    actionType = 'content_removed',  // 'content_removed' | 'warning' | 'suspension' | 'appeal_accepted' | 'appeal_rejected'
    reason = 'Violation of community guidelines',
    appealRoute = '/support',
} = {}) {
    const titleMap = {
        content_removed:  '⚠️ Content Removed',
        warning:          '⚠️ Account Warning',
        suspension:       '🚫 Account Suspended',
        appeal_accepted:  '✅ Appeal Accepted',
        appeal_rejected:  '❌ Appeal Rejected',
    };

    const bodyMap = {
        content_removed: `Some of your content was removed. Reason: ${reason}.`,
        warning: `Your account has received a warning. Reason: ${reason}. Repeated violations may result in suspension.`,
        suspension: `Your account has been temporarily suspended. Reason: ${reason}.`,
        appeal_accepted: `Good news — your appeal has been accepted. Your content has been restored.`,
        appeal_rejected: `Your appeal was reviewed and rejected. Reason: ${reason}.`,
    };

    return {
        type: `moderation_${actionType}`,
        icon: 'shield-off',
        priority: actionType === 'suspension' ? 'critical' : 'high',
        category: 'system',
        isOfficial: true,
        title: titleMap[actionType] || '⚠️ Moderation Notice',
        body: bodyMap[actionType] || reason,
        entities: [],
        actions: [
            { label: 'Review Policy', route: '/help/community-guidelines', style: 'ghost' },
            { label: 'Submit Appeal', route: appealRoute,                  style: 'secondary' },
        ],
    };
};
