import type { Post } from '../types/post';
import { getOptimizedMediaUrl } from '../utils/imageUtils';

/**
 * 1. MediaCacheService
 * Caches image assets by creating in-memory Image elements, 
 * leveraging the browser's native HTTP cache for instant retrieval.
 */
export const MediaCacheService = {
  prefetchedUrls: new Set<string>(),

  /**
   * Prefetches an image URL silently in the background
   */
  prefetchImage: (url: string): Promise<void> => {
    if (!url || MediaCacheService.prefetchedUrls.has(url)) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        MediaCacheService.prefetchedUrls.add(url);
        resolve();
      };
      img.onerror = () => {
        // Resolve anyway to prevent blocking Promise.all calls
        resolve();
      };
      img.src = url;
    });
  },

  /**
   * Prefetches video files utilizing standard preload links
   */
  prefetchVideo: (url: string): void => {
    if (!url || MediaCacheService.prefetchedUrls.has(url)) return;

    try {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'video';
      link.href = url;
      document.head.appendChild(link);
      MediaCacheService.prefetchedUrls.add(url);
    } catch (e) {
      console.warn('Failed to prefetch video', e);
    }
  }
};

/**
 * 2. PrefetchEngine
 * Orchestrates smart media prefetching based on network quality states.
 */
export const PrefetchEngine = {
  /**
   * Dynamically prefetches media files based on active network quality
   */
  preloadNextItems: (posts: Post[], currentIndex: number, networkQuality: 'strong' | 'weak' | 'unstable' | 'offline') => {
    if (networkQuality === 'offline') return;

    // Define look-ahead distance based on network quality
    const lookAheadDistance = networkQuality === 'strong' ? 5 : 2;

    const targetPosts = posts.slice(currentIndex + 1, currentIndex + 1 + lookAheadDistance);

    targetPosts.forEach((post) => {
      // 1. Prefetch Single Media URL
      if (post.media_url) {
        const isVideo = post.media_type === 'video' || post.media_url.match(/\.(mp4|webm|ogg|mov|quicktime)$/i);
        
        if (isVideo) {
          // Only preload videos silently if we are on a strong connection
          if (networkQuality === 'strong') {
            MediaCacheService.prefetchVideo(post.media_url);
          }
        } else {
          // Preload HD/medium for strong network, low-res for weak/unstable network
          const qualityPreset = networkQuality === 'strong' ? 'auto' : 'low';
          const optimizedUrl = getOptimizedMediaUrl(post.media_url, qualityPreset, 800);
          MediaCacheService.prefetchImage(optimizedUrl);
          
          // Always preload low-res blurred thumbnail for immediate shell rendering
          const thumbnailUrl = getOptimizedMediaUrl(post.media_url, 'thumbnail', 100);
          MediaCacheService.prefetchImage(thumbnailUrl);
        }
      }

      // 2. Prefetch Media Files Array (for multi-image posts)
      if (post.media_files && post.media_files.length > 0) {
        post.media_files.forEach((file) => {
          const isVideo = file.type === 'video' || file.url.match(/\.(mp4|webm|ogg|mov|quicktime)$/i);
          
          if (isVideo) {
            if (networkQuality === 'strong') {
              MediaCacheService.prefetchVideo(file.url);
            }
          } else {
            const qualityPreset = networkQuality === 'strong' ? 'auto' : 'low';
            const optimizedUrl = getOptimizedMediaUrl(file.url, qualityPreset, 600);
            MediaCacheService.prefetchImage(optimizedUrl);

            const thumbnailUrl = getOptimizedMediaUrl(file.url, 'thumbnail', 100);
            MediaCacheService.prefetchImage(thumbnailUrl);
          }
        });
      }

      // 3. Prefetch partner avatars
      if (post.avatar_url) {
        MediaCacheService.prefetchImage(post.avatar_url);
      }
    });
  }
};
