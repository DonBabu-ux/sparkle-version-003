import axios from 'axios';
import { useUserStore } from '../store/userStore';
import { decodeTokenPayload } from '../utils/tokenUtils';
import { EnvironmentService } from './EnvironmentService';

const API_BASE = import.meta.env.VITE_API_URL || EnvironmentService.getApiBaseUrl();

let inflight: Promise<string> | null = null;

/**
 * Single-flight access-token refresh shared by api.ts, AuthService and
 * socketService so only one rotation ever runs (a second concurrent refresh
 * with the same refresh token is rejected by the server).
 * - 4xx response → logout (session is definitively dead)
 * - network/5xx  → throw WITHOUT logout (transient; callers may retry)
 */
export function refreshTokenOnce(): Promise<string> {
    if (inflight) return inflight;

    const run = (async () => {
        const { refreshToken, accounts } = useUserStore.getState();
        const multiAccount = accounts.length > 1;
        const postRefresh = (body?: { refreshToken: string }) =>
            axios.post(`${API_BASE}/auth/refresh`, body ?? {});

        try {
            let data: { token?: string; accessToken?: string; refreshToken?: string };
            if (multiAccount) {
                // Multi-account: the body token names WHICH account to refresh
                // (the httpOnly cookie can only hold the active session).
                if (!refreshToken) {
                    useUserStore.getState().logout();
                    throw new Error('No refresh token available. Please login.');
                }
                ({ data } = await postRefresh({ refreshToken }));
            } else {
                // A.4 #2 cookie-first: single-account sessions refresh through
                // the httpOnly sparkleRefresh cookie so JS never touches the
                // secret. The stored body token is the fallback for legacy
                // sessions (no cookie yet) and cookie eviction.
                try {
                    ({ data } = await postRefresh());
                } catch (err) {
                    const status = (err as { response?: { status?: number } })?.response?.status;
                    const noUsableCookie = status === 400 || status === 401 || status === 403;
                    if (!noUsableCookie || !refreshToken) throw err;
                    ({ data } = await postRefresh({ refreshToken }));
                }
            }
            const newToken = data?.token || data?.accessToken;
            if (!newToken) throw new Error('Refresh response missing token');
            const newRefresh = data?.refreshToken || refreshToken;
            useUserStore.getState().setToken(newToken, newRefresh);
            return newToken as string;
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 400 || status === 401 || status === 403) {
                useUserStore.getState().logout();
                throw err instanceof Error ? err : new Error('Session expired. Please log in again.');
            }
            throw err instanceof Error ? err : new Error(String(err));
        }
    })();

    inflight = run;
    // Always release the slot — a rejected flight must not poison future refreshes
    run.finally(() => { inflight = null; }).catch(() => {});
    return run;
}

/**
 * H21 — boot freshness: make sure requests that fire during startup
 * (validate, feed, notifications, socket connect) never start with an
 * expired access token, so the console/interceptors don't see a 401 burst.
 *
 * - token with exp > skew in the future → returned untouched (no HTTP)
 * - token expiring/expired (or exp unreadable is skipped: no exp → no rotation)
 *   → single-flight refresh
 * - refresh definitively dead (4xx / logged out) → null
 * - refresh transiently failed → old token returned, session kept
 */
export async function ensureFreshAccessToken(minSkewMs = 60_000): Promise<string | null> {
    const { token } = useUserStore.getState();
    if (!token) return null;

    const payload = decodeTokenPayload(token);
    if (!payload || typeof payload.exp !== 'number') return token;
    if (payload.exp * 1000 > Date.now() + minSkewMs) return token;
    // A.4 #2: no stored refresh secret does NOT mean the session is dead —
    // a cookie-mode session refreshes through the httpOnly cookie instead
    // (refreshTokenOnce attempts the cookie and only logs out on a definitive
    // 4xx). Previously this returned the stale token and forced a 401 burst.

    try {
        return await refreshTokenOnce();
    } catch {
        // refreshTokenOnce logs out on definitive failures; transient ones keep the session
        if (!useUserStore.getState().isAuthenticated) return null;
        return useUserStore.getState().token;
    }
}
