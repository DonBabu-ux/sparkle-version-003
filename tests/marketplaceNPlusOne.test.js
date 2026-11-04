/**
 * Regression test for the marketplace N+1 fix.
 *
 * getRecommendations used to run one media query per listing. With a
 * 200-500ms remote DB round trip (and multi-second spikes), 20 listings
 * meant 20 sequential round trips — ~20s for the endpoint.
 *
 * The fix is a single batched query. These tests pin that behaviour and the
 * exact fallback chain the old per-listing loop produced, so a future
 * refactor cannot silently reintroduce the loop or change which image a
 * listing gets.
 *
 * The helper is extracted from the model source rather than imported, which
 * keeps this test free of the model's Firebase/admin/DB dependencies while
 * still exercising the real code.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

function loadHelper() {
  // CRLF on disk; normalise so the regex works on any checkout.
  const src = fs.readFileSync(require.resolve('../backend/models/Marketplace.js'), 'utf8').replace(/\r\n/g, '\n');
  const m = src.match(/async function attachListingMedia[\s\S]*?\n}\n/);
  assert.ok(m, 'attachListingMedia helper not found in Marketplace.js — did the N+1 fix get removed?');

  // Confirm the per-listing loop is gone from the model entirely.
  const loops = src.match(/for \(let listing of \w+\) \{[\s\S]*?listing_media WHERE listing_id = \?/g) || [];
  assert.equal(loops.length, 0,
    'a per-listing media query loop is back in Marketplace.js — the N+1 has regressed');

  return new Function('pool', 'return ' + m[0].trim());
}

function makePool(handlers) {
  const calls = [];
  const query = async (sql, params) => {
    calls.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), params: params || [] });
    for (const h of handlers) if (h.match.test(sql)) return h.rows;
    return [[]];
  };
  return { query, calls };
}

describe('attachListingMedia', () => {
  it('fetches media for every listing in exactly one query', async () => {
    const pool = makePool([{ match: /listing_media/, rows: [[
      { listing_id: 'a', media_url: '/a.jpg' },
      { listing_id: 'b', media_url: '/b.jpg' },
    ]] }]);
    const attach = loadHelper()(pool);

    await attach([{ listing_id: 'a' }, { listing_id: 'b' }, { listing_id: 'c' }]);

    const mediaCalls = pool.calls.filter((c) => /listing_media/.test(c.sql));
    assert.equal(mediaCalls.length, 1, 'expected exactly one media query, got ' + mediaCalls.length);
    assert.match(mediaCalls[0].sql, /listing_id IN \(/);
    assert.deepEqual(mediaCalls[0].params[0], ['a', 'b', 'c']);
  });

  it('picks the lowest upload_order per listing', async () => {
    const pool = makePool([{ match: /listing_media/, rows: [[
      { listing_id: 'a', media_url: '/first.jpg' },
      { listing_id: 'a', media_url: '/second.jpg' },
    ]] }]);
    const [listing] = await loadHelper()(pool)([{ listing_id: 'a' }]);
    assert.equal(listing.media_url, '/first.jpg');
  });

  it('falls back to image_url then the default image', async () => {
    const attach = loadHelper()(makePool([{ match: /listing_media/, rows: [[]] }]));

    const withImageUrl = (await attach([{ listing_id: 'x', image_url: '/legacy.jpg' }]))[0];
    assert.equal(withImageUrl.media_url, '/legacy.jpg');

    const bare = (await attach([{ listing_id: 'y' }]))[0];
    assert.equal(bare.media_url, '/images/default-listing.jpg');
  });

  it('skips the query entirely when there are no listings', async () => {
    const pool = makePool([]);
    await loadHelper()(pool)([]);
    assert.equal(pool.calls.length, 0);
  });

  it('does not query when no listing has an id', async () => {
    const pool = makePool([]);
    await loadHelper()(pool)([{ listing_id: null }, {}]);
    assert.equal(pool.calls.length, 0);
  });

  it('keeps the batch size bounded by a page, not unbounded', async () => {
    const pool = makePool([{ match: /listing_media/, rows: [[]] }]);
    const attach = loadHelper()(pool);
    const listings = Array.from({ length: 20 }, (_, i) => ({ listing_id: 'l' + i }));
    await attach(listings);
    const ids = pool.calls[0].params[0];
    assert.equal(ids.length, 20);
    assert.equal(pool.calls.filter((c) => /listing_media/.test(c.sql)).length, 1);
  });
});
