import { describe, it, expect } from 'vitest';
import { isDefinitiveAuthFailure } from '../utils/startupAuth';

describe('startupAuth.isDefinitiveAuthFailure (App boot decision)', () => {
    it('treats 401 as definitive (session is dead → /login)', () => {
        expect(isDefinitiveAuthFailure({ response: { status: 401 } })).toBe(true);
    });

    it('treats 403 as definitive', () => {
        expect(isDefinitiveAuthFailure({ response: { status: 403 } })).toBe(true);
    });

    it('treats 503 (DB outage) as transient — session must survive', () => {
        expect(isDefinitiveAuthFailure({ response: { status: 503 } })).toBe(false);
    });

    it('treats 500 as transient', () => {
        expect(isDefinitiveAuthFailure({ response: { status: 500 } })).toBe(false);
    });

    it('treats network failure (no response) as transient', () => {
        expect(isDefinitiveAuthFailure(new Error('Network Error'))).toBe(false);
    });

    it('treats a validation timeout as transient', () => {
        expect(isDefinitiveAuthFailure(new Error('Auth validation timeout'))).toBe(false);
    });

    it('handles null/undefined safely', () => {
        expect(isDefinitiveAuthFailure(null)).toBe(false);
        expect(isDefinitiveAuthFailure(undefined)).toBe(false);
    });
});
