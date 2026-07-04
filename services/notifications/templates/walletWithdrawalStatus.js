// services/notifications/templates/walletWithdrawalStatus.js
// Template: Sent on withdrawal request and on status changes (Processing, Completed, Failed).

/**
 * @param {object} opts
 * @param {number} opts.amountCents   Integer cents
 * @param {string} opts.currency      e.g. 'KES'
 * @param {string} opts.status        'Pending' | 'Processing' | 'Completed' | 'Failed' | 'Cancelled'
 * @param {string} opts.reference     Withdrawal ID or reference
 */
module.exports = function walletWithdrawalStatusTemplate({ amountCents = 0, currency = 'KES', status = 'Pending', reference = '' } = {}) {
    const formatted = `${currency} ${(amountCents / 100).toFixed(2)}`;

    const titles = {
        Pending:    '🏦 Withdrawal Requested',
        Processing: '⏳ Withdrawal Processing',
        Completed:  '✅ Withdrawal Completed',
        Failed:     '❌ Withdrawal Failed',
        Cancelled:  '🚫 Withdrawal Cancelled',
    };

    const bodies = {
        Pending:    `Your withdrawal of ${formatted} is being processed. Funds will arrive within 1–2 business days.`,
        Processing: `Your withdrawal of ${formatted} is on its way.`,
        Completed:  `${formatted} has been sent to your account successfully.`,
        Failed:     `Your withdrawal of ${formatted} failed. Your balance has been restored. Please try again or contact support.`,
        Cancelled:  `Your withdrawal of ${formatted} was cancelled. Your balance has been restored.`,
    };

    return {
        type: 'wallet_withdrawal',
        icon: 'bank',
        priority: status === 'Failed' ? 'high' : 'normal',
        category: 'wallet',
        isOfficial: true,
        title: titles[status] || '🏦 Withdrawal Update',
        body: bodies[status] || `Withdrawal status: ${status}`,
        entities: [],
        actions: [
            { label: 'Track Status', route: '/professional-dashboard', style: 'primary' },
            { label: 'Support',      route: '/support',                style: 'ghost' },
        ],
    };
};
