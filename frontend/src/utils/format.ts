/**
 * Formats large numbers with k (thousands) and m (millions) suffixes.
 * Example: 1500 -> 1.5k, 2000000 -> 2m, 1200000 -> 1.2m
 */
export const formatCount = (num: number): string => {
  if (!num || isNaN(num)) return '0';

  if (num >= 1000000) {
    const v = num / 1000000;
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + 'm';
  }

  if (num >= 1000) {
    const v = num / 1000;
    return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)) + 'k';
  }

  return num.toString();
};

export const timeAgo = (dateInput?: string | Date): string => {
  if (!dateInput) return 'an hour ago';
  
  const date = new Date(dateInput);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `about ${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `about ${hours} hour${hours !== 1 ? 's' : ''} ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 30) return `about ${days} day${days !== 1 ? 's' : ''} ago`;
  
  const months = Math.floor(days / 30);
  if (months < 12) return `about ${months} month${months !== 1 ? 's' : ''} ago`;
  
  const years = Math.floor(days / 365);
  return `about ${years} year${years !== 1 ? 's' : ''} ago`;
};

/**
 * Compact, human-readable timestamp for chat list previews.
 * Under 1 min → "Just now" | mins → "2 mins" | hrs → "2 hrs"
 * Yesterday → "Yesterday" | this week → weekday | older → date
 */
export const formatChatTimestamp = (dateInput?: string | Date): string => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr  = Math.floor(diffMin / 60);

  if (diffSec < 60)  return 'Just now';
  if (diffMin === 1) return '1 min';
  if (diffMin < 60)  return `${diffMin} mins`;
  if (diffHr  === 1) return '1 hr';
  if (diffHr  < 24)  return `${diffHr} hrs`;

  const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay  = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000);

  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)   return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/**
 * Full date label for in-chat date separators.
 * Today | Yesterday | weekday | Month DD, YYYY
 */
export const formatMessageGroupDate = (dateInput?: string | Date): string => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '';

  const now     = new Date();
  const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay  = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7)   return date.toLocaleDateString([], { weekday: 'long' });
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' };
  if (diffDays > 365) opts.year = 'numeric';
  return date.toLocaleDateString([], opts);
};

/** Returns true when two date inputs fall on the same calendar day. */
export const isSameCalendarDay = (a?: string | Date, b?: string | Date): boolean => {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth()    === db.getMonth()    &&
    da.getDate()     === db.getDate()
  );
};

/**
 * WhatsApp-style last-seen label for private chat headers.
 * Always produces a stable absolute timestamp — never uses relative counters
 * like "2 mins ago" that flicker or cause timezone confusion.
 *
 * Returns the part after "last seen ", e.g.:
 *   "today at 12:45 AM"
 *   "yesterday at 10:50 PM"
 *   "Thu at 12:00 AM"
 *   "May 10 at 9:42 PM"
 */
export const formatLastSeenChat = (dateInput?: string | Date): string => {
  if (!dateInput) return 'a while ago';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return 'a while ago';

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const now      = new Date();
  const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay   = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000);

  if (diffDays === 0) return `today at ${timeStr}`;
  if (diffDays === 1) return `yesterday at ${timeStr}`;
  if (diffDays  < 7)  return `${date.toLocaleDateString([], { weekday: 'short' })} at ${timeStr}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${timeStr}`;
};
