import { describe, it, expect } from 'vitest';
import { isWatermarkVisible } from '../watermark';

describe('isWatermarkVisible', () => {
  it('hides the watermark for explicit opt-out values', () => {
    expect(isWatermarkVisible(0)).toBe(false);
    expect(isWatermarkVisible('0')).toBe(false);
    expect(isWatermarkVisible(false)).toBe(false);
  });

  it('shows the watermark for explicit opt-in values', () => {
    expect(isWatermarkVisible(1)).toBe(true);
    expect(isWatermarkVisible('1')).toBe(true);
    expect(isWatermarkVisible(true)).toBe(true);
  });

  it('defaults to visible for absent values (legacy rows, stale cache)', () => {
    expect(isWatermarkVisible(undefined)).toBe(true);
    expect(isWatermarkVisible(null)).toBe(true);
    expect(isWatermarkVisible('')).toBe(true);
  });
});
