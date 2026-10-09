/**
 * C3.2 — no dead controls: every rendered <button> must carry a handler
 * (self or ancestor) or be wrapped in Link/label. Inventory regenerated from
 * the A.5.3 audit (≈51 truly dead) — must now be empty.
 */
import { describe, it, expect } from 'vitest';
import { findDeadButtons, findDeadInputs } from './helpers/deadButtons';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('..', import.meta.url)); // frontend/src

describe('C3.2 — dead controls sweep', () => {
    it('finds zero buttons without any handler', { timeout: 60_000 }, () => {
        const dead = findDeadButtons();
        expect(
            dead.map((d) => `${d.file}:${d.line} "${d.label}"`),
            `${dead.length} dead button(s)`
        ).toEqual([]);
    });

    it('finds zero text inputs without onChange (A.5.3 dead inputs)', { timeout: 60_000 }, () => {
        const dead = findDeadInputs();
        expect(
            dead.map((d) => `${d.file}:${d.line} "${d.label}"`),
            `${dead.length} dead input(s)`
        ).toEqual([]);
    });

    it('Help search actually reads searchQuery (was a no-op)', () => {
        const body = readFileSync(join(SRC, 'pages', 'Help.tsx'), 'utf8');
        // searchQuery must be consumed by a filter, not just written by onChange
        expect(body).toMatch(/searchQuery[\s\S]{0,400}(filter|includes|toLowerCase|match)/);
    });
});
