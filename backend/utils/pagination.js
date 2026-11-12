/**
 * Clamp a query param into a bounded, non-negative integer.
 *
 * req.query is unvalidated user input. Every value read from it has to be
 * defended in three directions or it produces a query the database rejects or
 * that costs it unnecessary work:
 *
 *   non-numeric ("abc", "", undefined) -> the fallback, never NaN, because NaN
 *     propagates into OFFSET and errors
 *   negative -> the floor, because `LIMIT 20 OFFSET -10` is a SQL syntax error
 *     and turns a bad request into a 500 instead of a 400
 *   absurdly large -> the ceiling, so an unbounded OFFSET cannot be used to make
 *     the database count rows it will never return
 *
 * These were previously inline at each call site, which is why the same gap
 * existed in seven controllers at once: campus, groups, location, notification,
 * post, roomChannels and user all read a raw parseInt with no bound, and two of
 * them (roomChannels, user) allowed a negative offset into a live query.
 */

/**
 * Clamp any query param to an integer within [min, max], or `fallback` if it
 * is not a number at all.
 */
function clampInt(value, { min = 0, max = Number.MAX_SAFE_INTEGER, fallback = 0 } = {}) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(parsed, min), max);
}

/**
 * A 1-based page number: pages start at 1, so the floor is 1 rather than 0 and
 * an absurd page is capped rather than multiplied into a huge offset.
 */
function clampPage(value, { max = 1000, fallback = 1 } = {}) {
    return clampInt(value, { min: 1, max, fallback });
}

/**
 * Rows per response.
 *
 * A non-positive value is treated as "not specified" and returns the fallback,
 * which is what the `parseInt(req.query.limit) || 20` idiom did before. Simply
 * clamping 0 up to 1 would instead send `LIMIT 1`, quietly returning one row
 * where the caller asked for none, so the falsy case is handled before the
 * clamp.
 */
function clampLimit(value, { max = 50, fallback = 20 } = {}) {
    const parsed = parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, max);
}

/** A row offset: 0-based, and never negative. */
function clampOffset(value, { max = Number.MAX_SAFE_INTEGER, fallback = 0 } = {}) {
    return clampInt(value, { min: 0, max, fallback });
}

module.exports = { clampInt, clampPage, clampLimit, clampOffset };
