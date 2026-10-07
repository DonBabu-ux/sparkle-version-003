// Safe-list URL check for URLs that end up in an anchor href.
// Server-side counterpart of frontend/src/utils/safeHref.ts (UI_AUDIT P0 #20 —
// stored XSS via attacker-controlled media_url rendered as javascript: href).

const SAFE_SCHEME_RE = /^https?:\/\//i;

/**
 * true when the value is absent, or a URL safe to hand to <a href>:
 * absolute http(s) or a site-relative path (single leading '/').
 * Everything else (javascript:, data:, vbscript:, protocol-relative //,
 * control-character smuggling, non-strings) is rejected.
 */
function isSafeMediaUrl(url) {
    if (url == null || url === '') return true;
    if (typeof url !== 'string') return false;
    const trimmed = url.trim();
    if (!trimmed) return true;
    if (SAFE_SCHEME_RE.test(trimmed)) return true;
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
    return false;
}

module.exports = { isSafeMediaUrl };
