// tests/marketplace-handlers.test.js
// Marketplace handler behavior: listing reads, create/update/delete ownership
// gates, and the contact-seller block rules. Real handlers with a fake
// pool.query and stubbed model singletons.
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-market';

const pool = require('../backend/config/database');
const Marketplace = require('../backend/models/Marketplace');
const marketplace = require('../backend/controllers/marketplace.controller');

const mockRes = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.body = payload; return this; },
});

const installFakePool = (impl) => {
  const original = pool.query;
  pool.query = async (sql, params = []) => impl(String(sql).replace(/\s+/g, ' ').trim(), params);
  return { restore: () => { pool.query = original; } };
};

const reqFor = (over = {}) => ({
  body: {}, params: {}, query: {}, headers: {}, cookies: {}, files: [],
  user: { user_id: 'seller-1', id: 'seller-1', username: 'seller', name: 'Seller', campus: 'main' },
  ...over,
});

const asHandler = (fn) => (Array.isArray(fn) ? fn[fn.length - 1] : fn);

const listing = (over = {}) => ({
  listing_id: 'L1',
  seller_id: 'seller-1',
  title: 'Desk lamp',
  price: 1500,
  media: [],
  ...over,
});

describe('marketplace reads', () => {
  let fake;
  afterEach(() => fake?.restore());

  beforeEach(() => {
    Marketplace.getListings = async () => ({ listings: [listing()], pagination: { page: 1, total: 1 } });
    Marketplace.getListingWithMedia = async () => listing();
  });

  it('forwards the model listing page', async () => {
    const res = mockRes();
    await marketplace.getListings(reqFor({ query: { category: 'furniture' } }), res);

    assert.equal(res.body.success, true);
    assert.equal(res.body.listings.length, 1);
    assert.equal(res.body.pagination.total, 1);
  });

  it('defaults the feed to a global campus', async () => {
    let seenFilters = null;
    Marketplace.getListings = async (filters) => { seenFilters = filters; return { listings: [], pagination: {} }; };

    const res = mockRes();
    await marketplace.getListings(reqFor({ query: {} }), res);

    assert.equal(seenFilters.affiliation, 'all');
    assert.equal(seenFilters.currentUserId, 'seller-1');
  });

  it('404s an unknown listing', async () => {
    Marketplace.getListingWithMedia = async () => null;
    const res = mockRes();
    await marketplace.getListingById(reqFor({ params: { id: 'ghost' } }), res);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, 'Listing not found');
  });

  it('500s with a fixed message when the model throws', async () => {
    Marketplace.getListings = async () => { throw new Error("Table 'marketplace_listings' doesn't exist"); };
    const res = mockRes();
    await marketplace.getListings(reqFor(), res);
    assert.equal(res.statusCode, 500);
    assert.ok(!JSON.stringify(res.body).includes('marketplace_listings'), 'no schema in the body');
  });
});

