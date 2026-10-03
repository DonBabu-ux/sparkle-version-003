// src/utils/nameSanitizer.ts
/**
 * Partner name passthrough — trims whitespace but no longer strips trailing zeros.
 * The underlying data issue (numeric DEFAULT 0 leaking into display fields)
 * is now fixed at the backend data layer in Message.js getUserConversations.
 */
export const sanitizePartnerName = (name: string | undefined, _username?: string): string => {
  if (typeof name !== 'string') return '';
  return name.trim();
};
