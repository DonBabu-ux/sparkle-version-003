export interface TokenPayload {
    userId?: string;
    email?: string;
    username?: string;
    role?: string;
    exp?: number;
    [key: string]: unknown;
}

export function decodeTokenPayload(token: string | null | undefined): TokenPayload | null {
    if (!token || typeof token !== 'string') return null;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(base64)) as TokenPayload;
    } catch {
        return null;
    }
}

export function getRoleFromToken(token: string | null | undefined): string | null {
    const payload = decodeTokenPayload(token);
    const role = payload?.role;
    return typeof role === 'string' && role.length > 0 ? role : null;
}
