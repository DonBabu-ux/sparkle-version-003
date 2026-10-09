import api from '../api/api';

export type GiphyType = 'gifs' | 'stickers';
export type GiphyEndpoint = 'trending' | 'search';

export interface FetchGiphyOptions {
    type: GiphyType;
    endpoint: GiphyEndpoint;
    q?: string;
    limit?: number;
}

/**
 * Client for the server-side Giphy proxy (`/api/giphy/*`).
 * The API key lives only on the server (C2.1) — never call the Giphy API from here.
 */
export async function fetchGiphyItems(opts: FetchGiphyOptions): Promise<any[]> {
    const params: Record<string, string | number> = {
        type: opts.type,
        limit: opts.limit ?? 24,
    };
    if (opts.q) params.q = opts.q;
    const res = await api.get(`/giphy/${opts.endpoint}`, { params });
    const body = res?.data;
    return Array.isArray(body?.data) ? body.data : [];
}
