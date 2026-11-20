import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.resolve(__dirname, '..', 'index.css'), 'utf8');
const messagesSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'pages', 'Messages.tsx'),
    'utf8'
);
const chatBackgroundSource = fs.readFileSync(
    path.resolve(__dirname, '..', 'components', 'chat', 'ChatBackground.tsx'),
    'utf8'
);

describe('message bubble layout contract', () => {
    it('caps the bubble width on phones', () => {
        const rule = css.match(/\.message-bubble-shell\s*\{([^}]*)\}/);
        expect(rule).not.toBeNull();
        expect(rule![1]).toMatch(/max-width:\s*82%/);
        expect(rule![1]).toMatch(/width:\s*fit-content/);
    });

    it('tightens the bubble width on wide screens', () => {
        expect(css).toMatch(/@media \(min-width: 768px\)[\s\S]*\.message-bubble-shell\s*\{[^}]*max-width:\s*68%/);
    });

    it('keeps long words inside the bubble', () => {
        const rule = css.match(/\.message-bubble-content\s*\{([^}]*)\}/);
        expect(rule).not.toBeNull();
        expect(rule![1]).toMatch(/overflow-wrap:\s*anywhere/);
        expect(rule![1]).toMatch(/word-break:\s*normal/);
    });

    it('applies the shell class to the outgoing and incoming bubbles', () => {
        expect(messagesSource).toContain('message-bubble-shell');
    });

    it('does not hard-code a fixed bubble width in the message list', () => {
        expect(messagesSource).not.toMatch(/max-w-\[75%\]/);
    });
});

describe('chat wallpaper contract', () => {
    it('renders the wallpaper on its own layer instead of the scrolling list', () => {
        expect(chatBackgroundSource).toContain('absolute');
        expect(chatBackgroundSource).toContain('inset-0');
    });

    it('keeps the wallpaper from being repainted while scrolling', () => {
        expect(chatBackgroundSource).toContain('translateZ(0)');
        expect(chatBackgroundSource).toContain('contain');
    });
});
