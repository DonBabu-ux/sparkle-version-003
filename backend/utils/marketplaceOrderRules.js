'use strict';

/**
 * Decide whether a buyer may place an order for a listing snapshot.
 * The caller must lock the listing row before evaluating this so two
 * simultaneous buyers cannot both receive `null`.
 *
 * @returns {string|null} an error code, or null when placement is allowed
 */
function evaluateOrderPlacement({ listing, activeOrder, buyerId }) {
    if (!listing) return 'LISTING_NOT_FOUND';
    if (listing.is_sold) return 'LISTING_SOLD';
    if (listing.status !== 'active') return 'LISTING_NOT_AVAILABLE';
    if (listing.seller_id === buyerId) return 'CANNOT_BUY_OWN';

    if (activeOrder) {
        return activeOrder.buyer_id === buyerId ? 'ORDER_EXISTS' : 'LISTING_NOT_AVAILABLE';
    }

    return null;
}

module.exports = { evaluateOrderPlacement };
