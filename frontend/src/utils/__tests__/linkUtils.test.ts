// frontend/src/utils/__tests__/linkUtils.test.ts
import { describe, it, expect } from 'vitest';
import { sanitizeUrl, normalizeUrl, detectUrls } from '../linkUtils';

describe('sanitizeUrl', () => {
  it('rejects javascript: scheme', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeUrl('JAVASCRIPT:alert(1)')).toBeNull();
  });

  it('rejects data: scheme', () => {
    expect(sanitizeUrl('data:text/html,<h1>XSS</h1>')).toBeNull();
    expect(sanitizeUrl('DATA:image/png;base64,abc')).toBeNull();
  });

  it('rejects file: scheme', () => {
    expect(sanitizeUrl('file:///etc/passwd')).toBeNull();
    expect(sanitizeUrl('FILE:///C:/Windows/system32')).toBeNull();
  });

  it('rejects vbscript: scheme', () => {
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBeNull();
  });

  it('accepts https:// URLs', () => {
    expect(sanitizeUrl('https://google.com')).toBe('https://google.com');
    expect(sanitizeUrl('https://example.org/path?q=1')).toBe('https://example.org/path?q=1');
  });

  it('accepts http:// URLs', () => {
    expect(sanitizeUrl('http://example.com')).toBe('http://example.com');
  });

  it('returns null for empty string', () => {
    expect(sanitizeUrl('')).toBeNull();
  });
});

describe('normalizeUrl', () => {
  it('adds https:// prefix to www. URLs', () => {
    expect(normalizeUrl('www.google.com')).toBe('https://www.google.com');
  });

  it('leaves https:// URLs unchanged', () => {
    expect(normalizeUrl('https://google.com')).toBe('https://google.com');
  });

  it('leaves http:// URLs unchanged', () => {
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
  });
});

describe('detectUrls', () => {
  it('finds https:// URLs in text', () => {
    const results = detectUrls('Check out https://github.com for code');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].url).toContain('github.com');
    expect(results[0].safe).toBe(true);
  });

  it('finds http:// URLs in text', () => {
    const results = detectUrls('Visit http://example.com today');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].url).toContain('example.com');
  });

  it('finds www. URLs without scheme', () => {
    const results = detectUrls('Go to www.google.com for search');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].url).toContain('google.com');
  });

  it('does not false positive on email addresses', () => {
    const results = detectUrls('Send email to user@gmail.com please');
    // If gmail.com is found, its start should NOT be right after @
    const gmailHit = results.find((r) => r.url.includes('gmail.com'));
    if (gmailHit) {
      const textBeforeHit = 'Send email to user@gmail.com please'.slice(0, gmailHit.start);
      expect(textBeforeHit.endsWith('@')).toBe(false);
    }
  });

  it('returns empty array for text without URLs', () => {
    const results = detectUrls('Hello, this is a plain message with no links.');
    // No well-formed URL should be found
    expect(results.length).toBe(0);
  });

  it('marks unsafe URLs correctly (javascript: should not appear — sanitizeUrl filters them)', () => {
    // detectUrls would not normally match javascript: since it only matches http/https/www/bare domains
    const results = detectUrls('Click javascript:alert(1)');
    const jsHit = results.find((r) => r.url.startsWith('javascript:'));
    // Should either not find it or mark it as not safe
    if (jsHit) {
      expect(jsHit.safe).toBe(false);
    }
  });

  it('handles multiple URLs in text', () => {
    const results = detectUrls('Visit https://google.com and https://github.com for more');
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('does not false positive on file extensions like .mp4', () => {
    const results = detectUrls('video.mp4 is a file');
    const mp4Hit = results.find((r) => r.url === '.mp4');
    expect(mp4Hit).toBeUndefined();
  });
});
