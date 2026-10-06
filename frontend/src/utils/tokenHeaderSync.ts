import { useUserStore } from '../store/userStore';

// H26 — auth.middleware re-signs the access token on every response once it is
// past half-life and returns the renewal as an `x-refresh-token` header. The
// SPA must adopt it, otherwise tokens only rotate inside the last-30s skew and
// any blocked refresh window (DB outage → 503) turns into hard expiry → 401 burst.

function readHeader(headers: unknown): unknown {
    if (!headers || typeof headers !== 'object') return undefined;
    const h = headers as Record<string, unknown>;
    const direct = h['x-refresh-token'] ?? h['X-Refresh-Token'];
    if (direct !== undefined) return direct;
    const get = (h as { get?: (name: string) => unknown }).get;
    if (typeof get === 'function') {
        try {
            return get.call(headers, 'x-refresh-token');
        } catch {
            return undefined;
        }
    }
    return undefined;
}

/**
 * Adopt the server-issued renewal into the session store.
 * Idempotent (concurrent responses carry the same renewal), session-guarded
 * (never resurrects a logged-out session) and sanity-checked (3-segment JWT).
 * Returns the adopted token, or null when nothing was adopted.
 */
export function adoptServerToken(headers: unknown): string | null {
    const raw = readHeader(headers);
    if (typeof raw !== 'string' || raw.length === 0) return null;
    if (raw.split('.').length !== 3) return null;

    const store = useUserStore.getState();
    if (!store.isAuthenticated || !store.refreshToken) return null;
    if (store.token === raw) return null;

    store.setToken(raw, store.refreshToken);
    return raw;
}
