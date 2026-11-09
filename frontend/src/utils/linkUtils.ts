// frontend/src/utils/linkUtils.ts
// URL detection, sanitization, and normalization utilities for Sparkle messaging.

export interface DetectedUrl {
  url: string;
  start: number;
  end: number;
  safe: boolean;
}

// Schemes that are always dangerous
const DANGEROUS_SCHEMES = ['javascript:', 'data:', 'file:', 'vbscript:', 'about:'];

/**
 * Sanitize a URL — returns null for dangerous schemes, otherwise the URL string.
 */
export function sanitizeUrl(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  const lower = trimmed.toLowerCase();
  for (const scheme of DANGEROUS_SCHEMES) {
    if (lower.startsWith(scheme)) return null;
  }
  return trimmed;
}

/**
 * Normalize a URL — ensures it has an http:// prefix if it starts with www. or bare domain.
 */
export function normalizeUrl(url: string): string {
  if (!url) return url;
  const lower = url.toLowerCase();
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
    return 'https://' + url;
  }
  return url;
}

// Regex that finds:
// 1. http:// or https:// URLs
// 2. www. prefixed URLs
// 3. Confident bare domains (e.g. google.com, example.org)
// Excludes email addresses (foo@bar.com) by checking for preceding @
const URL_REGEX = /(?<![a-zA-Z0-9._%-@])(?:(?:https?:\/\/)(?:[^\s<>"'(){}\[\]|\\^`\x00-\x1F]+)|(?:www\.)(?:[^\s<>"'(){}\[\]|\\^`\x00-\x1F]+)|(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.(?:com|org|net|edu|gov|io|co|app|dev|ai|me|info|biz|tv|fm|pm|so|sh|ly|gg|vc|xyz|club|store|online|site|web|tech|space|live|news|wiki|blog|link|press|works|studio|design|media|social|chat|app|cloud|run)(?:\/[^\s<>"'(){}\[\]|\\^`\x00-\x1F]*)?))(?![a-zA-Z0-9._-])/g;

/**
 * Detect URLs in a string, returning an array with position and safety info.
 * Does NOT match email addresses or plain file extensions (.jpg, .mp4 etc).
 */
export function detectUrls(text: string): DetectedUrl[] {
  if (!text || typeof text !== 'string') return [];

  const results: DetectedUrl[] = [];
  URL_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = URL_REGEX.exec(text)) !== null) {
    const raw = match[0];

    // Skip if it looks like a file extension (e.g. ".mp4", ".jpg")
    // These are short strings without slashes after the dot
    if (/^\.[a-z0-9]{1,5}$/i.test(raw)) continue;

    // Skip email pattern — if char before match is @, skip
    const before = match.index > 0 ? text[match.index - 1] : '';
    if (before === '@') continue;

    const sanitized = sanitizeUrl(raw);
    const safe = sanitized !== null;

    results.push({
      url: raw,
      start: match.index,
      end: match.index + raw.length,
      safe,
    });
  }

  URL_REGEX.lastIndex = 0;
  return results;
}
