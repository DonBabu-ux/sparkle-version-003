import defaultAvatar from '../assets/avatar.png';

const API_URL = import.meta.env.VITE_API_URL || 'https://sparkle-version-003-1-f4v3.onrender.com/api';
// Extract base URL (remove /api suffix)
const BASE_URL = API_URL.replace(/\/api\/?$/, '');

/**
 * Returns a reliable avatar URL.
 * Prioritizes provided URL, then falls back to a hosted default or local asset.
 * Section 5: Default Avatar Handling (APK Safe)
 */
export const getAvatarUrl = (url?: string | null): string => {
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

  // 2. Fallback to local asset (or return empty for component to handle)
  return defaultAvatar;
};

/**
 * Returns a reliable media URL.
 */
export const getMediaUrl = (url?: string | null): string => {
  if (!url || url === 'null' || url === 'undefined' || url.trim() === '') {
    return '';
  }

  if (url.startsWith('http')) {
    return url;
  }

  if (url.startsWith('/uploads')) {
    return `${BASE_URL}${url}`;
  }

  return url;
};
