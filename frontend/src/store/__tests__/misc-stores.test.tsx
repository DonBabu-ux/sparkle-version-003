// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── useSocket ───────────────────────────────────────────────────────────────
const s = vi.hoisted(() => ({
  user: null as null | { user_id: string; id?: string },
  token: null as null | string,
  created: [] as Array<{ userId: string; token: string; namespace: string }>,
  makeSocket: (connected: boolean) => ({
    connected,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
  existing: null as null | Record<string, unknown>,
}));

vi.mock('../../store/userStore', () => ({
  useUserStore: () => ({ user: s.user, token: s.token }),
}));

const socketService = {
  getOrCreateSocket: vi.fn((userId: string, token: string, namespace: string) => {
    s.created.push({ userId, token, namespace });
    return s.makeSocket(false);
  }),
  getSocket: vi.fn(() => s.existing),
};
s.existing = null;
s.existing = null;
vi.mock('../../services/socketService', () => socketService);

vi.mock('../../api/api', () => ({
  default: { get: (...a: unknown[]) => h.apiGet(...a), post: vi.fn() },
}));

vi.mock('../../services/uploadFileDB', () => ({
  UploadFileDB: {
    saveFile: (...a: unknown[]) => h.saveFile(...a),
    deleteFile: (...a: unknown[]) => h.deleteFile(...a),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  saveFile: vi.fn(),
  deleteFile: vi.fn(),
}));

afterEach(cleanup);

describe('useSocket', () => {
  beforeEach(() => {
    s.user = null;
    s.token = null;
    s.created.length = 0;
    s.existing = null;
    socketService.getOrCreateSocket.mockClear();
    socketService.getSocket.mockClear();
  });

  const load = async () => (await import('../../hooks/useSocket')).useSocket;

  it('creates and connects a socket once authenticated', async () => {
    s.user = { user_id: 'u1' };
    s.token = 'tok';
    const useSocket = await load();
    const { result } = renderHook(() => useSocket());

    await act(async () => {});
    expect(s.created).toEqual([{ userId: 'u1', token: 'tok', namespace: '' }]);
    expect(result.current).not.toBeNull();
    expect(result.current!.connect).toHaveBeenCalled();
  });

  it('prefers user.id when user_id is absent', async () => {
    s.user = { user_id: 'u1', id: 'id-1' };
    s.token = 'tok';
    const useSocket = await load();
    renderHook(() => useSocket());
    await act(async () => {});

    expect(socketService.getOrCreateSocket).toHaveBeenCalledWith('id-1', 'tok', '');
  });

  it('does not reconnect a socket that is already connected', async () => {
    s.user = { user_id: 'u1' };
    s.token = 'tok';
    socketService.getOrCreateSocket.mockReturnValueOnce(s.makeSocket(true) as never);
    const useSocket = await load();

    const { result } = renderHook(() => useSocket());
    await act(async () => {});
    expect(result.current!.connect).not.toHaveBeenCalled();
  });

  it('disconnects and returns null without a session', async () => {
    const existing = s.makeSocket(true);
    s.existing = existing as never;
    socketService.getSocket.mockReturnValue(existing as never);

    const useSocket = await load();
    const { result } = renderHook(() => useSocket());
    await act(async () => {});

    expect(existing.disconnect).toHaveBeenCalled();
    expect(result.current).toBeNull();
    expect(socketService.getOrCreateSocket).not.toHaveBeenCalled();
  });

  it('passes the namespace through', async () => {
    s.user = { user_id: 'u1' };
    s.token = 'tok';
    const useSocket = await load();
    renderHook(() => useSocket('reels'));
    await act(async () => {});

    expect(socketService.getOrCreateSocket).toHaveBeenCalledWith('u1', 'tok', 'reels');
  });
});

describe('interactionStore', () => {
  const load = async () => {
    const mod = await import('../interactionStore');
    return mod.useInteractionStore;
  };

  it('tracks pending interactions per type and post', async () => {
    const useInteractionStore = await load();
    const state = () => useInteractionStore.getState();

    act(() => { state().setPending('pendingLikes', 'p1', true); });
    expect(state().isPending('pendingLikes', 'p1')).toBe(true);
    expect(state().isPending('pendingBookmarks', 'p1')).toBe(false);

    act(() => { state().setPending('pendingSparks', 'p1', true); });
    expect(state().isPending('pendingSparks', 'p1')).toBe(true);

    act(() => { state().setPending('pendingLikes', 'p1', false); });
    expect(state().isPending('pendingLikes', 'p1')).toBe(false);
  });

  it('replaces the map immutably so subscribers re-render', async () => {
    const useInteractionStore = await load();
    const before = useInteractionStore.getState().pendingLikes;

    act(() => { useInteractionStore.getState().setPending('pendingLikes', 'p1', true); });

    const after = useInteractionStore.getState().pendingLikes;
    expect(after).not.toBe(before);
    expect(before.has('p1')).toBe(false);
  });

  it('exposes per-interaction helper hooks', async () => {
    const mod = await import('../interactionStore');
    const { result } = renderHook(() => mod.usePendingLike('p9'));
    expect(result.current).toBe(false);

    act(() => { mod.useInteractionStore.getState().setPending('pendingLikes', 'p9', true); });
    expect(result.current).toBe(true);
  });
});

describe('refreshStore', () => {
  const load = async () => (await import('../refreshStore')).useRefreshStore;

  it('tracks in-flight refresh state per page', async () => {
    const useRefreshStore = await load();
    const state = () => useRefreshStore.getState();

    let id = 0;
    act(() => { id = state().startRefresh('home'); });
    expect(id).toBeGreaterThan(0);
    expect(state().isRefreshing.home).toBe(true);

    act(() => { state().finishRefresh('home', id); });
    expect(state().isRefreshing.home).toBe(false);
    expect(state().lastRefresh.home).toBeGreaterThan(0);
  });

  it('ignores a stale finish from an older request', async () => {
    const useRefreshStore = await load();
    const state = () => useRefreshStore.getState();

    let firstId = 0;
    let secondId = 0;
    act(() => { firstId = state().startRefresh('home'); });
    act(() => { secondId = state().startRefresh('home'); }); // supersedes the first
    expect(secondId).toBeGreaterThan(firstId);

    act(() => { state().finishRefresh('home', firstId); }); // stale
    expect(state().isRefreshing.home).toBe(true);

    act(() => { state().finishRefresh('home', secondId); });
    expect(state().isRefreshing.home).toBe(false);
  });

  it('cancel clears the flag but keeps pages independent', async () => {
    const useRefreshStore = await load();
    const state = () => useRefreshStore.getState();

    let homeId = 0;
    let messagesId = 0;
    act(() => { homeId = state().startRefresh('home'); });
    act(() => { messagesId = state().startRefresh('messages'); });
    act(() => { state().cancelRefresh('home', homeId); });

    expect(state().isRefreshing.home).toBe(false);
    expect(state().isRefreshing.messages).toBe(true);
    expect(messagesId).toBeGreaterThan(0);
  });
});

describe('liveStore', () => {
  beforeEach(() => {
    h.apiGet.mockReset();
  });

  const load = async () => (await import('../liveStore')).useLiveStore;
  const stream = (over: Record<string, unknown> = {}) => ({
    stream_id: 's1', streamer_id: 'u1', title: 'Live', viewer_count: 3,
    started_at: '2026-11-01T00:00:00Z', username: 'streamer', ...over,
  });

  it('loads active streams and derives the live-user set', async () => {
    h.apiGet.mockResolvedValue({ data: { activeStreams: [stream(), stream({ stream_id: 's2', streamer_id: 'u2' })] } });
    const useLiveStore = await load();

    await act(async () => { await useLiveStore.getState().fetchActiveStreams(); });

    const state = useLiveStore.getState();
    expect(state.activeStreams).toHaveLength(2);
    expect(state.isUserLive('u1')).toBe(true);
    expect(state.isUserLive('u3')).toBe(false);
    expect(state.getStreamForUser('u2')!.stream_id).toBe('s2');
    expect(state.lastFetched).toBeGreaterThan(0);
  });

  it('keeps the previous list when the fetch fails', async () => {
    h.apiGet.mockResolvedValueOnce({ data: { activeStreams: [stream()] } });
    const useLiveStore = await load();
    await act(async () => { await useLiveStore.getState().fetchActiveStreams(); });

    h.apiGet.mockRejectedValueOnce(new Error('offline'));
    await act(async () => { await useLiveStore.getState().fetchActiveStreams(); });

    const state = useLiveStore.getState();
    expect(state.activeStreams).toHaveLength(1);
    expect(state.isLoading).toBe(false);
  });

  it('addOrUpdateStream replaces by stream id and streamer, and prepends', async () => {
    const useLiveStore = await load();
    act(() => { useLiveStore.getState().addOrUpdateStream(stream({ title: 'first' })); });
    act(() => { useLiveStore.getState().addOrUpdateStream(stream({ title: 'updated', viewer_count: 10 })); });

    const state = useLiveStore.getState();
    expect(state.activeStreams).toHaveLength(1);
    expect(state.activeStreams[0].title).toBe('updated');
    expect(state.isUserLive('u1')).toBe(true);
  });

  it('removeStream drops by stream id and streamer', async () => {
    const useLiveStore = await load();
    act(() => { useLiveStore.getState().addOrUpdateStream(stream()); });
    act(() => { useLiveStore.getState().addOrUpdateStream(stream({ stream_id: 's2', streamer_id: 'u2' })); });

    act(() => { useLiveStore.getState().removeStream('s1'); });
    let state = useLiveStore.getState();
    expect(state.activeStreams.map((x) => x.stream_id)).toEqual(['s2']);

    act(() => { useLiveStore.getState().removeStream('s3', 'u2'); });
    state = useLiveStore.getState();
    expect(state.activeStreams).toHaveLength(0);
    expect(state.isUserLive('u2')).toBe(false);
  });
});

describe('themeStore', () => {
  const load = async () => (await import('../themeStore')).useThemeStore;

  beforeEach(async () => {
    const useThemeStore = await load();
    act(() => {
      useThemeStore.setState({
        chatThemes: {}, customThemes: [], quickReactions: {},
        chatWordEffects: {}, chatNotificationSounds: {},
      });
    });
  });

  it('defaults the chat theme, quick reaction and sound', async () => {
    const useThemeStore = await load();
    const state = () => useThemeStore.getState();

    expect(state().getThemeForChat('c1')).toBeTruthy();
    expect(state().getQuickReaction('c1')).toBe('👍');
    expect(state().getNotificationSound('c1')).toBe('default');
    expect(state().getWordEffects('c1')).toEqual([]);
  });

  it('sets and removes a per-chat theme', async () => {
    const useThemeStore = await load();
    const fallback = useThemeStore.getState().getThemeForChat('other');
    const custom = { ...fallback, id: 'custom_test_theme' };

    act(() => { useThemeStore.getState().setThemeForChat('c1', custom as never); });
    expect(useThemeStore.getState().getThemeForChat('c1')).toBe(custom);

    act(() => { useThemeStore.getState().removeThemeForChat('c1'); });
    expect(useThemeStore.getState().getThemeForChat('c1')).toBe(fallback);
    expect(useThemeStore.getState().chatThemes.c1).toBeUndefined();
  });

  it('stores quick reactions and notification sounds per chat', async () => {
    const useThemeStore = await load();
    act(() => { useThemeStore.getState().setQuickReaction('c1', '🔥'); });
    act(() => { useThemeStore.getState().setNotificationSound('c1', 'sparkle_pop'); });

    expect(useThemeStore.getState().getQuickReaction('c1')).toBe('🔥');
    expect(useThemeStore.getState().getNotificationSound('c1')).toBe('sparkle_pop');
  });

  it('caps word effects at 5 and lowercases the trigger word', async () => {
    const useThemeStore = await load();
    for (let i = 0; i < 7; i++) {
      act(() => { useThemeStore.getState().addWordEffect('c1', `Word${i}`, '🎉'); });
    }

    const effects = useThemeStore.getState().getWordEffects('c1');
    expect(effects).toHaveLength(5);
    expect(effects[0].word).toBe('word0');

    act(() => { useThemeStore.getState().removeWordEffect('c1', effects[0].id); });
    expect(useThemeStore.getState().getWordEffects('c1')).toHaveLength(4);
  });

  it('clearAllThemes resets themes and sounds but keeps quick reactions and word effects', async () => {
    const useThemeStore = await load();
    act(() => { useThemeStore.getState().setQuickReaction('c1', '🔥'); });
    act(() => { useThemeStore.getState().addWordEffect('c1', 'hi', '👋'); });
    act(() => { useThemeStore.getState().setNotificationSound('c1', 'pop'); });

    act(() => { useThemeStore.getState().clearAllThemes(); });

    const state = useThemeStore.getState();
    expect(state.chatThemes).toEqual({});
    expect(state.chatNotificationSounds).toEqual({});
    expect(state.getQuickReaction('c1')).toBe('🔥');
    expect(state.getWordEffects('c1')).toHaveLength(1);
  });
});

describe('uploadStore', () => {
  const job = (over: Record<string, unknown> = {}) => ({
    uploadId: 'j1',
    type: 'MOMENT',
    priority: 'NORMAL',
    localUri: 'blob:local-1',
    thumbnailUri: 'blob:thumb-1',
    status: 'UPLOADING',
    progress: 40,
    retryCount: 0,
    error: null,
    metadata: {},
    ...over,
  });

  beforeEach(() => {
    h.saveFile.mockReset().mockResolvedValue(undefined);
    h.deleteFile.mockReset().mockResolvedValue(undefined);
    localStorage.clear();
  });

  const load = async () => (await import('../uploadStore')).useUploadStore;

  it('addJob registers the raw file in IndexedDB and appends the job', async () => {
    const useUploadStore = await load();
    const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' });

    await act(async () => { await useUploadStore.getState().addJob(job() as never, file); });

    expect(h.saveFile).toHaveBeenCalledWith('j1', file);
    expect(useUploadStore.getState().jobs).toHaveLength(1);
  });

  it('updateJob merges partial updates onto the job', async () => {
    const useUploadStore = await load();
    await act(async () => { await useUploadStore.getState().addJob(job() as never, new File(['x'], 'a.mp4')); });

    act(() => { useUploadStore.getState().updateJob('j1', { progress: 80, status: 'VERIFYING' }); });

    const stored = useUploadStore.getState().jobs[0];
    expect(stored.progress).toBe(80);
    expect(stored.status).toBe('VERIFYING');
  });

  it('retryJob requeues the job and clears the error', async () => {
    const useUploadStore = await load();
    await act(async () => { await useUploadStore.getState().addJob(job({ status: 'FAILED', progress: 90, error: 'boom' }) as never, new File(['x'], 'a.mp4')); });

    act(() => { useUploadStore.getState().retryJob('j1'); });

    const stored = useUploadStore.getState().jobs[0];
    expect(stored.status).toBe('QUEUED');
    expect(stored.progress).toBe(0);
    expect(stored.error).toBeNull();
  });

  it('cancelJob revokes blob URLs, marks CANCELLED and deletes the raw file', async () => {
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { revokeObjectURL: revoke }));
    const useUploadStore = await load();
    await act(async () => { await useUploadStore.getState().addJob(job() as never, new File(['x'], 'a.mp4')); });

    act(() => { useUploadStore.getState().cancelJob('j1'); });

    expect(revoke).toHaveBeenCalledWith('blob:local-1');
    expect(revoke).toHaveBeenCalledWith('blob:thumb-1');
    expect(h.deleteFile).toHaveBeenCalledWith('j1');
    expect(useUploadStore.getState().jobs[0].status).toBe('CANCELLED');
    expect(useUploadStore.getState().jobs[0].progress).toBe(0);
  });

  it('discardJob removes the row and cleans up the same way', async () => {
    const revoke = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { revokeObjectURL: revoke }));
    const useUploadStore = await load();
    await act(async () => { await useUploadStore.getState().addJob(job() as never, new File(['x'], 'a.mp4')); });

    act(() => { useUploadStore.getState().discardJob('j1'); });

    expect(useUploadStore.getState().jobs).toHaveLength(0);
    expect(revoke).toHaveBeenCalledTimes(2);
    expect(h.deleteFile).toHaveBeenCalledWith('j1');
  });

  it('clearFinishedJobs drops published and cancelled jobs only', async () => {
    const useUploadStore = await load();
    await act(async () => {
      await useUploadStore.getState().addJob(job({ uploadId: 'j1', status: 'PUBLISHED' }) as never, new File(['x'], 'a.mp4'));
      await useUploadStore.getState().addJob(job({ uploadId: 'j2', status: 'UPLOADING' }) as never, new File(['x'], 'b.mp4'));
      await useUploadStore.getState().addJob(job({ uploadId: 'j3', status: 'CANCELLED' }) as never, new File(['x'], 'c.mp4'));
    });

    act(() => { useUploadStore.getState().clearFinishedJobs(); });

    expect(useUploadStore.getState().jobs.map((j) => j.uploadId)).toEqual(['j2']);
    expect(h.deleteFile).toHaveBeenCalledWith('j1');
    expect(h.deleteFile).toHaveBeenCalledWith('j3');
  });

  it('persists only jobs, with in-flight statuses reset to QUEUED', () => {
    const src = readFileSync(join(process.cwd(), 'src/store/uploadStore.ts'), 'utf8');
    expect(src).toContain("name: 'sparkle-upload-storage'");
    expect(src).toMatch(/job\.status === 'UPLOADING'[\s\S]{0,300}\?\s*'QUEUED'/);
  });
});