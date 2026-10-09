/**
 * C3.1 — every declared route must have at least one inbound link
 * (App.tsx declares them; GlobalThemeProvider only lists theme scopes).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('..', import.meta.url)); // frontend/src

const ORPHANS = [
    '/wishlist',
    '/lost-found',
    '/follow-requests',
    '/settings/audio-diagnostics',
];

function walk(dir: string): string[] {
    return (readdirSync(dir, { recursive: true }) as string[])
        .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
        .map((f) => join(dir, f));
}

function rel(p: string): string {
    return p.split(/[/\\]/).slice(-3).join('/');
}

const EXCLUDE = new Set([
    join(SRC, 'App.tsx'),
    join(SRC, 'components', 'GlobalThemeProvider.tsx'),
]);

describe('C3.1 — orphan routes have inbound links', () => {
    const linkSources = walk(SRC)
        .filter((f) => !f.split(/[/\\]/).includes('__tests__'))
        .filter((f) => !EXCLUDE.has(f))
        .map((f) => ({ rel: rel(f), body: readFileSync(f, 'utf8') }));

    for (const route of ORPHANS) {
        it(`has an inbound link to ${route}`, () => {
            const hit = linkSources.find((s) =>
                s.body.includes(`navigate('${route}')`) ||
                s.body.includes(`navigate("${route}")`) ||
                s.body.includes(`to="${route}"`) ||
                s.body.includes(`to={'${route}'}`)
            );
            expect(hit?.rel ?? null, `no file navigates to ${route}`).not.toBeNull();
        });
    }
});
