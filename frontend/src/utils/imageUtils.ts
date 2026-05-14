import defaultAvatar from '../assets/avatar.png';

const API_URL = import.meta.env.VITE_API_URL || 'https://sparkle-version-003-1-f4v3.onrender.com/api';
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

  // 2. Fallback to Facebook-style 3D/2D cartoon avatar
  const avatarSeed = seed ? encodeURIComponent(seed) : Math.random().toString(36).substring(7);
  // Using micah (3D style) or avataaars (Facebook/Bitmoji style). Let's use 'avataaars' for Facebook-style.
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${avatarSeed}&backgroundColor=e8e8e8,ffb6c1,d1d4f9,c0aede,b6e3f4`;
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