describe('marketplace writes', () => {
  let fake;
  afterEach(() => fake?.restore());

  beforeEach(() => {
    Marketplace.createListing = async (data) => { created = data; return 'L-new'; };
    Marketplace.getUsersAlertedForSeller = async () => [];
    Marketplace.getListingById = async () => listing();
    Marketplace.updateListing = async (id, updates) => { updated = { id, updates }; return { affectedRows: 1 }; };
    Marketplace.deleteListing = async (id, userId) => { deleted = { id, userId }; return { affectedRows: 1 }; };
    Marketplace.getOrCreateChat = async () => 'chat-1';
    created = null; updated = null; deleted = null;
    fake = installFakePool(async () => [[], []]);
  });

  it('creates a listing and registers the media', async () => {
    const handler = asHandler(marketplace.createListing);
    const res = mockRes();

    await handler(
      reqFor({
        body: { title: 'Desk lamp', price: '1500', location: 'Nairobi' },
        files: [{ path: 'https://cdn/x.jpg', filename: 'x', size: 1234, originalname: 'x.jpg', mimetype: 'image/jpeg' }],
      }),
      res
    );

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.listing_id, 'L-new');
    assert.equal(created.title, 'Desk lamp');
    assert.equal(created.seller_id, 'seller-1');
    // Nairobi geocodes from the preset table rather than failing.
    assert.deepEqual([created.latitude, created.longitude], [-1.2921, 36.8219]);
    assert.equal(created.media.length, 1);
  });

  it('401s a create without a session', async () => {
    const handler = asHandler(marketplace.createListing);
    const res = mockRes();
    await handler(reqFor({ user: undefined, body: { title: 'x' } }), res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, 'Unauthorized');
  });

  it('404s an update for a missing listing', async () => {
    Marketplace.getListingById = async () => null;
    const handler = asHandler(marketplace.updateListing);
    const res = mockRes();
    await handler(reqFor({ params: { id: 'L1' }, body: { title: 'x' } }), res);
    assert.equal(res.statusCode, 404);
  });

  it('403s an update from a non-owner', async () => {
    Marketplace.getListingById = async () => listing({ seller_id: 'someone-else' });
    const handler = asHandler(marketplace.updateListing);
    const res = mockRes();
    await handler(reqFor({ params: { id: 'L1' }, body: { title: 'x' } }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.message, 'Not your listing');
  });

  it('drops undefined fields from an update', async () => {
    const handler = asHandler(marketplace.updateListing);
    const res = mockRes();
    await handler(reqFor({ params: { id: 'L1' }, body: { title: 'New title' } }), res);

    assert.equal(res.statusCode, 200);
    assert.deepEqual(Object.keys(updated.updates).sort(), ['media', 'title']);
  });

  it('401s a delete without a session', async () => {
    const res = mockRes();
    await marketplace.deleteListing(reqFor({ user: undefined, params: { id: 'L1' } }), res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.message, 'Authentication required');
  });

  it('deletes as the owner', async () => {
    const res = mockRes();
    await marketplace.deleteListing(reqFor({ params: { id: 'L1' } }), res);
    assert.equal(res.body.success, true);
    assert.deepEqual(deleted, { id: 'L1', userId: 'seller-1' });
  });
});

describe('marketplace contact rules', () => {
  let fake;
  afterEach(() => fake?.restore());

  beforeEach(() => {
    fake = installFakePool(async () => [[], []]);
  });

  it('400s contacting yourself', async () => {
    const handler = asHandler(marketplace.contactSeller);
    const res = mockRes();
    await handler(reqFor({ body: { sellerId: 'seller-1', message: 'hi' } }), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.message, 'Cannot contact yourself');
  });

  it('403s when a block exists in either direction', async () => {
    fake.restore();
    fake = installFakePool(async (sql) => {
      if (sql.includes('marketplace_user_blocks')) return [[{ id: 'b1' }]];
      return [[], []];
    });

    const handler = asHandler(marketplace.contactSeller);
    const res = mockRes();
    await handler(reqFor({ body: { sellerId: 'seller-2', message: 'hi' } }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.message, 'You cannot contact this user.');
  });

  it('opens a conversation thread when no block exists', async () => {
    const seen = [];
    fake.restore();
    fake = installFakePool(async (sql, params) => {
      seen.push({ sql, params });
      if (sql.includes('marketplace_user_blocks')) return [[]];
      if (sql.includes('FROM marketplace_conversations')) return [[]];
      if (sql.includes('FROM marketplace_messages')) return [[]];
      return [[], []];
    });

    const handler = asHandler(marketplace.contactSeller);
    const res = mockRes();
    await handler(reqFor({ body: { sellerId: 'seller-2', message: 'is this available?' } }), res);

    const insert = seen.find((s) => s.sql.startsWith('INSERT INTO marketplace_conversations'));
    assert.ok(insert, 'a conversation row is created');
    assert.equal(insert.params[1], 'seller-1');
    assert.equal(insert.params[2], 'seller-2');
  });
});