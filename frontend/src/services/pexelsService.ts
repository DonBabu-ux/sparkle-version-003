const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY || '';
const PEXELS_BASE = 'https://api.pexels.com/v1';

export interface PexelsPhoto {
  id: number;
  src: { medium: string; large: string; small: string; original: string; tiny: string };
  photographer: string;
  photographer_url: string;
  alt: string;
  width: number;
  height: number;
}

interface PexelsResponse {
  photos: PexelsPhoto[];
  next_page: string;
  total_results: number;
}

let cachedPhotos: PexelsPhoto[] | null = null;
let lastFetch = 0;
const CACHE_TTL = 1000 * 60 * 30;

async function fetchFromPexels(endpoint: string): Promise<PexelsPhoto[]> {
  if (!PEXELS_API_KEY) {
    console.warn('[Pexels] No API key found. Using fallback images.');
    return [];
  }
  try {
    const res = await fetch(`${PEXELS_BASE}${endpoint}`, {
      headers: { Authorization: PEXELS_API_KEY },
    });
    if (!res.ok) throw new Error(`Pexels error: ${res.status}`);
    const data: PexelsResponse = await res.json();
    return data.photos || [];
  } catch (err) {
    console.warn('[Pexels] Fetch failed:', err);
    return [];
  }
}

export const pexelsService = {
  async getCurated(count = 30): Promise<PexelsPhoto[]> {
    if (cachedPhotos && Date.now() - lastFetch < CACHE_TTL) {
      return cachedPhotos.slice(0, count);
    }
    const photos = await fetchFromPexels(`/curated?per_page=${count}`);
    if (photos.length > 0) {
      cachedPhotos = photos;
      lastFetch = Date.now();
    }
    return photos;
  },

  async search(query: string, count = 20): Promise<PexelsPhoto[]> {
    const photos = await fetchFromPexels(`/search?query=${encodeURIComponent(query)}&per_page=${count}`);
    return photos;
  },

  async getCampusFeed(): Promise<PexelsPhoto[]> {
    const queries = ['university students', 'campus life', 'college library', 'study group', 'student dorm', 'campus outdoors'];
    const randomQuery = queries[Math.floor(Math.random() * queries.length)];
    const photos = await this.search(randomQuery, 20);
    if (photos.length > 0) return photos;
    return this.getCurated(20);
  },

  getCachedPhotos(): PexelsPhoto[] {
    return cachedPhotos || [];
  },

  isReady(): boolean {
    return !!PEXELS_API_KEY;
  },
};

export function pexelsImageUrl(photo: PexelsPhoto, size: 'tiny' | 'small' | 'medium' | 'large' = 'medium'): string {
  const src = photo.src[size] || photo.src.medium;
  return `${src}?auto=compress&cs=tinysrgb&w=${size === 'tiny' ? 150 : size === 'small' ? 400 : size === 'medium' ? 800 : 1280}`;
}
