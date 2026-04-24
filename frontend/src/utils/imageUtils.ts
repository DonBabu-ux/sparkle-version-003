
const API_URL = import.meta.env.VITE_API_URL || 'https://sparkle-version-003-1-f4v3.onrender.com/api';
// Extract base URL (remove /api suffix)
const BASE_URL = API_URL.replace(/\/api\/?$/, '');

/**
 * Returns a reliable avatar URL.
 * Prioritizes provided URL, then falls back to a hosted default.
 */
export const getAvatarUrl = (url?: string | null, username?: string): string => {
  if (!url || url === 'null' || url === 'undefined' || url.trim() === '') {
    // Return a reliable hosted default avatar (Cloudinary or UI Avatars)
    const name = username || 'User';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ff3d6d&color=fff&bold=true`;
  }

  if (url.startsWith('http')) {
    return url;
  }

  if (url.startsWith('/uploads')) {
    return `${BASE_URL}${url}`;
  }

  // Fallback
  return url;
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
