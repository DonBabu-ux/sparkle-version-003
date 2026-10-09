/**
 * C2.3 wiring — every component that renders a `type="file"` input must
 * import the shared validator and call it, so oversized/wrong-type files
 * fail fast with a readable message instead of a server/network error.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../', import.meta.url)); // frontend/src

function walk(dir: string): string[] {
    return (readdirSync(dir, { recursive: true }) as string[])
        .filter((f) => f.endsWith('.tsx'))
        .filter((f) => !f.split(/[/\\]/).includes('__tests__'))
        .map((f) => join(dir, f));
}

const filesWithInput = walk(SRC).filter((f) => readFileSync(f, 'utf8').includes('type="file"'));

describe('C2.3 wiring — file inputs validated client-side', () => {
    it('finds the file inputs (guard against a broken walker)', () => {
        expect(filesWithInput.length).toBeGreaterThanOrEqual(10);
    });

    it('every file with an input imports the shared validator', () => {
        const offenders = filesWithInput
            .filter((f) => !readFileSync(f, 'utf8').includes("from '") || !readFileSync(f, 'utf8').match(/from '[^']*fileValidation'/));
        expect(offenders.map((f) => f.replace(SRC, ''))).toEqual([]);
    });

    it('every file with an input calls validateFile/validateFiles', () => {
        const offenders = filesWithInput
            .filter((f) => !/validateFiles?\(/.test(readFileSync(f, 'utf8')));
        expect(offenders.map((f) => f.replace(SRC, ''))).toEqual([]);
    });
});
