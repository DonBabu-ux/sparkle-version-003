import { describe, it, expect, vi, beforeEach } from 'vitest';

class MemoryStorage {
    private store = new Map<string, string>();
    getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
    setItem(k: string, v: string) { this.store.set(k, String(v)); }
    removeItem(k: string) { this.store.delete(k); }
    clear() { this.store.clear(); }
    key(i: number) { return [...this.store.keys()][i] ?? null; }
    get length() { return this.store.size; }
}
vi.stubGlobal('localStorage', new MemoryStorage());
vi.stubGlobal('window', {
    localStorage: new MemoryStorage(),
    location: { origin: 'http://localhost:5173' }
});

const h = vi.hoisted(() => {
    const handlers: Record<string, (...args: unknown[]) => unknown> = {};
    const socket = {
        on: vi.fn((ev: string, cb: (...args: unknown[]) => unknown) => { handlers[ev] = cb; }),
        connect: vi.fn(),
        disconnect: vi.fn()
    };
    return {
        handlers,
        socket,
        ioMock: vi.fn(() => socket),
        refreshTokenOnce: vi.fn(() => Promise.resolve('fresh-token')),
        ensureFreshAccessToken: vi.fn(() => Promise.resolve(null))
    };
});

vi.mock('socket.io-client', () => ({ io: h.ioMock }));
vi.mock('../tokenRefresh', () => ({
    refreshTokenOnce: (...a: unknown[]) => h.refreshTokenOnce(...a),
    ensureFreshAccessToken: (...a: unknown[]) => h.ensureFreshAccessToken(...a)
}));

const { createSocket } = await import('../socketService');
const { useUserStore } = await import('../../store/userStore');

const flush = () => new Promise(r => setTimeout(r, 0));

describe('socketService connect_error handling (H23)', () => {
    beforeEach(() => {
        if (h.handlers) Object.keys(h.handlers).forEach(k => delete h.handlers[k]);
        h.socket.connect.mockClear();
        h.socket.disconnect.mockClear();
        h.socket.on.mockClear();
        h.refreshTokenOnce.mockClear();
        h.ensureFreshAccessToken.mockClear();
        h.ioMock.mockClear();
    });

    it('logged-out session: auth error stops the retry loop without console.error spam', async () => {
        useUserStore.setState({ token: null, refreshToken: null, isAuthenticated: false });
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const s = createSocket('user-logged-out', 'ignored') as unknown as typeof h.socket;
        await flush();
        const handler = h.handlers['connect_error'];
        expect(handler).toBeTruthy();
        await handler(new Error('Invalid token'));

        expect(s.disconnect).toHaveBeenCalled();
        expect(h.refreshTokenOnce).not.toHaveBeenCalled();
        expect(errSpy).not.toHaveBeenCalled();

        errSpy.mockRestore();
        warnSpy.mockRestore();
    });

    it('authenticated session: auth error still refreshes and reconnects', async () => {
        useUserStore.setState({ token: 'old-token', refreshToken: 'r1', isAuthenticated: true });
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const s = createSocket('user-authed', 'tok') as unknown as typeof h.socket;
        await flush();
        s.connect.mockClear();
        await h.handlers['connect_error'](new Error('Invalid token'));

        expect(h.refreshTokenOnce).toHaveBeenCalledTimes(1);
        expect(s.connect).toHaveBeenCalled();
        // H26: auth-class rejections are self-healing (refresh + reconnect) →
        // warn level only, no red console.error + stack.
        expect(errSpy).not.toHaveBeenCalled();

        errSpy.mockRestore();
        warnSpy.mockRestore();
    });

    it('authenticated non-auth (network) error leaves reconnection to socket.io', async () => {
        useUserStore.setState({ token: 'old-token', refreshToken: 'r1', isAuthenticated: true });
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const s = createSocket('user-net', 'tok') as unknown as typeof h.socket;
        await flush();
        s.connect.mockClear();
        s.disconnect.mockClear();
        await h.handlers['connect_error'](new Error('xhr poll error'));

        expect(h.refreshTokenOnce).not.toHaveBeenCalled();
        expect(s.disconnect).not.toHaveBeenCalled();
        // Genuine unexpected (network) failures stay at error level.
        expect(errSpy).toHaveBeenCalled();

        errSpy.mockRestore();
        warnSpy.mockRestore();
    });

    it('ServiceUnavailable (DB blip): no refresh, no red error, no disconnect — socket.io retries', async () => {
        useUserStore.setState({ token: 'old-token', refreshToken: 'r1', isAuthenticated: true });
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const s = createSocket('user-db-down', 'tok') as unknown as typeof h.socket;
        await flush();
        s.connect.mockClear();
        s.disconnect.mockClear();
        await h.handlers['connect_error'](new Error('ServiceUnavailable'));

        expect(h.refreshTokenOnce).not.toHaveBeenCalled();
        expect(s.disconnect).not.toHaveBeenCalled();
        expect(errSpy).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalled();

        errSpy.mockRestore();
        warnSpy.mockRestore();
    });

    it('known-expired token: connect deferred with warn (no ❌ burst), retries and connects once fresh', async () => {
        vi.useFakeTimers();
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const b64 = (o: unknown) => btoa(JSON.stringify(o));
            const expired = `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) - 60 })}.sig`;
            const fresh = `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) + 86400 })}.sig`;
            useUserStore.setState({ token: expired, refreshToken: 'r1', isAuthenticated: true });
            // Transient refresh failure → ensureFresh returns the old, expired token (H26 contract)
            h.ensureFreshAccessToken.mockResolvedValueOnce(null);

            const s = createSocket('user-expired-defer', 'tok') as unknown as typeof h.socket;
            await vi.advanceTimersByTimeAsync(0);

            expect(s.connect).not.toHaveBeenCalled();
            expect(warnSpy).toHaveBeenCalled();

            // DB recovered → deferred retry gets a fresh token and connects
            h.ensureFreshAccessToken.mockResolvedValueOnce(fresh);
            await vi.advanceTimersByTimeAsync(5000);

            expect(s.connect).toHaveBeenCalled();
            expect(errSpy).not.toHaveBeenCalled();
        } finally {
            errSpy.mockRestore();
            warnSpy.mockRestore();
            vi.clearAllTimers();
            vi.useRealTimers();
        }
    });

    it('logged out during deferral: pending retry stops without reconnecting', async () => {
        vi.useFakeTimers();
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        try {
            const b64 = (o: unknown) => btoa(JSON.stringify(o));
            const expired = `${b64({ alg: 'HS256' })}.${b64({ exp: Math.floor(Date.now() / 1000) - 60 })}.sig`;
            useUserStore.setState({ token: expired, refreshToken: 'r1', isAuthenticated: true });
            h.ensureFreshAccessToken.mockResolvedValueOnce(null);

            const s = createSocket('user-expired-logout', 'tok') as unknown as typeof h.socket;
            await vi.advanceTimersByTimeAsync(0);
            expect(s.connect).not.toHaveBeenCalled();

            useUserStore.setState({ token: null, refreshToken: null, isAuthenticated: false });
            await vi.advanceTimersByTimeAsync(5000);

            expect(s.connect).not.toHaveBeenCalled();
            expect(errSpy).not.toHaveBeenCalled();
        } finally {
            errSpy.mockRestore();
            warnSpy.mockRestore();
            vi.clearAllTimers();
            vi.useRealTimers();
        }
    });
});
