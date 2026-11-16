'use strict';

/**
 * Recency windows for the feed candidate pool, strictest first.
 *
 * The 30-day window is the intended production behaviour: the dashboard
 * promotes fresh posts. But it has no all-time fallback, so when the newest
 * post of ANY kind is older than the window (stale data, seeded dev database,
 * a quiet campus) the pool collapses to the `is_seed` rows alone — and since
 * seed posts carry no media, the dashboard renders text-only cards forever,
 * which reads as "images are broken" even though every stored URL is alive.
 *
 * Widen progressively instead: the strict window wins whenever it yields
 * enough posts, so production ranking is unchanged.
 */
const RECENCY_WINDOWS = ['INTERVAL 30 DAY', 'INTERVAL 365 DAY'];

/** A pool smaller than this is treated as "empty" and triggers widening. */
const MIN_POOL_POSTS = 20;

/**
 * SQL for one recency window. The window literals are a fixed whitelist above
 * (never user input), so interpolating them is safe.
 */
const recencyFilter = (window) =>
    `(p.created_at > NOW() - ${window} OR p.is_seed = 1 OR u.username LIKE 'seed_user_%')`;

/**
 * True when a pool row is a seeded/fixture post. Seed rows always satisfy the
 * recency filter regardless of date, so a raw row count can never tell whether
 * the window actually caught anything real — the gate must ignore seeds.
 */
const isSeedRow = (row) =>
    row.is_seed === 1 || row.is_seed === true || /^seed_user_/.test(row.username || '');

/**
 * Run a feed-source query through the widening ladder, returning the first
 * result set that meets MIN_POOL_POSTS with real (non-seed) posts.
 *
 * Production behaviour is unchanged: while the 30-day window holds at least
 * MIN_POOL_POSTS real posts, that window wins. When seeds dominate (a stale or
 * seeded database whose only recent rows are fixtures) the window widens so
 * real posts — including the ones carrying media — reach the dashboard.
 *
 * @param {(sql: string, params: any[]) => Promise<any[]>} run e.g. safeQuery or pool.query
 * @param {{ select: string, from: string, extraWhere?: string, tail?: string, params?: any[] }} spec
 *   extraWhere — conditions after the recency filter (e.g. scheduled_at, mutes)
 *   tail       — ORDER BY / LIMIT
 */
const queryFeedWindowed = async (run, spec) => {
    const { select, from, extraWhere = '', tail = '', params = [] } = spec;
    const realCount = (rows) => (rows || []).filter(r => !isSeedRow(r)).length;
    for (const window of RECENCY_WINDOWS) {
        const rows = await run(
            `SELECT ${select} FROM ${from} WHERE ${recencyFilter(window)} ${extraWhere} ${tail}`,
            params
        );
        if (realCount(rows) >= MIN_POOL_POSTS) return rows;
    }
    // Last resort: drop the recency clause entirely — a stale but populated
    // feed beats an empty dashboard.
    const rows = await run(
        `SELECT ${select} FROM ${from} WHERE TRUE ${extraWhere} ${tail}`,
        params
    );
    return rows || [];
};

/**
 * True when a feed-source row carries media (directly or via post_media).
 */
const hasMediaPost = (row) =>
    Boolean(row.media_url) || Boolean(row.media_files && row.media_files.length);

/** SQL predicate matching any post that carries media. */
const MEDIA_FILTER = `(p.media_url IS NOT NULL AND p.media_url <> '' OR EXISTS (SELECT 1 FROM post_media pm WHERE pm.post_id = p.post_id))`;

/** Guaranteed media share of the pool: fill up to MIN, cap at LIMIT. */
const MEDIA_TOP_UP_LIMIT = 12;
const MEDIA_TOP_UP_MIN = 5;

/**
 * Fetch the most recent posts that carry media, excluding ids already present.
 *
 * The recency windows order by created_at DESC under a LIMIT. When the newest
 * media posts fall outside that slice (a quiet campus, a seeded or stale
 * database) the dashboard renders text-only cards forever — every stored image
 * stays invisible no matter how healthy its URL is. This tops the pool up with
 * recent media posts so image content always reaches the feed.
 *
 * @param {(sql: string, params: any[]) => Promise<any[]>} run
 * @param {{ select: string, from: string, extraWhere?: string, params?: any[] }} spec
 * @param {Set<string>} excludeIds ids already in the pool
 */
const fetchMediaTopUp = async (run, spec, excludeIds) => {
    const { select, from, extraWhere = '', params = [] } = spec;
    const ids = [...(excludeIds || [])];
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const rows = await run(
        `SELECT ${select} FROM ${from} WHERE ${MEDIA_FILTER} AND p.post_id NOT IN (${placeholders}) ${extraWhere} ORDER BY p.created_at DESC LIMIT ${MEDIA_TOP_UP_LIMIT}`,
        [...params, ...ids]
    );
    return rows || [];
};

/**
 * Merge a media top-up into a pool, filled only until MEDIA_TOP_UP_MIN media
 * posts are present. No-op when the pool already has enough media — production
 * feeds with fresh image posts are untouched.
 *
 * Rows are tagged with `media_guarantee` so the feed scorer can give them a
 * visibility floor: a post added purely to keep the feed visual must not then
 * be buried by the time-decay formula (exp(-0.1·hours) underflows to ~0 for
 * anything months old, which is exactly why media vanished from this feed).
 */
const topUpMedia = (pool, topUp) => {
    const merged = [...pool];
    const seen = new Set(pool.map((p) => p.post_id));
    let mediaCount = pool.filter(hasMediaPost).length;
    for (const row of topUp || []) {
        if (mediaCount >= MEDIA_TOP_UP_MIN || seen.has(row.post_id)) continue;
        row.media_guarantee = true;
        merged.push(row);
        seen.add(row.post_id);
        mediaCount += 1;
    }
    return merged;
};

module.exports = { RECENCY_WINDOWS, MIN_POOL_POSTS, recencyFilter, queryFeedWindowed, hasMediaPost, fetchMediaTopUp, topUpMedia, MEDIA_TOP_UP_LIMIT, MEDIA_TOP_UP_MIN };