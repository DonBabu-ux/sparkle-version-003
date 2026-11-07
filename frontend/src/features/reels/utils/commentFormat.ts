/**
 * Cross-browser date parser that safely handles ISO-8601 strings, MySQL
 * datetime strings ("YYYY-MM-DD HH:MM:SS"), timestamps, and Date objects
 * across Safari, iOS WebKit, Chrome, and Android WebViews.
 */
export function parseCommentDate(iso: unknown): Date | null {
  if (!iso) return null;
  if (iso instanceof Date) return isNaN(iso.getTime()) ? null : iso;
  if (typeof iso === 'number') {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }
  let s = String(iso).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
    s = s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z');
  } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)) {
    s = s + 'Z';
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Clean, standard relative timestamp for comments:
 * - <45s: "just now"
 * - <60m: "5m ago"
 * - <24h: "2h ago"
 * - 1 day: "Yesterday"
 * - <7d: "4d ago"
 * - <30d: "2w ago"
 * - Older: "Nov 5" or "Nov 5, 2025" (never NaNy, never negative)
 */
export function relativeTime(iso: unknown): string {
  const date = parseCommentDate(iso);
  if (!date) return '';

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  // If created just now or slight clock skew (within 45s)
  if (diffSec < 45) return 'just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

