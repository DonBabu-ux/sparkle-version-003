import { describe, it, expect } from 'vitest';
import { getTiktokEmbedUrl } from '../tiktokEmbed';

describe('getTiktokEmbedUrl', () => {
    it('builds embed URL from a standard tiktok video link', () => {
        expect(getTiktokEmbedUrl('https://www.tiktok.com/@user/video/7123456789012345678?is_from_webapp=1'))
            .toBe('https://www.tiktok.com/embed/v2/7123456789012345678');
    });

    it('strips tracking params from the id', () => {
        expect(getTiktokEmbedUrl('https://m.tiktok.com/v/7123456789012345678.html?share=1'))
            .toBe('https://www.tiktok.com/embed/v2/7123456789012345678');
    });

    it('returns null for non-tiktok urls', () => {
        expect(getTiktokEmbedUrl('https://example.com/video.mp4')).toBeNull();
        expect(getTiktokEmbedUrl('https://www.instagram.com/reel/abc/')).toBeNull();
    });

    it('returns null for empty/garbage input', () => {
        expect(getTiktokEmbedUrl('')).toBeNull();
        expect(getTiktokEmbedUrl(undefined)).toBeNull();
        expect(getTiktokEmbedUrl('https://www.tiktok.com/@user/video/')).toBeNull();
        expect(getTiktokEmbedUrl(null)).toBeNull();
    });
});
