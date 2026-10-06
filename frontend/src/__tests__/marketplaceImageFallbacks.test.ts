import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

// H25 — /uploads/marketplace/default.png does not exist (404 → broken <img>).
// Every missing-image fallback must point at the real placeholder
// /uploads/defaults/no-image.png (served, 200). Source-level spec (browser
// automation unavailable by user decision), same pattern as sidebarLayout.
const detail = readFileSync(new URL('../pages/ListingDetail.tsx', import.meta.url), 'utf8');
const order = readFileSync(new URL('../pages/MarketplaceOrder.tsx', import.meta.url), 'utf8');

const DEAD_PATH = '/uploads/marketplace/default.png';
const REAL_PLACEHOLDER = '/uploads/defaults/no-image.png';

describe('marketplace missing-image fallbacks (H25)', () => {
    it('ListingDetail does not reference the non-existent placeholder', () => {
        expect(detail).not.toContain(DEAD_PATH);
    });

    it('ListingDetail suggested-items img uses media chain + real placeholder', () => {
        expect(detail).toContain(
            `src={item.media_url || item.image_url || '${REAL_PLACEHOLDER}'}`
        );
    });

    it('MarketplaceOrder does not reference the non-existent placeholder', () => {
        expect(order).not.toContain(DEAD_PATH);
    });

    it('MarketplaceOrder falls back to the real placeholder', () => {
        expect(order).toContain(REAL_PLACEHOLDER);
    });
});
