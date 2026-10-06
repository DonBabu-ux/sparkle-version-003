export type AdminRole = 'admin' | 'moderator';

export function isAdminRole(role: string | null | undefined): role is AdminRole {
    return role === 'admin' || role === 'moderator';
}

export function getPostLoginRoute(role: string | null | undefined): string {
    return isAdminRole(role) ? '/admin' : '/dashboard';
}

/**
 * 'deny'  → known non-admin (URL poking)
 * 'allow' → admin/moderator, or role unknown (legacy session — the API
 *           still enforces 403 via adminMiddleware)
 */
export function resolveAdminAccess(role: string | null | undefined): 'allow' | 'deny' {
    if (role === null || role === undefined || role === '') return 'allow';
    return isAdminRole(role) ? 'allow' : 'deny';
}
