import { describe, it, expect } from 'vitest';
import { getMediaLayoutCategory, parseResolutionRatio } from '../utils/aspectRatioLayout';

describe('Intelligent Media Aspect-Ratio Layout & Edge-to-Edge Classification', () => {
  describe('Classification Boundaries (Section 7 guidance)', () => {
    it('classifies 16:9 widescreen video (1920x1080) as landscape', () => {
      const ratio = 1920 / 1080; // ~1.777
      expect(ratio).toBeGreaterThan(1.15);
      expect(getMediaLayoutCategory(ratio)).toBe('landscape');
    });

    it('classifies 720p widescreen video (1280x720) as landscape', () => {
      const ratio = 1280 / 720; // ~1.777
      expect(getMediaLayoutCategory(ratio)).toBe('landscape');
    });

    it('classifies 4:3 standard video (640x480) as landscape', () => {
      const ratio = 640 / 480; // ~1.333
      expect(ratio).toBeGreaterThan(1.15);
      expect(getMediaLayoutCategory(ratio)).toBe('landscape');
    });

    it('classifies 21:9 cinematic ultrawide video (2560x1080) as landscape', () => {
      const ratio = 2560 / 1080; // ~2.37
      expect(ratio).toBeGreaterThan(1.15);
      expect(getMediaLayoutCategory(ratio)).toBe('landscape');
    });

    it('classifies 1:1 perfect square video (1080x1080) as square', () => {
      const ratio = 1080 / 1080; // 1.0
      expect(ratio).toBeGreaterThanOrEqual(0.90);
      expect(ratio).toBeLessThanOrEqual(1.15);
      expect(getMediaLayoutCategory(ratio)).toBe('square');
    });

    it('classifies near-square video (1000x950) as square', () => {
      const ratio = 1000 / 950; // ~1.05
      expect(getMediaLayoutCategory(ratio)).toBe('square');
    });

    it('classifies near-square 4:5 social crop (1080x1200) as square', () => {
      const ratio = 1080 / 1200; // 0.90
      expect(getMediaLayoutCategory(ratio)).toBe('square');
    });

    it('classifies 9:16 vertical portrait video (1080x1920) as portrait', () => {
      const ratio = 1080 / 1920; // 0.5625
      expect(ratio).toBeLessThan(0.90);
      expect(getMediaLayoutCategory(ratio)).toBe('portrait');
    });

    it('classifies 3:4 vertical video (720x960) as portrait', () => {
      const ratio = 720 / 960; // 0.75
      expect(ratio).toBeLessThan(0.90);
      expect(getMediaLayoutCategory(ratio)).toBe('portrait');
    });

    it('safely defaults missing, zero or invalid dimensions to portrait without throwing', () => {
      expect(getMediaLayoutCategory(null)).toBe('portrait');
      expect(getMediaLayoutCategory(undefined)).toBe('portrait');
      expect(getMediaLayoutCategory(0)).toBe('portrait');
      expect(getMediaLayoutCategory(-1.5)).toBe('portrait');
      expect(getMediaLayoutCategory(NaN)).toBe('portrait');
    });
  });

  describe('Resolution Metadata Parsing', () => {
    it('parses widescreen resolution string', () => {
      const ratio = parseResolutionRatio('1920x1080');
      expect(ratio).toBeCloseTo(1.777, 2);
      expect(getMediaLayoutCategory(ratio)).toBe('landscape');
    });

    it('parses portrait resolution string', () => {
      const ratio = parseResolutionRatio('1080x1920');
      expect(ratio).toBeCloseTo(0.5625, 3);
      expect(getMediaLayoutCategory(ratio)).toBe('portrait');
    });

    it('parses square resolution string', () => {
      const ratio = parseResolutionRatio('1080x1080');
      expect(ratio).toBe(1);
      expect(getMediaLayoutCategory(ratio)).toBe('square');
    });

    it('handles malformed or missing resolution strings gracefully', () => {
      expect(parseResolutionRatio('')).toBeNull();
      expect(parseResolutionRatio(null)).toBeNull();
      expect(parseResolutionRatio(undefined)).toBeNull();
      expect(parseResolutionRatio('invalid')).toBeNull();
      expect(parseResolutionRatio('0x0')).toBeNull();
    });
  });
});
