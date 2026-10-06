import { describe, it, expect } from 'vitest';
import { decodeTokenPayload, getRoleFromToken } from '../tokenUtils';

const b64url = (s: string) =>
    Buffer.from(s, 'utf8').toString('base64url');
const makeToken = (payload: Record<string, unknown>) =>
    `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(JSON.stringify(payload))}.sig`;

describe('tokenUtils.decodeTokenPayload', () => {
    it('decodes a valid JWT payload', () => {
        const p = decodeTokenPayload(makeToken({ userId: 'u1', role: 'admin' }));
        expect(p).toEqual({ userId: 'u1', role: 'admin' });
    });

    it('returns null for malformed tokens', () => {
        expect(decodeTokenPayload('garbage')).toBeNull();
        expect(decodeTokenPayload('')).toBeNull();
        expect(decodeTokenPayload(undefined as unknown as string)).toBeNull();
        expect(decodeTokenPayload('a.%%%.c')).toBeNull();
    });
});

describe('tokenUtils.getRoleFromToken', () => {
    it('extracts admin role', () => {
        expect(getRoleFromToken(makeToken({ role: 'admin' }))).toBe('admin');
    });

    it('extracts moderator role', () => {
        expect(getRoleFromToken(makeToken({ role: 'moderator' }))).toBe('moderator');
    });

    it('returns plain role for users', () => {
        expect(getRoleFromToken(makeToken({ role: 'user' }))).toBe('user');
    });

    it('returns null when role claim missing or token invalid', () => {
        expect(getRoleFromToken(makeToken({ userId: 'x' }))).toBeNull();
        expect(getRoleFromToken('not-a-token')).toBeNull();
        expect(getRoleFromToken('')).toBeNull();
        expect(getRoleFromToken(null as unknown as string)).toBeNull();
    });
});
