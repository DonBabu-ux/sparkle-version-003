import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { adoptServerToken } from '../utils/tokenHeaderSync';
import { useUserStore } from '../store/userStore';

// Capacitor Preferences (zustand persist backend) touches `window` on writes —
// same stub as socketService.test.ts to keep persist writes from rejecting.
class MemoryStorage {
    private store = new Map<string, string>();
    getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
    setItem(k: string, v: string) { this.store.set(k, String(v)); }
    removeItem(k: string) { this.store.delete(k); }
    clear() { this.store.clear(); }
    key(i: number) { return [...this.store.keys()][i] ?? null; }
    get length() { return this.store.size; }
}
if (!('window' in globalThis)) {
    (globalThis as Record<string, unknown>).window = { localStorage: new MemoryStorage(), location: { origin: 'http://localhost:5173' } };
}

// H26 — auth.middleware re-signs the access token on every response once it is
// past half-life (x-refresh-token header), but the SPA never consumed it, so
// tokens only rotated inside a 30s expiry skew. Any blocked refresh window
// (DB outage → 503) then meant a hard expiry → 401 burst. The client must
// adopt the renewed header token into the store (idempotent, session-guarded).

const makeJwt = (expSecondsFromNow: number) => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(
        JSON.stringify({ userId: 'u1', role: 'user', exp: Math.floor(Date.now() / 1000) + expSecondsFromNow })
    );
    return `${header}.${payload}.sig`;
};

describe('adoptServerToken — x-refresh-token renewal (H26)', () => {
    beforeEach(() => {
        useUserStore.setState({ token: null, refreshToken: null, isAuthenticated: false });
    });

    it('adopts a renewed token from response headers into the store', () => {
        useUserStore.setState({ token: makeJwt(-60), refreshToken: 'r1', isAuthenticated: true });
        const renewed = makeJwt(86400);

        const adopted = adoptServerToken({ 'x-refresh-token': renewed });

        expect(adopted).toBe(renewed);
        expect(useUserStore.getState().token).toBe(renewed);
    });

    it('is idempotent: same token twice and missing header are no-ops', () => {
        const current = makeJwt(43200);
        useUserStore.setState({ token: current, refreshToken: 'r1', isAuthenticated: true });

        expect(adoptServerToken({ 'x-refresh-token': current })).toBeNull();
        expect(adoptServerToken({})).toBeNull();
        expect(adoptServerToken(undefined)).toBeNull();
        expect(adoptServerToken({ 'x-refresh-token': '' })).toBeNull();
        expect(useUserStore.getState().token).toBe(current);
    });

    it('rejects malformed header values (not a 3-segment JWT)', () => {
        useUserStore.setState({ token: makeJwt(43200), refreshToken: 'r1', isAuthenticated: true });

        expect(adoptServerToken({ 'x-refresh-token': 'garbage' })).toBeNull();
        expect(adoptServerToken({ 'x-refresh-token': 123 as unknown as string })).toBeNull();
        expect(useUserStore.getState().token).not.toBe('garbage');
    });

    it('never resurrects a logged-out session', () => {
        const expired = makeJwt(-60);
        useUserStore.setState({ token: expired, refreshToken: null, isAuthenticated: false });

        expect(adoptServerToken({ 'x-refresh-token': makeJwt(86400) })).toBeNull();
        expect(useUserStore.getState().token).toBe(expired); // untouched — no adoption
    });

    it('reads AxiosHeaders-style objects via .get() as well as plain maps', () => {
        useUserStore.setState({ token: makeJwt(-60), refreshToken: 'r1', isAuthenticated: true });
        const renewed = makeJwt(86400);
        const axiosLike = { get: (name: string) => (name === 'x-refresh-token' ? renewed : undefined) };

        expect(adoptServerToken(axiosLike)).toBe(renewed);
        expect(useUserStore.getState().token).toBe(renewed);
    });
});

describe('api.ts wiring — header adopted on fulfilled and error responses', () => {
    const apiSrc = readFileSync(new URL('../api/api.ts', import.meta.url), 'utf8');

    it('imports the adoption helper', () => {
        expect(apiSrc).toContain(`import { adoptServerToken } from '../utils/tokenHeaderSync';`);
    });

    it('adopts the header on fulfilled responses', () => {
        expect(apiSrc).toMatch(/adoptServerToken\(response\.headers\)/);
    });

    it('adopts the header on error responses too (renewals ride on 403/500)', () => {
        expect(apiSrc).toMatch(/adoptServerToken\(error\.response/);
    });
});
