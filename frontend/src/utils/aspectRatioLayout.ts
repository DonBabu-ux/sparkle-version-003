/**
 * SPARKLE — Intelligent Media Aspect-Ratio Layout Classification
 *
 * Classifies media dimensions according to section 7 aspect-ratio guidance:
 * - > 1.15: Landscape-style centred presentation (e.g. 16:9, 1920x1080)
 * - 0.90 to 1.15: Square or near-square presentation (e.g. 1:1, 1080x1080)
 * - < 0.90: Portrait presentation (e.g. 9:16, 1080x1920)
 */

export type MediaLayoutCategory = 'portrait' | 'square' | 'landscape';

export function getMediaLayoutCategory(aspectRatio: number | null | undefined): MediaLayoutCategory {
  if (aspectRatio === null || aspectRatio === undefined || isNaN(aspectRatio) || aspectRatio <= 0) {
    return 'portrait'; // safe default
  }
  if (aspectRatio > 1.15) {
    return 'landscape';
  }
  if (aspectRatio >= 0.90) {
    return 'square';
  }
  return 'portrait';
}

/**
 * Parses initial aspect ratio from resolution string metadata (e.g. "1920x1080", "1080x1920")
 */
export function parseResolutionRatio(resolution?: string | null): number | null {
  if (!resolution || typeof resolution !== 'string') return null;
  const parts = resolution.toLowerCase().split('x').map((p) => parseFloat(p.trim()));
  if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
    return parts[0] / parts[1];
  }
  return null;
}

