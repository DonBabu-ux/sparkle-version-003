export type AdminRole = 'admin' | 'moderator';

export function isAdminRole(role: string | null | undefined): role is AdminRole {
    return role === 'admin' || role === 'moderator';
}

/**
 * Post-login destination. Admins deliberately land on the normal dashboard —
 * the admin panel is reached on purpose via the Admin entry in the sidebar /
 * hamburger menu, not forced on every login (it also kept admins from ever
 * seeing their own feed after signing in).
 */
export function getPostLoginRoute(_role: string | null | undefined): string {
    return '/dashboard';
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
