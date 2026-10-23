import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
  registerPlugin: () => ({ saveToDownloads: vi.fn() }),
}));

import { downloadMedia, fetchMediaAsFile, guessMediaMime } from '../mediaDownload';

describe('guessMediaMime', () => {
  it('maps common extensions to MIME types', () => {
    expect(guessMediaMime('photo.JPG')).toBe('image/jpeg');
    expect(guessMediaMime('clip.mp4')).toBe('video/mp4');
    expect(guessMediaMime('note.pdf')).toBe('application/pdf');
    expect(guessMediaMime('song.m4a')).toBe('audio/mp4');
  });

  it('ignores query strings and falls back for unknown extensions', () => {
    expect(guessMediaMime('file.png?version=2')).toBe('image/png');
    expect(guessMediaMime('archive.xyz')).toBe('application/octet-stream');
    expect(guessMediaMime('')).toBe('application/octet-stream');
  });
});

describe('downloadMedia guards', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('rejects blob: URLs instead of fabricating a download', async () => {
    await expect(downloadMedia('blob:http://localhost/abc-123')).rejects.toThrow(
      /not available for download/i
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects data: URLs instead of fabricating a download', async () => {
    await expect(downloadMedia('data:image/png;base64,AAAA')).rejects.toThrow(
      /not available for download/i
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('rejects when the network download fails (no fake success)', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
    });
    await expect(downloadMedia('https://cdn.example.com/missing.jpg')).rejects.toThrow(/404/);
  });

  it('rejects when the fetched blob is empty (no fake success)', async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      blob: async () => new Blob([]),
    });
    await expect(downloadMedia('https://cdn.example.com/empty.jpg')).rejects.toThrow(/empty/i);
  });
});

describe('fetchMediaAsFile', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('wraps a successful fetch into a File with the response MIME type', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['x'], { type: 'image/png' }),
    }) as unknown as typeof fetch;

    const file = await fetchMediaAsFile('https://cdn.example.com/a.png', 'a.png');
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('a.png');
    expect(file.type).toBe('image/png');
  });

  it('rejects on non-OK responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403 }) as unknown as typeof fetch;
    await expect(fetchMediaAsFile('https://cdn.example.com/secret.jpg')).rejects.toThrow(/403/);
  });
});
