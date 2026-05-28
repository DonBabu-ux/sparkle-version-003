import defaultAvatar from '../assets/avatar.png';

const isLocalhost = 
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.') ||
  window.location.hostname.startsWith('10.') ||
  window.location.hostname.startsWith('172.');

const isNative = window.location.protocol === 'capacitor:';

const LIVE_URL = 'https://sparkle-version-003-1-f4v3.onrender.com/api';
const LOCAL_URL = 'http://localhost:3000/api';

const API_URL = import.meta.env.VITE_API_URL || (isNative ? LIVE_URL : (isLocalhost ? LOCAL_URL : LIVE_URL));
// Extract base URL (remove /api suffix)
const BASE_URL = API_URL.replace(/\/api\/?$/, '');

/**
 * Returns a reliable avatar URL.
 * Prioritizes provided URL, then falls back to a hosted default or local asset.
 * Section 5: Default Avatar Handling (APK Safe)
 */
export const getAvatarUrl = (url?: string | null, seed?: string | null): string => {
  // 1. Check for valid URL
  if (url && url !== 'null' && url !== 'undefined' && url.trim() !== '') {
    // If it's already a full URL (Cloudinary, etc)
    if (url.startsWith('http')) {
      return url;
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
 * Extends the basic getMediaUrl by applying Cloudinary transformations (f_auto, q_auto, width)
 * based on network quality (via networkStore).
 */
export const getMediaUrl = (url?: string | null): string => {
  if (!url || url === 'null' || url === 'undefined' || url.trim() === '') {
    return '';
  }

  if (url.startsWith('/uploads')) {
    return `${BASE_URL}${url}`;
  }

  return url;
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

  // 2. Cloudinary Optimization
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
