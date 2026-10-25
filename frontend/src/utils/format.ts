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
 * Compact, human-readable timestamp for chat list previews (WhatsApp-style).
 * Under 24h → clock time | yesterday → "Yesterday" | this week → weekday
 * | older → "18 Oct" ("18 Oct 26" when from a previous year)
 */
export const formatChatTimestamp = (dateInput?: string | Date): string => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime()) || date.getTime() <= 0) return '';

  const now = new Date();

  const today  = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000);

  // Yesterday and older: day-based labels, never an hour counter
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
  if (diffDays >= 7) {
    const sameYear = date.getFullYear() === now.getFullYear();
    const base = date.toLocaleDateString([], { day: 'numeric', month: 'short' });
    return sameYear ? base : `${base} ${String(date.getFullYear()).slice(-2)}`;
  }

  // Today (or a skewed-future timestamp): show the clock time
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

/**
 * Full date label for in-chat date separators (WhatsApp-style).
 * Today | Yesterday | weekday | "18 October 26"
 */
export const formatMessageGroupDate = (dateInput?: string | Date): string => {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime()) || date.getTime() <= 0) return '';

  const now     = new Date();
  const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay  = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return date.toLocaleDateString([], { weekday: 'long' });
  const base = date.toLocaleDateString([], { day: 'numeric', month: 'long' });
  return date.getFullYear() === now.getFullYear() ? base : `${base} ${String(date.getFullYear()).slice(-2)}`;
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
