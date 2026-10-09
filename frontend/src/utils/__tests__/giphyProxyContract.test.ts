/**
 * C2.1 contract — the Giphy API key must never reach the client bundle:
 * - no hardcoded key and no direct api.giphy.com calls anywhere in frontend/src
 * - backend proxy keeps the key in env, accepts type + limit, no fallback literal
 * - server.js no longer leaks res.locals.giphyKey (EJS leftover)
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('../../', import.meta.url)); // frontend/src
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url)); // repo root

const HARD_KEY = ['V4', 'AnAfCCCGEVjlUjiNMWWXCoW1JrAn4p'].join('');

function walk(dir: string): string[] {
    return (readdirSync(dir, { recursive: true }) as string[])
        .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
        .filter((f) => !f.split(/[/\\]/).includes('__tests__'))
        .map((f) => join(dir, f));
}

function read(abs: string): string {
    return readFileSync(abs, 'utf8');
}

describe('C2.1 — Giphy key stays server-side', () => {
    it('frontend never embeds the key or calls api.giphy.com directly', () => {
        const offenders = walk(SRC)
            .filter((f) => read(f).includes(HARD_KEY) || read(f).includes('api.giphy.com'));
        expect(offenders).toEqual([]);
    });

    it('backend proxy reads the key from env only (no hardcoded fallback)', () => {
        const route = read(join(ROOT, 'routes', 'api', 'giphy.routes.js'));
        expect(route).not.toContain(HARD_KEY);
        expect(route).toContain('process.env.GIPHY_API_KEY');
    });

    it('backend proxy honours type and limit query params', () => {
        const route = read(join(ROOT, 'routes', 'api', 'giphy.routes.js'));
        expect(route).toContain('req.query.type');
        expect(route).toContain('req.query.limit');
    });

    it('server.js no longer exposes giphyKey to a dead view layer', () => {
        expect(read(join(ROOT, 'server.js'))).not.toContain('giphyKey');
    });
});
