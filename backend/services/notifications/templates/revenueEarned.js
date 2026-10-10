// services/notifications/templates/revenueEarned.js
// Template: Sent when a creator earns revenue (ads, boosts, tips, creator payments, etc.)

/**
 * @param {object} opts
 * @param {number} opts.amountCents   Integer cents
 * @param {string} opts.currency      e.g. 'KES'
 * @param {string} opts.source        'AdRevenue' | 'Tip' | 'BoostSpend' | 'CreatorPayment' | 'Subscription'
 * @param {string} [opts.period]      Optional period label, e.g. 'today', 'this week'
 */
module.exports = function revenueEarnedTemplate({ amountCents = 0, currency = 'KES', source = 'Revenue', period = 'today' } = {}) {
    const formatted = `${currency} ${(amountCents / 100).toFixed(2)}`;

    const emojis = {
        AdRevenue:      '📢',
        Tip:            '⭐',
        BoostSpend:     '⚡',
        CreatorPayment: '💎',
        Subscription:   '🔔',
        Revenue:        '🎉',
    };

    const sourceLabels = {
        AdRevenue:      'ad revenue',
        Tip:            'a tip from a fan',
        BoostSpend:     'a content boost',
        CreatorPayment: 'a creator payment',
        Subscription:   'a subscription',
        Revenue:        'earnings',
    };

    const emoji = emojis[source] || '🎉';
    const label = sourceLabels[source] || 'earnings';

    return {
        type: 'revenue_earned',
        icon: 'trending-up',
        priority: 'normal',
        category: 'wallet',
        isOfficial: true,
        title: `${emoji} You earned ${formatted} ${period}`,
        body: `${formatted} from ${label} has been added to your Sparkle Wallet.`,
        entities: [],
        actions: [
            { label: 'View Analytics', route: '/analytics',              style: 'primary' },
            { label: 'View Wallet',    route: '/professional-dashboard', style: 'secondary' },
        ],
    };
};
