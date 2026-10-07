/**
 * Safe-list for values handed to `<a href>`: absolute http(s) URLs or a
 * site-relative path (single leading '/'). Everything else — `javascript:`,
 * `data:`, `vbscript:`, protocol-relative `//host`, control-character
 * smuggling (`java\nscript:`) — returns `undefined`, rendering an inert
 * anchor. Server-side counterpart: utils/safeUrl.js
 * (UI_AUDIT P0 #20 — stored XSS via attacker-controlled media_url).
 */
export function safeHref(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  return undefined;
}

export default safeHref;
