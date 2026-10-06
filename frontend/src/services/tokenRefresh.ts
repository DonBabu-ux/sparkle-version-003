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
        const refreshToken = useUserStore.getState().refreshToken;
        if (!refreshToken) {
            useUserStore.getState().logout();
            throw new Error('No refresh token available. Please login.');
        }
        try {
            const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
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
    const { token, refreshToken } = useUserStore.getState();
    if (!token) return null;

    const payload = decodeTokenPayload(token);
    if (!payload || typeof payload.exp !== 'number') return token;
    if (payload.exp * 1000 > Date.now() + minSkewMs) return token;
    if (!refreshToken) return token;

    try {
        return await refreshTokenOnce();
    } catch {
        // refreshTokenOnce logs out on definitive failures; transient ones keep the session
        if (!useUserStore.getState().isAuthenticated) return null;
        return useUserStore.getState().token;
    }
}
