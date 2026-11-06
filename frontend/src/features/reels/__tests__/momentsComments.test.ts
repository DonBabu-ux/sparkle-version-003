import { describe, it, expect } from 'vitest';
import { parseCommentDate, relativeTime } from '../utils/commentFormat';

describe('Moments Comments — parseCommentDate cross-browser reliability', () => {
  it('parses standard ISO-8601 strings', () => {
    const d = parseCommentDate('2026-11-07T03:00:00.000Z');
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString()).toBe('2026-11-07T03:00:00.000Z');
  });

  it('parses MySQL space-separated datetime strings (Safari / iOS WebKit fix)', () => {
    const d = parseCommentDate('2026-11-07 03:00:00');
    expect(d).toBeInstanceOf(Date);
    expect(isNaN(d?.getTime() ?? NaN)).toBe(false);
  });

  it('parses numeric epoch timestamps and Date instances', () => {
    const now = Date.now();
    expect(parseCommentDate(now)?.getTime()).toBe(now);
    const dateObj = new Date('2026-11-07T00:00:00Z');
    expect(parseCommentDate(dateObj)?.getTime()).toBe(dateObj.getTime());
  });

  it('safely handles null, undefined, empty strings, and garbage input', () => {
    expect(parseCommentDate(null)).toBeNull();
    expect(parseCommentDate(undefined)).toBeNull();
    expect(parseCommentDate('')).toBeNull();
    expect(parseCommentDate('   ')).toBeNull();
    expect(parseCommentDate('not-a-date')).toBeNull();
  });
});

describe('Moments Comments — relativeTime formatting', () => {
  it('returns "just now" for fresh comments and slight client-server clock skew', () => {
    const now = Date.now();
    expect(relativeTime(new Date(now - 5000).toISOString())).toBe('just now');
    expect(relativeTime(new Date(now - 30000).toISOString())).toBe('just now');
    // Future clock skew up to 45s
    expect(relativeTime(new Date(now + 2000).toISOString())).toBe('just now');
  });

  it('returns clean minute/hour/day/week ago formats', () => {
    const now = Date.now();
    expect(relativeTime(new Date(now - 5 * 60 * 1000).toISOString())).toBe('5m ago');
    expect(relativeTime(new Date(now - 2 * 60 * 60 * 1000).toISOString())).toBe('2h ago');
    expect(relativeTime(new Date(now - 26 * 60 * 60 * 1000).toISOString())).toBe('Yesterday');
    expect(relativeTime(new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString())).toBe('3d ago');
    expect(relativeTime(new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString())).toBe('2w ago');
  });

  it('never returns NaNy, negative values or crashes on null / invalid input', () => {
    expect(relativeTime(null)).toBe('');
    expect(relativeTime(undefined)).toBe('');
    expect(relativeTime('invalid')).toBe('');
    expect(relativeTime('')).toBe('');
  });

  it('formats MySQL space-separated date strings without NaNy in all environments', () => {
    // 2 hours ago formatted as MySQL string "YYYY-MM-DD HH:MM:SS"
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
    const mysqlStr = twoHoursAgo.toISOString().replace('T', ' ').slice(0, 19);
    const formatted = relativeTime(mysqlStr);
    expect(formatted).not.toContain('NaN');
    expect(formatted).toMatch(/h ago|m ago/);
  });
});
