import { sanitizePartnerName } from '../nameSanitizer';

describe('sanitizePartnerName', () => {
  it('removes trailing "00" suffix from partner display names', () => {
    expect(sanitizePartnerName('Naty Babu00')).toBe('Naty Babu');
    expect(sanitizePartnerName('John Doe 00')).toBe('John Doe');
  });

  it('sanitizes usernames ending with "00"', () => {
    expect(sanitizePartnerName('User00', 'user00')).toBe('User');
    expect(sanitizePartnerName('username00', 'username00')).toBe('username');
  });

  it('handles names without trailing "00"', () => {
    expect(sanitizePartnerName('Naty Babu')).toBe('Naty Babu');
    expect(sanitizePartnerName('Jane')).toBe('Jane');
  });

  it('handles undefined or non-string inputs safely', () => {
    expect(sanitizePartnerName(undefined)).toBe('');
    expect(sanitizePartnerName(null as any)).toBe('');
  });
});
