import { describe, it, expect } from 'vitest';
import { sanitizePartnerName } from '../nameSanitizer';

describe('sanitizePartnerName', () => {
  it('preserves names as-is without stripping trailing zeros', () => {
    expect(sanitizePartnerName('Naty Babu00')).toBe('Naty Babu00');
    expect(sanitizePartnerName('Naty Babu0000')).toBe('Naty Babu0000');
    expect(sanitizePartnerName('John Doe 00')).toBe('John Doe 00');
    expect(sanitizePartnerName('User00')).toBe('User00');
  });

  it('handles standard names properly', () => {
    expect(sanitizePartnerName('Naty Babu')).toBe('Naty Babu');
    expect(sanitizePartnerName('Jane')).toBe('Jane');
  });

  it('handles undefined or non-string inputs safely', () => {
    expect(sanitizePartnerName(undefined)).toBe('');
    expect(sanitizePartnerName(null as any)).toBe('');
  });
});

