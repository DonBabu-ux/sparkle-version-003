import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

class MemoryStorage {
    private store = new Map<string, string>();
    getItem(k: string) {
        return this.store.has(k) ? this.store.get(k)! : null;
    }
    setItem(k: string, v: string) {
        this.store.set(k, String(v));
    }
    removeItem(k: string) {
        this.store.delete(k);
    }
    clear() {
        this.store.clear();
    }
    key(i: number) {
        return [...this.store.keys()][i] ?? null;
    }
    get length() {
        return this.store.size;
    }
}
vi.stubGlobal('localStorage', new MemoryStorage());
vi.stubGlobal('window', { localStorage: new MemoryStorage() });

vi.mock('axios');
import axios from 'axios';

const { refreshTokenOnce, ensureFreshAccessToken } = await import('../tokenRefresh');
const { useUserStore } = await import('../../store/userStore');

const mockedPost = vi.mocked(axios.post);

const okResponse = (token: string, refreshToken: string) => ({
    data: { status: 'success', token, refreshToken }
});

describe('tokenRefresh.refreshTokenOnce (single-flight)', () => {
    beforeEach(() => {
        mockedPost.mockReset();
        useUserStore.setState({
            token: 'old-access',
            refreshToken: 'refresh-1',
            isAuthenticated: true,
            user: null,
            accounts: [],
            activeAccountId: null
        });
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('concurrent callers trigger exactly ONE refresh POST and share the result', async () => {
        mockedPost.mockResolvedValue(okResponse('new-access', 'refresh-2'));
        const [a, b, c] = await Promise.all([
            refreshTokenOnce(),
            refreshTokenOnce(),
            refreshTokenOnce()
        ]);
        expect(mockedPost).toHaveBeenCalledTimes(1);
        expect(a).toBe('new-access');
        expect(b).toBe('new-access');
        expect(c).toBe('new-access');
        expect(useUserStore.getState().token).toBe('new-access');
        expect(useUserStore.getState().refreshToken).toBe('refresh-2');
    });

    it('cookie-first: single-account posts WITHOUT a body token (A.4 #2)', async () => {
        mockedPost.mockResolvedValue(okResponse('t2', 'refresh-3'));
        await refreshTokenOnce();
        expect(mockedPost.mock.calls[0][1]).toEqual({});
        expect(mockedPost.mock.calls[0][0]).toContain('/auth/refresh');
        // rotation still adopted from the response
        expect(useUserStore.getState().refreshToken).toBe('refresh-3');
        mockedPost.mockResolvedValueOnce(okResponse('t3', 'refresh-4'));
        await refreshTokenOnce();
        expect(mockedPost.mock.calls[1][1]).toEqual({});
        expect(useUserStore.getState().refreshToken).toBe('refresh-4');
    });

    it('cookie attempt 400 → falls back to the stored body token', async () => {
        mockedPost.mockRejectedValueOnce({ response: { status: 400 } });
        mockedPost.mockResolvedValueOnce(okResponse('t2', 'refresh-3'));
        await expect(refreshTokenOnce()).resolves.toBe('t2');
        expect(mockedPost).toHaveBeenCalledTimes(2);
        expect(mockedPost.mock.calls[0][1]).toEqual({});
        expect(mockedPost.mock.calls[1][1]).toEqual({ refreshToken: 'refresh-1' });
    });

    it('multi-account sessions always send the body token (names the account)', async () => {
        useUserStore.setState({
            accounts: [
                { user: { user_id: 'u1' } as never, token: 'a', refreshToken: 'refresh-1' },
                { user: { user_id: 'u2' } as never, token: 'b', refreshToken: 'other' }
            ]
        });
        mockedPost.mockResolvedValue(okResponse('t2', 'refresh-3'));
        await refreshTokenOnce();
        expect(mockedPost).toHaveBeenCalledTimes(1);
        expect(mockedPost.mock.calls[0][1]).toEqual({ refreshToken: 'refresh-1' });
    });

    it('definitive 401 → rejects AND logs out', async () => {
        mockedPost.mockRejectedValue({ response: { status: 401 } });
        await expect(refreshTokenOnce()).rejects.toBeTruthy();
        expect(useUserStore.getState().isAuthenticated).toBe(false);
    });

    it('network error → rejects but does NOT log the user out', async () => {
        mockedPost.mockRejectedValue(new TypeError('Failed to fetch'));
        await expect(refreshTokenOnce()).rejects.toThrow('Failed to fetch');
        expect(useUserStore.getState().isAuthenticated).toBe(true);
    });

    it('missing refresh token AND unusable cookie → rejects and logs out', async () => {
        useUserStore.setState({ refreshToken: null });
        // cookie-first attempt happens (no stored secret), server says no cookie
        mockedPost.mockRejectedValue({ response: { status: 400 } });
        await expect(refreshTokenOnce()).rejects.toThrow();
        expect(useUserStore.getState().isAuthenticated).toBe(false);
        expect(mockedPost).toHaveBeenCalledTimes(1);
        expect(mockedPost.mock.calls[0][1]).toEqual({});
    });

    it('posts to the configured API base /auth/refresh', async () => {
        mockedPost.mockResolvedValue(okResponse('t', 'r'));
        await refreshTokenOnce();
        expect(String(mockedPost.mock.calls[0][0])).toContain('/auth/refresh');
    });

    it('a rejected flight does not poison later refreshes', async () => {
        useUserStore.setState({ refreshToken: null });
        mockedPost.mockRejectedValue({ response: { status: 400 } });
        await expect(refreshTokenOnce()).rejects.toThrow();
        expect(useUserStore.getState().isAuthenticated).toBe(false);
        // relogin restores the session: cookie attempt fails (no cookie yet),
        // stored-token fallback succeeds
        useUserStore.setState({ refreshToken: 'refresh-after-relogin', isAuthenticated: true });
        mockedPost.mockReset();
        mockedPost.mockRejectedValueOnce({ response: { status: 400 } });
        mockedPost.mockResolvedValueOnce(okResponse('fresh', 'refresh-x'));
        await expect(refreshTokenOnce()).resolves.toBe('fresh');
        expect(mockedPost).toHaveBeenCalledTimes(2);
        expect(mockedPost.mock.calls[1][1]).toEqual({ refreshToken: 'refresh-after-relogin' });
    });
});

/** header.payload.sig with an exp claim — signature is irrelevant client-side. */
function mintJwt(payload: Record<string, unknown>): string {
    const b64 = (o: object) =>
        btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}
const expiringJwt = () => mintJwt({ exp: Math.floor(Date.now() / 1000) + 10 });

describe('tokenRefresh.ensureFreshAccessToken (boot freshness — H21)', () => {
    beforeEach(() => {
        mockedPost.mockReset();
        useUserStore.setState({
            token: 'old-access',
            refreshToken: 'refresh-1',
            isAuthenticated: true,
            user: null,
            accounts: [],
            activeAccountId: null
        });
    });

    it('fresh token (exp far ahead) → returned as-is, no refresh POST', async () => {
        const t = mintJwt({ exp: Math.floor(Date.now() / 1000) + 3600 });
        useUserStore.setState({ token: t });
        await expect(ensureFreshAccessToken()).resolves.toBe(t);
        expect(mockedPost).not.toHaveBeenCalled();
    });

    it('expiring token → refreshed once, new token returned', async () => {
        useUserStore.setState({ token: expiringJwt() });
        mockedPost.mockResolvedValue(okResponse('booted-access', 'refresh-2'));
        await expect(ensureFreshAccessToken(30_000)).resolves.toBe('booted-access');
        expect(mockedPost).toHaveBeenCalledTimes(1);
    });

    it('expiring + transient network error → OLD token, no logout', async () => {
        const t = expiringJwt();
        useUserStore.setState({ token: t });
        mockedPost.mockRejectedValue(new TypeError('Failed to fetch'));
        await expect(ensureFreshAccessToken(30_000)).resolves.toBe(t);
        expect(useUserStore.getState().isAuthenticated).toBe(true);
    });

    it('expiring + definitive 401 → null (session dead)', async () => {
        useUserStore.setState({ token: expiringJwt() });
        mockedPost.mockRejectedValue({ response: { status: 401 } });
        await expect(ensureFreshAccessToken(30_000)).resolves.toBeNull();
        expect(useUserStore.getState().isAuthenticated).toBe(false);
    });

    it('no access token → null, no POST', async () => {
        useUserStore.setState({ token: null });
        await expect(ensureFreshAccessToken()).resolves.toBeNull();
        expect(mockedPost).not.toHaveBeenCalled();
    });

    it('unparseable token (no exp) → returned as-is, no POST', async () => {
        useUserStore.setState({ token: 'not-a-jwt' });
        await expect(ensureFreshAccessToken(30_000)).resolves.toBe('not-a-jwt');
        expect(mockedPost).not.toHaveBeenCalled();
    });
});
