/**
 * Shared media-URL liveness probe.
 *
 * A URL counts as alive only when it actually serves media bytes. A 200 with
 * a zero content-length, or a 200 that returns an HTML error page, is dead:
 * that is the "media unavailable" tile from the other side, and neither the
 * upload path (must reject an unverifiable upload) nor the health job (must
 * not flag a healthy rendition) can afford to treat it as success.
 *
 * Used by:
 *  - jobs/media-health.job.js    — the hourly probe of served URLs
 *  - controllers/moments.controller.js — createMoment's pre-persist gate
 */

const DEFAULT_TIMEOUT_MS = 12000;

const ALIVE_STATUSES = new Set([200, 206, 301, 302]);
// Some CDNs answer HEAD with 405/403/501 while serving GET fine; a ranged GET
// answers the same liveness question with one byte of body.
const HEAD_FALLBACK_STATUSES = new Set([403, 405, 501]);

const isHtml = (contentType) =>
    typeof contentType === 'string' && contentType.toLowerCase().includes('text/html');

const fetchTimed = (url, init, timeoutMs) =>
    fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });

// Ranged GET: 206 (or a real 200 with bytes) proves the body exists.
const rangedGet = async (url, timeoutMs) => {
    try {
        const res = await fetchTimed(url, {
            method: 'GET',
            headers: { Range: 'bytes=0-0' },
        }, timeoutMs);
        if (res.status === 206) return { alive: true, status: 206 };
        if (res.status === 200 && res.headers.get('content-length') !== '0' && !isHtml(res.headers.get('content-type'))) {
            return { alive: true, status: 200 };
        }
        return { alive: false, status: res.status, reason: res.status === 200 ? 'zero-length' : 'status' };
    } catch {
        return { alive: false, status: 0, reason: 'network' };
    }
};

const probeOnce = async (url, timeoutMs, verifyBody) => {
    let res;
    try {
        res = await fetchTimed(url, { method: 'HEAD' }, timeoutMs);
    } catch {
        return { alive: false, status: 0, reason: 'network' };
    }

    if (HEAD_FALLBACK_STATUSES.has(res.status)) return rangedGet(url, timeoutMs);
    if (!ALIVE_STATUSES.has(res.status)) return { alive: false, status: res.status, reason: 'status' };

    if (res.headers.get('content-length') === '0') {
        return { alive: false, status: res.status, reason: 'zero-length' };
    }
    if (isHtml(res.headers.get('content-type'))) {
        return { alive: false, status: res.status, reason: 'html' };
    }
    // Chunked responses omit content-length; the ranged GET settles it when
    // the caller needs certainty (upload gate). The hourly job streams up to
    // thousands of URLs, so there the status is trusted and no extra GET
    // is issued.
    if (res.headers.get('content-length') === null && verifyBody) {
        return rangedGet(url, timeoutMs);
    }
    return { alive: true, status: res.status };
};

/**
 * Probe a URL, retrying transient failures.
 *
 * @param {string} url
 * @param {{ attempts?: number, timeoutMs?: number, verifyBody?: boolean }} [opts]
 * @returns {Promise<{ alive: boolean, status: number, reason?: string }>}
 */
const probeMediaUrl = async (url, opts = {}) => {
    const attempts = Math.max(1, opts.attempts || 1);
    const timeoutMs = opts.timeoutMs || DEFAULT_TIMEOUT_MS;
    const verifyBody = opts.verifyBody === true;

    let last = { alive: false, status: 0, reason: 'no-attempt' };
    for (let i = 0; i < attempts; i++) {
        last = await probeOnce(url, timeoutMs, verifyBody);
        if (last.alive) return last;
    }
    return last;
};

module.exports = { probeMediaUrl, ALIVE_STATUSES, DEFAULT_TIMEOUT_MS };