/**
 * C3 — A.5.9: Verified.tsx used to fake a successful identity submission
 * (setTimeout → step 3 "Signal Transmitted"). There is no verification
 * pipeline server-side, so the form must give honest feedback instead of
 * pretending a document was transmitted.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('..', import.meta.url)); // frontend/src

describe('C3 — Verified.tsx submit is honest', () => {
    const body = readFileSync(join(SRC, 'pages', 'Verified.tsx'), 'utf8');

    it('contains no fake setTimeout advance to success', () => {
        expect(body).not.toMatch(/setTimeout\(/);
    });

    it('tells the user nothing was actually submitted', () => {
        expect(body).toMatch(/NOT uploaded/i);
    });
});
