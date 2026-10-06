/**
 * H20 — collapsed desktop sidebar rail (72px, fixed) must reserve its space:
 * - Navbar marks the sidebar shell so CSS can target pages that SHOW the rail
 * - index.css reserves exactly 72px (collapsed width) on md+ for those pages
 * - no page keeps the old 288px `lg:ml-72`/`lg:pl-72` reserves (would double-offset)
 * Hover expansion (240px) intentionally overlays content — not covered here.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function read(rel: string): string {
    return readFileSync(join(SRC, rel), 'utf8');
}

function allTsx(dir: string): string[] {
    return readdirSync(dir, { recursive: true })
        .filter((f: string) => f.endsWith('.tsx'))
        .map((f: string) => join(dir, f));
}

describe('H20 collapsed sidebar space reservation', () => {
    it('Navbar marks the desktop sidebar shell', () => {
        expect(read('components/Navbar.tsx')).toContain('desktop-sidebar-shell');
    });

    it('index.css reserves 72px on md+ only where the shell exists', () => {
        const css = read('index.css');
        expect(css).toMatch(
            /@media \(min-width: 768px\)[\s\S]*?#root:has\(\.desktop-sidebar-shell\)[\s\S]*?padding-left:\s*72px/
        );
    });

    it('no page still reserves the old 288px (lg:ml-72 / lg:pl-72)', () => {
        const offenders = allTsx(SRC)
            .map((f) => ({ f, s: readFileSync(f, 'utf8') }))
            .filter(({ s }) => s.includes('lg:ml-72') || s.includes('lg:pl-72'))
            .map(({ f }) => f);
        expect(offenders).toEqual([]);
    });
});
