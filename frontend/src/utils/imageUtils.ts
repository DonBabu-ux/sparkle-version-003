import defaultAvatar from '../assets/avatar.png';

const API_URL = import.meta.env.VITE_API_URL || 'https://sparkle-version-003-1-f4v3.onrender.com/api';
// Extract base URL (remove /api suffix)
const BASE_URL = API_URL.replace(/\/api\/?$/, '');

/**
 * Returns a reliable avatar URL.
 * Prioritizes provided URL, then falls back to a hosted default or local asset.
 * Section 5: Default Avatar Handling (APK Safe)
 */
export const getAvatarUrl = (url?: string | null, username?: string): string => {
  // If we have a valid URL
  if (url && url !== 'null' && url !== 'undefined' && url.trim() !== '') {
    if (url.startsWith('http')) {
      return url;
    }
    if (url.startsWith('/uploads')) {
      return `${BASE_URL}${url}`;
    }
    return url;
  }

  // Fallback 1: UI Avatars (Remote, high quality)
  if (username) {
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=ff3d6d&color=fff&bold=true`;
  }

  // Fallback 2: Local bundled asset (APK Safe)
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
