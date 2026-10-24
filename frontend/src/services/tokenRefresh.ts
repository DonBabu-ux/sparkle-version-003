import axios from 'axios';
import { useUserStore } from '../store/userStore';
import { decodeTokenPayload } from '../utils/tokenUtils';
import { EnvironmentService } from './EnvironmentService';

const API_BASE = import.meta.env.VITE_API_URL || EnvironmentService.getApiBaseUrl();

let inflight: Promise<string> | null = null;

// Dead-session latch: after a definitive 4xx refresh failure, stop hitting
// /auth/refresh from every stray 401 (pollers, overlays, page loads) until a
// NEW token appears (fresh login). Without this, each late 401 fired its own
// cookie + body refresh attempt → the 401→refresh→400 console storm.
let sessionDead = false;
let deadToken: string | null = null;

/**
 * Single-flight access-token refresh shared by api.ts, AuthService and
 * socketService so only one rotation ever runs (a second concurrent refresh
 * with the same refresh token is rejected by the server).
 * - 4xx response → logout (session is definitively dead)
 * - network/5xx  → throw WITHOUT logout (transient; callers may retry)
 */
/** For testing only — resets the module-level dead-session latch. */
export function _resetSessionDeadForTesting(): void {
    sessionDead = false;
    deadToken = null;
    inflight = null;
}

export function refreshTokenOnce(): Promise<string> {
    if (inflight) return inflight;

    const preToken = useUserStore.getState().token;
    // If a new token has been placed in the store (e.g. after re-login), clear the latch.
    if (sessionDead && preToken && preToken !== deadToken) {
        sessionDead = false;
        deadToken = null;
    }
    if (sessionDead && (!preToken || preToken === deadToken)) {
        return Promise.reject(new Error('Session expired. Please log in again.'));
    }

    const run = (async () => {
        const { refreshToken, accounts } = useUserStore.getState();
        const multiAccount = accounts.length > 1;
        const postRefresh = (body?: { refreshToken: string }) =>
            axios.post(`${API_BASE}/auth/refresh`, body ?? {}, { withCredentials: true });

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
                // If a stored refreshToken exists in the user store, pass it directly —
                // this avoids the 400 that the backend returns when the body is empty and
                // there is no httpOnly sparkleRefresh cookie (our backend requires the token
                // in the body). Only use an empty-body cookie request when no stored token
                // is present (cookie-only session created by an older login flow).
                if (refreshToken) {
                    ({ data } = await postRefresh({ refreshToken }));
                } else {
                    ({ data } = await postRefresh());
                }
            }
            const newToken = data?.token || data?.accessToken;
            if (!newToken) throw new Error('Refresh response missing token');
            const newRefresh = data?.refreshToken || refreshToken;
            useUserStore.getState().setToken(newToken, newRefresh);
            sessionDead = false; // recovered (or a fresh login token worked)
            return newToken as string;
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 400 || status === 401 || status === 403) {
                sessionDead = true;
                deadToken = useUserStore.getState().token;
                useUserStore.getState().logout();
                // A definitive 4xx ends this session. logout() switches to another
                // stored account when one exists (isAuthenticated stays true); if it
                // didn't, the app is now unauthenticated and every further request
                // would just 401 against the dead-session latch. Send the user to
                // login instead of leaving them on a dead page.
                if (!useUserStore.getState().isAuthenticated && typeof window !== 'undefined') {
                    window.location.assign('/login');
                }
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
