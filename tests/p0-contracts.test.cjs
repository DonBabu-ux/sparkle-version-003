'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('deposit reconciliation accepts an exact match', () => {
    const { reconcileDepositAmount } = require('../backend/utils/walletReconciliation');
    assert.deepEqual(
        reconcileDepositAmount({
            expectedCents: 150000,
            expectedCurrency: 'KES',
            confirmedCents: 150000,
            confirmedCurrency: 'kes'
        }),
        { ok: true, amountCents: 150000, currency: 'KES' }
    );
});

test('deposit reconciliation rejects amount mismatches without changing money', () => {
    const { reconcileDepositAmount } = require('../backend/utils/walletReconciliation');
    const result = reconcileDepositAmount({
        expectedCents: 150000,
        expectedCurrency: 'KES',
        confirmedCents: 150100,
        confirmedCurrency: 'KES'
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'amount_mismatch');
});

test('deposit reconciliation rejects currency mismatches', () => {
    const { reconcileDepositAmount } = require('../backend/utils/walletReconciliation');
    const result = reconcileDepositAmount({
        expectedCents: 5000,
        expectedCurrency: 'KES',
        confirmedCents: 5000,
        confirmedCurrency: 'NGN'
    });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'currency_mismatch');
});

test('deposit reconciliation rejects fractional, zero, and unsafe amounts', () => {
    const { reconcileDepositAmount } = require('../backend/utils/walletReconciliation');
    for (const confirmedCents of [10.5, 0, -1, Number.MAX_SAFE_INTEGER + 2, NaN]) {
        const result = reconcileDepositAmount({
            expectedCents: 10,
            expectedCurrency: 'KES',
            confirmedCents,
            confirmedCurrency: 'KES'
        });
        assert.equal(result.ok, false, `expected ${confirmedCents} to be rejected`);
        assert.equal(result.reason, 'invalid_confirmed_amount');
    }
});

