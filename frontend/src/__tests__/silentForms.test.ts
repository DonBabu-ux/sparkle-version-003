/**
 * C3.3 — comment forms must surface failures to the user
 * (previously: PostDetail + Confessions comment submits failed silently).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('..', import.meta.url)); // frontend/src

function read(rel: string): string {
    return readFileSync(join(SRC, rel), 'utf8');
}

describe('C3.3 — silent comment forms now show errors', () => {
    it('PostDetail surfaces comment-submit failures via toast', () => {
        const body = read('pages/PostDetail.tsx');
        expect(body).toMatch(/import\s*\{[^}]*showError[^}]*\}\s*from\s*'[^']*utils\/toast'/);
        expect(body).toMatch(/catch\s*\([^)]*\)\s*\{[^}]*showError\(/);
    });

    it('Confessions surfaces comment failures via toast', () => {
        const body = read('pages/Confessions.tsx');
        expect(body).toMatch(/import\s*\{[^}]*showError[^}]*\}\s*from\s*'[^']*utils\/toast'/);
        expect(body).toMatch(/catch\s*\([^)]*\)\s*\{[^}]*showError\(/);
    });
});
