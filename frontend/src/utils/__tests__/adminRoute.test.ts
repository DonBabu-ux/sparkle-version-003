import { describe, it, expect } from 'vitest';
import { isAdminRole, getPostLoginRoute, resolveAdminAccess } from '../adminRoute';

describe('isAdminRole', () => {
    it('accepts admin and moderator', () => {
        expect(isAdminRole('admin')).toBe(true);
        expect(isAdminRole('moderator')).toBe(true);
    });
    it('rejects user/unknown/empty', () => {
        expect(isAdminRole('user')).toBe(false);
        expect(isAdminRole(undefined)).toBe(false);
        expect(isAdminRole('')).toBe(false);
        expect(isAdminRole(null)).toBe(false);
    });
});

describe('getPostLoginRoute', () => {
    it('lands every role on the normal dashboard (admin is opt-in)', () => {
        expect(getPostLoginRoute('admin')).toBe('/dashboard');
        expect(getPostLoginRoute('moderator')).toBe('/dashboard');
        expect(getPostLoginRoute('user')).toBe('/dashboard');
        expect(getPostLoginRoute(undefined)).toBe('/dashboard');
        expect(getPostLoginRoute('')).toBe('/dashboard');
    });
});

describe('resolveAdminAccess', () => {
    it('allows admins/moderators', () => {
        expect(resolveAdminAccess('admin')).toBe('allow');
        expect(resolveAdminAccess('moderator')).toBe('allow');
    });
    it('denies known non-admins (URL poking)', () => {
        expect(resolveAdminAccess('user')).toBe('deny');
    });
    it('allows unknown role (legacy session — API still 403s)', () => {
        expect(resolveAdminAccess(undefined)).toBe('allow');
        expect(resolveAdminAccess(null)).toBe('allow');
    });
});
