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
