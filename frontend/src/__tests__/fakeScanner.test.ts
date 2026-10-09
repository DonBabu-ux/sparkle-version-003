/**
 * C3.4 — EventsAdmin "scanner" must not ship a fake camera:
 * the CSS scanline overlay ("Initializing Lens…") is replaced by a
 * real manual check-in wired to POST /events/checkin.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('..', import.meta.url)); // frontend/src

describe('C3.4 — EventsAdmin scanner is real (no fake camera)', () => {
    const body = readFileSync(join(SRC, 'pages', 'EventsAdmin.tsx'), 'utf8');

    it('removes the fake CSS scanner overlay', () => {
        expect(body).not.toContain('Initializing Lens');
        expect(body).not.toContain('scanLine');
    });

    it('wires check-in to the real backend endpoint', () => {
        expect(body).toMatch(/api\.post\(\s*['"`]\/events\/checkin['"`]/);
    });
});
