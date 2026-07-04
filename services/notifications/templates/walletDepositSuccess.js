// services/notifications/templates/walletDepositSuccess.js
// Template: Sent when a Paystack deposit is confirmed and wallet is credited.

/**
 * @param {object} opts
 * @param {number} opts.amountCents   Integer cents, e.g. 50000
 * @param {string} opts.currency      e.g. 'KES'
 * @param {string} opts.reference     Paystack reference
 */
module.exports = function walletDepositSuccessTemplate({ amountCents = 0, currency = 'KES', reference = '' } = {}) {
    const formatted = `${currency} ${(amountCents / 100).toFixed(2)}`;
    return {
        type: 'wallet_deposit',
        icon: 'wallet',
        priority: 'high',
        category: 'wallet',
        isOfficial: true,
        title: `💰 Deposit Successful`,
        body: `${formatted} has been added to your Sparkle Wallet.${reference ? ` Ref: ${reference}` : ''}`,
        entities: [],
        actions: [
            { label: 'View Wallet',    route: '/professional-dashboard', style: 'primary' },
            { label: 'View Analytics', route: '/analytics',              style: 'secondary' },
        ],
    };
};
