export interface ResetLinkParams {
    email: string;
    code: string;
}

function safeDecode(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function parsePairs(raw: string): Record<string, string> {
    const out: Record<string, string> = {};
    const cleaned = raw.replace(/^[#?]/, '');
    if (!cleaned) return out;
    for (const kv of cleaned.split('&')) {
        const i = kv.indexOf('=');
        if (i < 0) continue;
        out[safeDecode(kv.slice(0, i))] = safeDecode(kv.slice(i + 1));
    }
    return out;
}

/**
 * Reads reset/verify credentials from a URL.
 * New links carry them in the fragment (#email=…&code=…) so they never reach
 * the server or Referer headers; legacy in-flight ?query links still work.
 */
export function parseResetLinkParams(hash: string, search: string): ResetLinkParams {
    const frag = parsePairs(hash);
    const query = parsePairs(search);
    const email = frag.email || query.email || '';
    const code = frag.code || query.code || query.token || '';
    return { email, code };
}
