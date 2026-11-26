import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

// Moments never shows the global "Media Unavailable" placeholder — a dead
// moment video keeps its frame (poster stays visible, tile shows its own
// background) the way Instagram Reels does. This suite pins both ends of
// that opt-out wiring: GlobalEffects honours the marker, and every Moments
// video surface sets it. Source-level spec, same pattern as
// marketplaceImageFallbacks.
const globalEffects = readFileSync(new URL('../components/GlobalEffects.tsx', import.meta.url), 'utf8');
const moments = readFileSync(new URL('../pages/Moments.tsx', import.meta.url), 'utf8');
const studio = readFileSync(new URL('../pages/MomentStudio.tsx', import.meta.url), 'utf8');

describe('moments opt out of the "Media Unavailable" placeholder', () => {
  it('GlobalEffects skips the placeholder for videos carrying the opt-out marker', () => {
    expect(globalEffects).toContain('if (video.dataset.noErrorPlaceholder) return;');
  });

  it('GlobalEffects still guards the placeholder path for videos everywhere else', () => {
    expect(globalEffects).toContain('video-error-placeholder');
  });

  it('Moments feed video (HlsVideoPlayer) opts out', () => {
    expect(moments).toMatch(/<HlsVideoPlayer[\s\S]*?noErrorPlaceholder/);
  });

  it('Moments search-grid video opts out inline', () => {
    expect(moments).toContain('data-no-error-placeholder="true"');
  });

  it('Moment Studio thumbnail video opts out inline', () => {
    expect(studio).toContain('data-no-error-placeholder="true"');
  });
});