test('Ads no longer ships mock campaigns or a simulated success path', () => {
    const source = read('frontend/src/pages/Ads.tsx');
    assert.equal(source.includes('MOCK_CAMPAIGNS'), false);
    assert.equal(source.includes('setTimeout'), false);
    assert.match(source, /Campaigns aren't available yet/);
});

test('Marketplace order flow has no mock listing bypass', () => {
    const source = read('frontend/src/pages/MarketplaceOrder.tsx');
    assert.equal(source.includes('Mock Premium Item'), false);
    assert.equal(source.includes("startsWith('l-')"), false);
    assert.equal(source.includes("startsWith('mock-')"), false);
});

test('Support exposes durable plural create and list routes', () => {
    const source = read('backend/routes/api/support.routes.js');
    assert.match(source, /router\.post\('\/tickets'/);
    assert.match(source, /router\.get\('\/tickets'/);
    assert.match(source, /INSERT INTO support_requests/);
    assert.equal(source.includes('soft-failed'), false);
});

test('Wallet webhooks are persisted before processing', () => {
    const controller = read('backend/controllers/wallet.controller.js');
    assert.match(controller, /enqueueWebhookEvent/);
    assert.match(controller, /processWebhookEvent/);
    assert.equal(controller.includes('markWebhookProcessed'), false);
});

test('Withdrawals have durable recovery hooks and exactly-once ledger helpers', () => {
    const service = read('backend/services/wallet.service.js');
    assert.match(service, /processPendingWithdrawals/);
    assert.match(service, /finalizeWithdrawalSuccess/);
    assert.match(service, /failWithdrawalAndRefund/);
    assert.match(service, /providerInitiated/);

    const server = read('backend/server.js');
    assert.match(server, /startWalletRecoveryScheduler/);
});

test('one active order per listing is enforced atomically', () => {
    const { evaluateOrderPlacement } = require('../backend/utils/marketplaceOrderRules');
    const listing = { listing_id: 'l1', seller_id: 'seller', status: 'active', is_sold: 0 };
    assert.equal(evaluateOrderPlacement({ listing, activeOrder: null, buyerId: 'buyer-a' }), null);
    assert.equal(evaluateOrderPlacement({ listing, activeOrder: { buyer_id: 'buyer-b' }, buyerId: 'buyer-a' }), 'LISTING_NOT_AVAILABLE');
    assert.equal(evaluateOrderPlacement({ listing, activeOrder: { buyer_id: 'buyer-a' }, buyerId: 'buyer-a' }), 'ORDER_EXISTS');
    assert.equal(evaluateOrderPlacement({ listing: { ...listing, status: 'pending' }, activeOrder: null, buyerId: 'buyer-a' }), 'LISTING_NOT_AVAILABLE');
    assert.equal(evaluateOrderPlacement({ listing: { ...listing, is_sold: 1 }, activeOrder: null, buyerId: 'buyer-a' }), 'LISTING_SOLD');
    assert.equal(evaluateOrderPlacement({ listing, activeOrder: null, buyerId: 'seller' }), 'CANNOT_BUY_OWN');

    const model = read('backend/models/Marketplace.js');
    assert.match(model, /SELECT \* FROM marketplace_listings WHERE listing_id = \? FOR UPDATE/);
    assert.match(model, /status IN \('pending', 'accepted'\) LIMIT 1/);
});

test('seller listing management is wired to real routes', () => {
    const routes = read('backend/routes/api/marketplace.routes.js');
    assert.match(routes, /router\.get\('\/marketplace\/my-listings'/);
    assert.match(routes, /router\.put\('\/marketplace\/listings\/:id\/sold'/);

    const controller = read('backend/controllers/marketplace.controller.js');
    assert.match(controller, /const getMyListings/);
    assert.match(controller, /req\.params\.id \|\| req\.params\.listingId/);

    const page = read('frontend/src/pages/MyListings.tsx');
    assert.match(page, /\/marketplace\/my-listings/);
    assert.match(page, /api\.put\(`\/marketplace\/listings\/\$\{id\}\/sold`\)/);
    assert.equal(page.includes('/status'), false);
});

test('listing reports are persisted and reach the moderation queue', () => {
    const controller = read('backend/controllers/marketplace.controller.js');
    assert.match(controller, /INSERT INTO listing_reports/);
    const admin = read('backend/controllers/admin.controller.js');
    assert.match(admin, /table: 'listing_reports'/);
    assert.match(admin, /reviewed_by/);

    const page = read('frontend/src/pages/ReportListing.tsx');
    assert.equal(page.includes('Immediate Action Guaranteed'), false);
    assert.equal(page.includes('Automation Engaged'), false);
    assert.match(page, /Submit Report/);
});

test('order lifecycle exposes role-aware actions and dispute handling', () => {
    const routes = read('backend/routes/api/marketplace.routes.js');
    assert.match(routes, /orders\/:orderId\/status/);
    assert.match(routes, /orders\/:orderId\/confirm-meetup/);
    assert.match(routes, /orders\/:orderId\/dispute/);

    const page = read('frontend/src/pages/OrderDetail.tsx');
    for (const action of ['Accept order', 'Reject', 'Cancel', 'I met the other person', 'Complete order', 'Report problem']) {
        assert.ok(page.includes(action), `missing order action: ${action}`);
    }
    assert.match(read('frontend/src/pages/Orders.tsx'), /\/marketplace\/orders\/\$\{order\.order_id\}/);
});

test('marketplace order copy does not imply escrow or buyer protection', () => {
    const page = read('frontend/src/pages/MarketplaceOrder.tsx');
    assert.equal(page.includes('Confirm Purchase'), false);
    assert.equal(page.includes('Sparkle Protection'), false);
    assert.equal(page.includes('secure transaction record'), false);
    assert.match(page, /does not take payment/);
});

test('change password requires re-authentication via a security transaction token', () => {
    const page = read('frontend/src/pages/ChangePassword.tsx');
    assert.match(page, /purpose: 'password_change'/);
    assert.match(page, /\/security\/transaction\/initiate/);
    assert.match(page, /\/security\/transaction\/verify/);
    assert.match(page, /\/security\/password\/change/);
    const controller = read('backend/controllers/security.controller.js');
    assert.match(controller, /purpose === 'password_change'/);
    assert.match(controller, /password_changed/);
});

test('admin sensitive actions require server-verified step-up token', () => {
    const routes = read('backend/routes/api/admin.routes.js');
    assert.match(routes, /requireAdminStepUp/);
    assert.match(routes, /router\.post\('\/actions', requireAdminStepUp/);
    assert.match(routes, /router\.post\('\/announcements', requireAdminStepUp/);
    const middleware = read('backend/middleware/adminStepUp.middleware.js');
    assert.match(middleware, /purpose = 'admin_step_up'/);
    assert.match(middleware, /status = 'consumed'/);
    const controller = read('backend/controllers/security.controller.js');
    assert.match(controller, /'admin_step_up'/);
});

test('Google sign-up is removed from UI and auth routes', () => {
    const page = read('frontend/src/pages/Signup.tsx');
    assert.equal(page.includes('Continue with Google'), false);
    assert.equal(page.includes('googleg_48dp'), false);
    const routes = read('backend/routes/api/auth.routes.js');
    assert.equal(routes.includes('/google/sync'), false);
});

test('account recovery uses CSPRNG codes and hashed verifiers', () => {
    const service = read('backend/services/accountRecovery.service.js');
    assert.match(service, /crypto\.randomInt\(/);
    assert.equal(service.includes('Math.floor(100000 + Math.random() * 900000)'), false);
    assert.match(service, /bcrypt\.hash\(code, 10\)/);
    assert.match(service, /verified_token_hash/);
    assert.match(service, /status = "CONSUMED" WHERE request_id = \? AND status = "VERIFIED"/);
    assert.match(service, /verified_at > DATE_SUB\(NOW\(\), INTERVAL 15 MINUTE\)/);
    const migration = read('backend/migrations/20261013_data_centre_and_recovery.js');
    assert.match(migration, /verified_token_hash VARCHAR\(128\)/);
});

test('confessions hide author identity from public APIs', () => {
    const model = read('backend/models/Confession.js');
    assert.match(model, /toPublic/);
    assert.match(model, /const \{ user_id, \.\.\.publicRow \} = row/);
    const controller = read('backend/controllers/confession.controller.js');
    assert.match(controller, /Confession\.findById\(req\.params\.id\)/);
});

test('login/session tokens are rotated and revoked on logout', () => {
    const service = read('backend/services/auth.service.js');
    assert.match(service, /expiresIn: '15m'/);
    assert.match(service, /expiresAt\.setDate\(expiresAt\.getDate\(\) \+ 30\)/);
    assert.match(service, /DELETE FROM refresh_tokens WHERE token = \?/);
    assert.match(service, /account_status/);
    const controller = read('backend/controllers/auth.controller.js');
    assert.match(controller, /DELETE FROM refresh_tokens WHERE user_id = \?/);
    assert.match(controller, /httpOnly: true/);
    assert.match(controller, /sameSite: 'strict'/);
    const page = read('frontend/src/api/api.ts');
    assert.match(page, /useUserStore\.getState\(\)\.token/);
    assert.match(page, /localStorage\.getItem\('sparkle_device_id'\)/);
});

test('wallet deposit verification is owner-scoped and uses safe-integer minor units', () => {
    const controller = read('backend/controllers/wallet.controller.js');
    assert.match(controller, /processDepositConfirmation\(reference, userId\)/);
    assert.match(controller, /cents !== Math\.round\(cents\)/);
    assert.match(controller, /Number\.MAX_SAFE_INTEGER/);
    const service = read('backend/services/wallet.service.js');
    assert.match(service, /async processDepositConfirmation\(reference, userId\)/);
    assert.match(service, /status: 'not_authorized'/);
});

test('Sell item categories are all valid on the server', () => {
    const sellItem = read('frontend/src/pages/SellItem.tsx');
    const model = read('backend/models/Marketplace.js');
    // Extract category IDs from the Sell Item CATEGORIES array
    const categoryIds = [];
    const idMatches = sellItem.matchAll(/\{ id: '([^']+)'/g);
    for (const m of idMatches) categoryIds.push(m[1]);
    assert.ok(categoryIds.length > 0, 'Sell Item must define categories');
    for (const id of categoryIds) {
        assert.ok(model.includes(`'${id}'`), `Sell item category '${id}' must be valid on the server`);
    }
});

test('marketplace order lifecycle routes exist', () => {
    const routes = read('backend/routes/api/marketplace.routes.js');
    assert.match(routes, /orders\/:orderId\/status/);
    assert.match(routes, /orders\/:orderId\/confirm-meetup/);
    assert.match(routes, /orders\/:orderId\/dispute/);
});

test('marketplace seller profile route exists', () => {
    const routes = read('backend/routes/api/marketplace.routes.js');
    assert.match(routes, /sellers\/:id/);
    const model = read('backend/models/Marketplace.js');
    assert.match(model, /static async getSellerProfile/);
});

test('marketplace report route persists to listing_reports', () => {
    const controller = read('backend/controllers/marketplace.controller.js');
    assert.match(controller, /INSERT INTO listing_reports/);
    const routes = read('backend/routes/api/marketplace.routes.js');
    assert.match(routes, /listings\/:id\/report/);
});

test('marketplace inbox/conversations route exists', () => {
    const routes = read('backend/routes/api/marketplace.routes.js');
    assert.match(routes, /marketplace\/chats/);
    const model = read('backend/models/Marketplace.js');
    assert.match(model, /getUserChats/);
});

test('user blocks table and middleware exist', () => {
    const model = read('backend/models/Marketplace.js');
    assert.match(model, /marketplace_user_blocks/);
    const controller = read('backend/controllers/marketplace.controller.js');
    assert.match(controller, /marketplace_user_blocks/);
});

test('Release workflow runs the test gate before building', () => {
    const workflow = read('.github/workflows/release.yml');
    const testStep = workflow.indexOf('npm test');
    const buildStep = workflow.indexOf('Build web bundle');
    assert.notEqual(testStep, -1, 'release workflow must run npm test');
    assert.notEqual(buildStep, -1, 'release workflow must build the web bundle');
    assert.ok(testStep < buildStep, 'tests must run before the release build');
});
