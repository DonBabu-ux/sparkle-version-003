/**
 * H22 — text-color cascade: text must be visible inside inverted containers.
 *
 * The @layer base rules used to paint h1..h6/p/span/b/i/strong/em/a with the
 * THEME color (--color-text-primary), which overrides the color those elements
 * inherit from their container. Inside a container of opposite polarity
 * (text-white card in light theme, text-black card in dark theme) that painted
 * the text the same color as the background → invisible.
 *
 * Correct model: body carries the theme color; containers carry their own;
 * bare text INHERITS the nearest ancestor (utility colors win, as designed).
 * Links must opt into `color: inherit` or the UA stylesheet turns them blue.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');

describe('H22 text-color cascade', () => {
    it('no element-level forced theme color on bare text elements', () => {
        expect(css).not.toMatch(
            /h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6,\s*p,\s*span,\s*b,\s*i,\s*strong,\s*em\s*\{[^}]*text-\[var\(--color-text-primary\)\]/
        );
        expect(css).not.toMatch(
            /h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{[^}]*text-\[var\(--color-text-primary\)\]/
        );
    });

    it('links inherit color instead of forcing the theme color', () => {
        expect(css).toMatch(/a\s*\{[^}]*color:\s*inherit/);
        expect(css).not.toMatch(/a\s*\{[^}]*text-\[var\(--color-text-primary\)\]/);
    });

    it('body still anchors the theme color for light and dark', () => {
        expect(css).toMatch(/body\s*\{[^}]*text-\[#000000\]/);
        expect(css).toMatch(/\.dark body\s*\{[^}]*color:\s*#FFFFFF/);
    });
});
