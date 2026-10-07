import { describe, it, expect } from 'vitest';
import { safeHref } from '../safeHref';

describe('safeHref', () => {
    it('allows absolute http(s) URLs', () => {
        expect(safeHref('https://example.com/file.pdf')).toBe('https://example.com/file.pdf');
        expect(safeHref('http://example.com/a b')).toBe('http://example.com/a b');
        expect(safeHref('  https://example.com/x  ')).toBe('https://example.com/x');
    });

    it('allows site-relative paths (media served from /uploads)', () => {
        expect(safeHref('/uploads/chat/doc.pdf')).toBe('/uploads/chat/doc.pdf');
        expect(safeHref('/images/avatar.png')).toBe('/images/avatar.png');
    });

    it('rejects executable schemes (stored XSS vectors)', () => {
        expect(safeHref('javascript:alert(document.cookie)')).toBeUndefined();
        expect(safeHref('JaVaScRiPt:alert(1)')).toBeUndefined();
        expect(safeHref('  javascript:alert(1)  ')).toBeUndefined();
        expect(safeHref('data:text/html,<script>alert(1)</script>')).toBeUndefined();
        expect(safeHref('vbscript:msgbox(1)')).toBeUndefined();
        expect(safeHref('java\nscript:alert(1)')).toBeUndefined();
        expect(safeHref('java\tscript:alert(1)')).toBeUndefined();
    });

    it('rejects protocol-relative and other non-http(s) URLs', () => {
        expect(safeHref('//evil.example/x')).toBeUndefined();
        expect(safeHref('ftp://example.com/x')).toBeUndefined();
        expect(safeHref('file:///etc/passwd')).toBeUndefined();
        expect(safeHref('blob:https://example.com/uuid')).toBeUndefined();
    });

    it('rejects empty and non-string input', () => {
        expect(safeHref('')).toBeUndefined();
        expect(safeHref('   ')).toBeUndefined();
        expect(safeHref(null)).toBeUndefined();
        expect(safeHref(undefined)).toBeUndefined();
        expect(safeHref(42)).toBeUndefined();
        expect(safeHref({ url: 'https://x' })).toBeUndefined();
    });
});
