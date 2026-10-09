/**
 * C2.2 — OTP/reset codes must travel in the URL fragment (never in ?query,
 * which leaks via Referer), with legacy query links still accepted.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseResetLinkParams } from '../resetLink';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

function read(rel: string): string {
    return readFileSync(join(ROOT, rel), 'utf8');
}

describe('parseResetLinkParams', () => {
    it('reads email + code from the fragment (new links)', () => {
        expect(parseResetLinkParams('#email=a%40b.c&code=XYZ', ''))
            .toEqual({ email: 'a@b.c', code: 'XYZ' });
    });

    it('falls back to legacy ?query links (in-flight emails)', () => {
        expect(parseResetLinkParams('', '?email=a%40b.c&code=XYZ'))
            .toEqual({ email: 'a@b.c', code: 'XYZ' });
    });

    it('accepts the legacy token param name in query links', () => {
        expect(parseResetLinkParams('', '?email=a%40b.c&token=ABC'))
            .toEqual({ email: 'a@b.c', code: 'ABC' });
    });

    it('prefers the fragment when both are present', () => {
        expect(parseResetLinkParams('#email=new%40x.io&code=NEW', '?email=old%40x.io&code=OLD'))
            .toEqual({ email: 'new@x.io', code: 'NEW' });
    });

    it('returns empty strings when nothing is present', () => {
        expect(parseResetLinkParams('', '')).toEqual({ email: '', code: '' });
    });
});

describe('C2.2 contracts — generated links use fragments', () => {
    it('auth controller builds reset links with #, not ?', () => {
        const ctrl = read('controllers/auth.controller.js');
        expect(ctrl).toContain('/reset-password#email=');
        expect(ctrl).not.toContain('/reset-password?email=');
    });

    it('auth controller builds verify links with #, not ?', () => {
        const ctrl = read('controllers/auth.controller.js');
        expect(ctrl).toContain('/verify-email#email=');
        expect(ctrl).not.toMatch(/\/verify-email\?/);
    });

    it('ResetPassword page parses via the shared helper', () => {
        const page = read('frontend/src/pages/ResetPassword.tsx');
        expect(page).toContain('parseResetLinkParams');
    });

    it('a public /verify-email route exists to receive the link', () => {
        const app = read('frontend/src/App.tsx');
        expect(app).toContain('path="/verify-email"');
        expect(app).toContain('VerifyEmail');
    });
});
