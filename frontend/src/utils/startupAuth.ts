/**
 * H23 — boot-time auth failure classification for App.tsx init.
 *
 * Only a definitive rejection of the session (401/403) may send the user to
 * /login. Timeouts, 5xx (e.g. DB outage → 503) and network failures are
 * transient: the session stays and the app boots anyway; later 401s run the
 * normal refresh → logout flow.
 */
export function isDefinitiveAuthFailure(err: unknown): boolean {
    const status = (err as { response?: { status?: number } } | null)?.response?.status;
    return status === 401 || status === 403;
}
