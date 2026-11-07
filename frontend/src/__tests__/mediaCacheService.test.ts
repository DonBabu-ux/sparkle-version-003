import { describe, it, expect, beforeEach } from 'vitest';
import { MediaCacheService } from '../services/mediaCacheService';

describe('MediaCacheService — Stable Media ID & Local Caching Architecture', () => {
  beforeEach(async () => {
    await MediaCacheService.clearCache();
  });

  describe('Stable Media ID Derivation', () => {
    it('uses moment_id when present regardless of changing delivery URLs', () => {
      const id1 = MediaCacheService.getStableMediaId({
        moment_id: 'moment_abc_123',
        media_url: 'https://res.cloudinary.com/sparkle/video/upload/v1234/sample.mp4?s=signed_token_1',
      });
      const id2 = MediaCacheService.getStableMediaId({
        moment_id: 'moment_abc_123',
        media_url: 'https://res.cloudinary.com/sparkle/video/upload/v5678/sample.mp4?s=new_token_rotated',
      });

      expect(id1).toBe('moment_moment_abc_123');
      expect(id2).toBe('moment_moment_abc_123');
      expect(id1).toBe(id2);
    });

    it('uses post_id when present', () => {
      const id = MediaCacheService.getStableMediaId({
        post_id: 'post_xyz_789',
        media_url: 'https://cdn.sparkle.app/videos/post.mp4',
      });
      expect(id).toBe('post_post_xyz_789');
    });

    it('extracts stable Cloudinary public ID when no content_id is supplied', () => {
      const url1 = 'https://res.cloudinary.com/sparkle/video/upload/v1698765432/moments/creator_video_001.mp4?s=tokenA';
      const url2 = 'https://res.cloudinary.com/sparkle/video/upload/q_auto,f_auto/v9876543210/moments/creator_video_001.mp4?s=tokenB';

      const id1 = MediaCacheService.getStableMediaId({ media_url: url1 });
      const id2 = MediaCacheService.getStableMediaId({ video_url: url2 });

      expect(id1).toBe('cloud_moments_creator_video_001');
      expect(id2).toBe('cloud_moments_creator_video_001');
      expect(id1).toBe(id2);
    });

    it('reuses identical stable ID across Profile (Owned), Liked and Saved collections', () => {
      const videoRecord = {
        moment_id: 'shared_moment_555',
        media_url: 'https://res.cloudinary.com/sparkle/video/upload/moments/nature.mp4?signature=temp123',
      };

      // 1. Accessed via Profile tab (Owned)
      const ownedStableId = MediaCacheService.getStableMediaId({ ...videoRecord, user_id: 'user_1' });
      // 2. Accessed via Liked collection
      const likedStableId = MediaCacheService.getStableMediaId(videoRecord);
      // 3. Accessed via Saved collection
      const savedStableId = MediaCacheService.getStableMediaId(videoRecord);

      expect(ownedStableId).toBe(likedStableId);
      expect(likedStableId).toBe(savedStableId);
      expect(ownedStableId).toBe('moment_shared_moment_555');
    });
  });

  describe('Cache Retrieval & Recovery', () => {
    it('returns original server URL on cache miss', async () => {
      const item = {
        moment_id: 'fresh_moment_999',
        video_url: 'https://cdn.sparkle.app/videos/dance.mp4',
      };

      const result = await MediaCacheService.getMediaUrl(item, { autoCache: false });
      expect(result.fromCache).toBe(false);
      expect(result.url).toBe('https://cdn.sparkle.app/videos/dance.mp4');
      expect(result.stableId).toBe('moment_fresh_moment_999');
    });

    it('clearing cache resets stats without throwing and safely falls back', async () => {
      await MediaCacheService.clearCache();
      const stats = await MediaCacheService.getStats();
      expect(stats.count).toBe(0);
      expect(stats.totalSizeBytes).toBe(0);

      const result = await MediaCacheService.getMediaUrl({
        moment_id: 'after_clear',
        media_url: 'https://cdn.sparkle.app/videos/clip.mp4',
      }, { autoCache: false });

      expect(result.fromCache).toBe(false);
      expect(result.url).toBe('https://cdn.sparkle.app/videos/clip.mp4');
    });
  });
});

