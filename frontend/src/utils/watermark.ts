/**
 * Watermark visibility for a moment. Stored server-side as 1/0 (or '1'/'0');
 * absent — legacy rows and stale cache entries — means the product default: on.
 * Only an explicit opt-out hides the badge.
 */
export function isWatermarkVisible(value: string | number | boolean | null | undefined): boolean {
  return !(value === 0 || value === '0' || value === false);
}
