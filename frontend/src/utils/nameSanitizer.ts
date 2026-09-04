// src/utils/nameSanitizer.ts
/**
 * Sanitizes partner/display names by removing UI‑generated trailing "00" suffix.
 */
export const sanitizePartnerName = (name: string | undefined, _username?: string): string => {
  if (typeof name !== 'string') return '';
  // Remove trailing spaces and "00"
  return name.replace(/\s*00$/, '').trim();
};

