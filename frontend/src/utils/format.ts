/**
 * Formats large numbers with K (thousands) and M (millions) suffixes.
 * Example: 1500 -> 1.5k, 1200000 -> 1.2M
 */
export const formatCount = (num: number): string => {
  if (!num || isNaN(num)) return '0';
  
  if (num >= 1000000) {
    const formatted = (num / 1000000).toFixed(1);
    return formatted.endsWith('.0') ? formatted.slice(0, -2) + 'M' : formatted + 'M';
  }
  
  if (num >= 1000) {
    const formatted = (num / 1000).toFixed(1);
    return formatted.endsWith('.0') ? formatted.slice(0, -2) + 'k' : formatted + 'k';
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
