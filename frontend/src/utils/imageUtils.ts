import defaultAvatar from '../assets/no-profile.png';
import { EnvironmentService } from '../services/EnvironmentService';

// API URL resolved via EnvironmentService: env var override, absolute Render
// URL in the native APK webview, same-origin elsewhere (Vite proxy in dev,
// /api rewrite on Vercel in prod).
const API_URL = EnvironmentService.getApiBaseUrl();
// Extract base URL (remove /api suffix)
const BASE_URL = API_URL.replace(/\/api\/?$/, '');

// Only the CURRENT Cloudinary account is alive. Legacy rows from older or
// closed accounts must never be requested — but the live account must pass
// through so it can be rewritten to ImageKit for delivery.
const CLOUDINARY_CLOUD = 'drwldeniw';
const IMAGEKIT_ID = '9o04vzsnf';

const CLOUDINARY_PREFIX = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/`;
const IMAGEKIT_PREFIX = `https://ik.imagekit.io/${IMAGEKIT_ID}/`;

const isDeadCloudinaryUrl = (url: string) =>
  url.includes('res.cloudinary.com') && !url.includes(CLOUDINARY_PREFIX);

// Rewrite a live Cloudinary IMAGE url to ImageKit for delivery.
// ImageKit pulls the original from the Cloudinary web-server origin and
// serves it optimized. Videos stay on Cloudinary: ImageKit free tier caps
// video and Cloudinary already handles adaptive streaming for them.
const rewriteToImageKit = (url: string): string => {
  if (!url.startsWith(CLOUDINARY_PREFIX)) return url;
  if (!url.includes('/image/upload/')) return url;
  return url.replace(CLOUDINARY_PREFIX, IMAGEKIT_PREFIX);
};

// Backend-shipped default avatar paths — route them to the bundled
// grey PNG so the UI never shows the old clipart image.
const isBackendDefaultAvatar = (url: string) =>
  url.includes('avatars/default') || url.includes('avatars/no-profile') || url.includes('avatar_default');

/**
 * Returns a reliable avatar URL.
 * Prioritizes provided URL, then falls back to a bundled default.
 * Section 5: Default Avatar Handling (APK Safe)
 */
export const getAvatarUrl = (url?: string | null, _seed?: string | null): string => {
  if (url && (url.includes('sparkle-logo') || url.includes('/assets/system/'))) {
    return url.startsWith('/') ? url : `/${url}`;
  }
  // 1. Check for valid URL
  if (url && url !== 'null' && url !== 'undefined' && url.trim() !== '') {
    // Dead Cloudinary account — fall back to the bundled default
    if (isDeadCloudinaryUrl(url)) return defaultAvatar;
    // Backend default avatar file — use the bundled grey version
    if (isBackendDefaultAvatar(url)) return defaultAvatar;
    // If it's already a full URL — route live Cloudinary images via ImageKit
    if (url.startsWith('http')) {
      return rewriteToImageKit(url);
    }
    // If it's a relative upload path from our server
    if (url.startsWith('/uploads')) {
      return `${BASE_URL}${url}`;
    }
    // If it's a bundled asset path
    if (url.startsWith('/') || url.includes('assets/')) {
      return url;
    }
  }

  // 2. Fallback to default avatar image
  return defaultAvatar;
};

/**
 * Returns a reliable media URL.
 * Dead Cloudinary URLs resolve to '' so callers render their own placeholder
 * instead of firing a doomed network request.
 */
export const getMediaUrl = (url?: string | null): string => {
  if (!url || url === 'null' || url === 'undefined' || url.trim() === '') {
    return '';
  }

  if (isDeadCloudinaryUrl(url)) {
    return '';
  }

  if (url.startsWith('/uploads')) {
    return `${BASE_URL}${url}`;
  }

  return rewriteToImageKit(url);
};

/**
 * PRODUCTION CLOUDINARY + PEXELS OPTIMIZATION (Phase 2)
 * Injects smart transformations into Cloudinary and Pexels URLs to save bandwidth and load instantly.
 */
export const getOptimizedMediaUrl = (
  url?: string | null,
  quality: 'hd' | 'high' | 'medium' | 'low' | 'thumbnail' = 'medium',
  width?: number
): string => {
  const base = getMediaUrl(url);
  if (!base) return '';

  // 1. Pexels Optimization
  if (base.includes('pexels.com')) {
    try {
      const urlObj = new URL(base);
      
      // Set compression
      urlObj.searchParams.set('auto', 'compress');
      urlObj.searchParams.set('cs', 'tinysrgb');

      // Set quality
      if (quality === 'thumbnail') {
        urlObj.searchParams.set('q', '25');
      } else if (quality === 'low') {
        urlObj.searchParams.set('q', '40');
      } else if (quality === 'medium') {
        urlObj.searchParams.set('q', '60');
      } else if (quality === 'high') {
        urlObj.searchParams.set('q', '75');
      } else {
        urlObj.searchParams.set('q', '90');
      }

      // Set width
      if (width) {
        urlObj.searchParams.set('w', String(width));
        // Remove height to let aspect ratio be preserved
        urlObj.searchParams.delete('h');
      }

      return urlObj.toString();
    } catch {
      return base;
    }
  }

  // 2. ImageKit Optimization (live Cloudinary images, rewritten at getMediaUrl)
  if (base.includes('ik.imagekit.io')) {
    // Already transformed — don't stack another tr= on top
    if (base.includes('?tr=') || base.includes('&tr=')) return base;

    // ImageKit quality mapping — numeric, mirrors the Pexels scale
    let q: string;
    if (quality === 'thumbnail') q = '30';
    else if (quality === 'low') q = '40';
    else if (quality === 'medium') q = '60';
    else if (quality === 'high') q = '75';
    else q = '90';

    const tr = [`q-${q}`, 'f-auto'];

    if (width) {
      const targetWidth = quality === 'thumbnail' ? Math.floor(width / 4) : width;
      tr.push(`w-${targetWidth}`);
    }

    // ImageKit default transformationPosition is "query"
    return `${base}?tr=${tr.join(',')}`;
  }

  // 3. Cloudinary Optimization (videos — stay on Cloudinary in the hybrid)
  if (!base.includes('res.cloudinary.com')) return base;

  // Prevent double-transforming if parameters already exist
  if (base.includes('/upload/f_') || base.includes('/upload/q_')) return base;

  const transformations = ['f_auto'];

  // Quality mapping for adaptive Cloudinary compression
  if (quality === 'thumbnail') {
    // Fast, lightweight thumbnail without aggressive blur
    transformations.push('q_30'); 
  } else if (quality === 'low') {
    transformations.push('q_auto:low'); // 2G/3G optimization
  } else if (quality === 'medium') {
    transformations.push('q_auto:good'); // Medium quality - balanced clarity/size (feed default)
  } else if (quality === 'high') {
    transformations.push('q_auto:best'); // High-end mobile/Wi-Fi quality
  } else {
    transformations.push('q_auto'); // HD quality
  }

  // Width logic
  if (width) {
    // If it's a thumbnail, scale down width to preserve bandwidth
    const targetWidth = quality === 'thumbnail' ? Math.floor(width / 4) : width;
    transformations.push(`w_${targetWidth}`);
  }

  const transformString = transformations.join(',');

  // Inject transformations after /upload/
  return base.replace('/upload/', `/upload/${transformString}/`);
};
