import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../api/api', () => ({ default: { get: vi.fn() } }));

import api from '../../api/api';
import { fetchGiphyItems } from '../giphyClient';

const getMock = api.get as unknown as ReturnType<typeof vi.fn>;

describe('fetchGiphyItems — server-side Giphy proxy client (C2.1)', () => {
    beforeEach(() => {
        getMock.mockReset();
    });

    it('requests trending gifs through the proxy with type + limit', async () => {
        getMock.mockResolvedValue({ data: { data: [{ id: 'g1' }] } });
        const items = await fetchGiphyItems({ type: 'gifs', endpoint: 'trending', limit: 24 });
        expect(getMock).toHaveBeenCalledWith('/giphy/trending', { params: { type: 'gifs', limit: 24 } });
        expect(items).toEqual([{ id: 'g1' }]);
    });

    it('passes q for search and defaults the limit', async () => {
        getMock.mockResolvedValue({ data: { data: [] } });
        const items = await fetchGiphyItems({ type: 'stickers', endpoint: 'search', q: 'cat' });
        expect(getMock).toHaveBeenCalledWith('/giphy/search', { params: { type: 'stickers', limit: 24, q: 'cat' } });
        expect(items).toEqual([]);
    });

    it('omits q when not provided', async () => {
        getMock.mockResolvedValue({ data: { data: [{ id: 'x' }] } });
        await fetchGiphyItems({ type: 'gifs', endpoint: 'trending' });
        expect(getMock).toHaveBeenCalledWith('/giphy/trending', { params: { type: 'gifs', limit: 24 } });
    });

    it('treats a non-array body as empty', async () => {
        getMock.mockResolvedValue({ data: { nope: true } });
        await expect(fetchGiphyItems({ type: 'gifs', endpoint: 'trending' })).resolves.toEqual([]);
    });

    it('propagates proxy failures so callers can react', async () => {
        getMock.mockRejectedValue(new Error('boom'));
        await expect(fetchGiphyItems({ type: 'gifs', endpoint: 'trending' })).rejects.toThrow('boom');
    });
});
