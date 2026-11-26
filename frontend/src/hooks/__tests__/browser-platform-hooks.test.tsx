// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

// ── mocks ──────────────────────────────────────────────────────────────────
vi.mock('../useSocket', () => ({ useSocket: () => h.current.socket }));

vi.mock('../../store/userStore', () => ({
  useUserStore: Object.assign(
    (sel: (s: unknown) => unknown) => sel(h.userState),
    { getState: () => ({ user: h.userState.user }) }
  ),
}));

vi.mock('../../api/api', () => ({
  default: { post: (...a: unknown[]) => h.apiPost(...a), get: vi.fn() },
}));

vi.mock('../../store/marketplaceStore', () => ({
  useMarketplaceStore: () => ({ setFilters: h.setFilters }),
}));

vi.mock('../../utils/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: { requestPermissions: () => h.localNotifications.requestPermissions() },
}));
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: { requestPermissions: () => h.pushNotifications.requestPermissions() },
}));
vi.mock('@capacitor/camera', () => ({
  Camera: { requestPermissions: (o: unknown) => h.camera.requestPermissions(o) },
}));

vi.mock('react-router-dom', () => ({ useNavigate: () => h.navigate }));

vi.mock('../../store/notificationStore', () => ({
  useNotificationStore: (sel: (s: unknown) => unknown) => sel({ markRead: h.markRead, markAllRead: h.markAllRead }),
}));

const h = vi.hoisted(() => {
  const localNotifications = { requestPermissions: vi.fn(async () => ({ display: 'granted' })) };
  const pushNotifications = { requestPermissions: vi.fn(async () => ({ receive: 'granted' })) };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const camera = { requestPermissions: vi.fn(async (_o?: unknown) => ({ camera: 'granted', photos: 'granted' })) };
  const userState = { user: { user_id: 'me', id: 'me' }, isAuthenticated: true };
  const current = { socket: null as unknown };
  return {
    localNotifications,
    pushNotifications,
    camera,
    userState,
    current,
    apiPost: vi.fn(),
    setFilters: vi.fn(),
    navigate: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllTimers();
});

// ── browser API stubs ──────────────────────────────────────────────────────
const stubGeolocation = (impl: (ok: (p: unknown) => void, err: (e: unknown) => void) => void) => {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { getCurrentPosition: vi.fn(impl) },
  });
};

const removeGeolocation = () => {
  // The hook tests `'geolocation' in navigator` — the property must be gone,
  // not defined-as-undefined.
  delete (navigator as unknown as { geolocation?: unknown }).geolocation;
};

const stubMediaDevices = (impl: () => Promise<unknown>) => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(impl) },
  });
};

describe('useLocationDetection', () => {
  beforeEach(() => {
    h.apiPost.mockReset().mockResolvedValue({ data: { success: true, location: { lat: -1.3, lng: 36.8, name: 'Nairobi', source: 'gps' } } });
    h.setFilters.mockReset();
    localStorage.clear();
  });

  const load = async () => (await import('../useLocationDetection')).useLocationDetection;

  it('applies the cached location immediately, then refines via GPS + backend', async () => {
    localStorage.setItem('sparkle_last_location', JSON.stringify({ lat: 0, lng: 0, name: 'Cached' }));
    let resolvePosition: (p: unknown) => void = () => {};
    stubGeolocation((ok) => { resolvePosition = ok; });

    const useLocationDetection = await load();
    const { result } = renderHook(() => useLocationDetection());

    act(() => { result.current.detectLocation(); });
    expect(h.setFilters).toHaveBeenCalledWith({ location: { lat: 0, lng: 0, name: 'Cached' } });

    await act(async () => {
      resolvePosition({ coords: { latitude: -1.3, longitude: 36.8 } });
    });

    expect(h.apiPost).toHaveBeenCalledWith('/location/resolve', { lat: -1.3, lon: 36.8 });
    expect(h.setFilters).toHaveBeenLastCalledWith({
      location: { lat: -1.3, lng: 36.8, name: 'Nairobi', source: 'gps' },
    });
    expect(JSON.parse(localStorage.getItem('sparkle_last_location')!)).toMatchObject({ name: 'Nairobi' });
  });

  it('falls back to IP resolution when GPS fails', async () => {
    let rejectPosition: (e: unknown) => void = () => {};
    stubGeolocation((_ok, err) => { rejectPosition = err; });

    const useLocationDetection = await load();
    const { result } = renderHook(() => useLocationDetection());

    act(() => { result.current.detectLocation(); });
    await act(async () => { rejectPosition({ message: 'denied' }); });

    expect(h.apiPost).toHaveBeenCalledWith('/location/resolve', {});
  });

  it('falls back to IP resolution when the geolocation API is absent', async () => {
    removeGeolocation();
    const useLocationDetection = await load();
    const { result } = renderHook(() => useLocationDetection());

    act(() => { result.current.detectLocation(); });
    await act(async () => {});

    expect(h.apiPost).toHaveBeenCalledWith('/location/resolve', {});
  });

  it('drops a corrupt cache entry and continues to a valid resolution', async () => {
    localStorage.setItem('sparkle_last_location', '{not json');
    stubGeolocation((_ok, err) => err({ message: 'denied' }));

    const useLocationDetection = await load();
    const { result } = renderHook(() => useLocationDetection());

    act(() => { result.current.detectLocation(); });
    await act(async () => {});

    // The corrupt entry is discarded and the successful fallback replaces it.
    expect(JSON.parse(localStorage.getItem('sparkle_last_location')!)).toMatchObject({ name: 'Nairobi' });
    expect(h.setFilters).toHaveBeenCalledWith({
      location: { lat: -1.3, lng: 36.8, name: 'Nairobi', source: 'gps' },
    });
  });

  it('logs and stays put when the backend resolution fails', async () => {
    const { logger } = await import('../../utils/logger');
    h.apiPost.mockRejectedValue(new Error('offline'));
    removeGeolocation();

    const useLocationDetection = await load();
    const { result } = renderHook(() => useLocationDetection());

    act(() => { result.current.detectLocation(); });
    await act(async () => {});

    expect(vi.mocked(logger.error)).toHaveBeenCalled();
    expect(h.setFilters).not.toHaveBeenCalled();
  });
});

describe('useAppPermissions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    h.localNotifications.requestPermissions.mockReset().mockResolvedValue({ display: 'granted' });
    h.pushNotifications.requestPermissions.mockReset().mockResolvedValue({ receive: 'granted' });
    h.camera.requestPermissions.mockReset().mockResolvedValue({ camera: 'granted', photos: 'granted' });
    h.userState.isAuthenticated = true;
    localStorage.clear();
  });
  afterEach(() => vi.useRealTimers());

  const load = async () => {
    const mod = await import('../useAppPermissions');
    return { useAppPermissions: mod.useAppPermissions, requestAppPermissionsOnce: mod.requestAppPermissionsOnce };
  };

  it('runs the one-time pass and persists the results', async () => {
    const stop = vi.fn();
    stubMediaDevices(async () => ({ getTracks: () => [{ stop }] }));

    const { requestAppPermissionsOnce } = await load();
    act(() => { requestAppPermissionsOnce(); });

    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });

    expect(h.localNotifications.requestPermissions).toHaveBeenCalledTimes(1);
    expect(h.pushNotifications.requestPermissions).toHaveBeenCalledTimes(1);
    expect(h.camera.requestPermissions).toHaveBeenCalledWith({ permissions: ['camera', 'photos'] });
    expect(stop).toHaveBeenCalled();

    const persisted = JSON.parse(localStorage.getItem('sparkle_app_permissions_v1') || '{}');
    expect(persisted.results).toMatchObject({
      localNotifications: 'granted', push: 'granted', camera: 'granted', photos: 'granted',
      microphone: 'granted', webCamera: 'granted',
    });
  });

  it('never re-runs once the flag is written', async () => {
    localStorage.setItem('sparkle_app_permissions_v1', '{"at":"2026-01-01","results":{}}');
    const { requestAppPermissionsOnce } = await load();

    act(() => { requestAppPermissionsOnce(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    expect(h.localNotifications.requestPermissions).not.toHaveBeenCalled();
  });

  it('keeps going when one plugin fails (individual failures never abort)', async () => {
    h.camera.requestPermissions.mockRejectedValue(new Error('plugin missing'));
    stubMediaDevices(async () => ({ getTracks: () => [{ stop: vi.fn() }] }));

    const { requestAppPermissionsOnce } = await load();
    act(() => { requestAppPermissionsOnce(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });

    const persisted = JSON.parse(localStorage.getItem('sparkle_app_permissions_v1') || '{}');
    expect(persisted.results.camera).toBe('unavailable');
    expect(persisted.results.localNotifications).toBe('granted');
    expect(persisted.results.microphone).toBe('granted');
  });

  it('maps a blocked getUserMedia probe to denied', async () => {
    stubMediaDevices(async () => {
      const err = new Error('blocked');
      err.name = 'NotAllowedError';
      throw err;
    });

    const { requestAppPermissionsOnce } = await load();
    act(() => { requestAppPermissionsOnce(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });

    const persisted = JSON.parse(localStorage.getItem('sparkle_app_permissions_v1') || '{}');
    expect(persisted.results.microphone).toBe('denied');
  });

  it('fires from the hook on first authenticated boot only', async () => {
    stubMediaDevices(async () => ({ getTracks: () => [{ stop: vi.fn() }] }));
    const { useAppPermissions } = await load();
    const { rerender } = renderHook(() => useAppPermissions());

    await act(async () => { await vi.advanceTimersByTimeAsync(1500); });
    expect(h.localNotifications.requestPermissions).toHaveBeenCalledTimes(1);

    rerender();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(h.localNotifications.requestPermissions).toHaveBeenCalledTimes(1);
  });

  it('does not fire before the session is restored', async () => {
    h.userState.isAuthenticated = false;
    const { useAppPermissions } = await load();
    renderHook(() => useAppPermissions());

    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(h.localNotifications.requestPermissions).not.toHaveBeenCalled();
  });
});

describe('useMessageVisibilityObserver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    Object.defineProperty(document, 'hasFocus', { configurable: true, value: () => true });
  });
  afterEach(() => vi.useRealTimers());

  class FakeObserver {
    static instances: FakeObserver[] = [];
    callback: IntersectionObserverCallback;
    options: IntersectionObserverInit | undefined;
    observed: Element[] = [];
    constructor(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) {
      this.callback = cb;
      this.options = opts;
      FakeObserver.instances.push(this);
    }
    observe(el: Element) { this.observed.push(el); }
    disconnect() {}
    unobserve() {}
    takeRecords() { return []; }
    root = null;
    rootMargin = '';
    thresholds = [];
  }

  const makeContainer = () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <div data-message-id="m1" data-sender-id="them"></div>
      <div data-message-id="m2" data-sender-id="me"></div>
      <div data-message-id="m3" data-sender-id="them"></div>
    `;
    document.body.appendChild(container);
    return container;
  };

  it('acks reads only for others\u2019 messages, batched after 300ms', async () => {
    FakeObserver.instances = [];
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    const socket = {
      sessionId: 'sess-9',
      on: vi.fn(), off: vi.fn(), emit: vi.fn(),
    };
    h.current.socket = socket;
    h.userState.user = { user_id: 'me', id: 'me' };

    const { useMessageVisibilityObserver } = await import('../useMessageVisibilityObserver');
    const container = makeContainer();
    const ref = { current: container };
    renderHook(() => useMessageVisibilityObserver('c1', ref as never));

    expect(FakeObserver.instances).toHaveLength(1);
    expect(FakeObserver.instances[0].observed).toHaveLength(3);

    const observer = FakeObserver.instances[0];
    await act(async () => {
      observer.callback([
        { isIntersecting: true, intersectionRatio: 0.8, target: container.children[0] },
        { isIntersecting: true, intersectionRatio: 0.8, target: container.children[1] },
        { isIntersecting: true, intersectionRatio: 0.8, target: container.children[2] },
      ] as never, observer as never);
    });
    expect(socket.emit).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(socket.emit).toHaveBeenCalledWith('message-read-ack', {
      chatId: 'c1',
      messageIds: ['m1', 'm3'],
      sessionId: 'sess-9',
    });
    container.remove();
  });

  it('ignores the observer callback while the tab is hidden', async () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    FakeObserver.instances = [];
    const socket = { sessionId: null, on: vi.fn(), off: vi.fn(), emit: vi.fn() };
    h.current.socket = socket;

    const { useMessageVisibilityObserver } = await import('../useMessageVisibilityObserver');
    const container = makeContainer();
    const ref = { current: container };
    renderHook(() => useMessageVisibilityObserver('c1', ref as never));

    await act(async () => {
      FakeObserver.instances[0].callback([
        { isIntersecting: true, intersectionRatio: 0.9, target: container.children[0] },
      ] as never, FakeObserver.instances[0] as never);
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(socket.emit).not.toHaveBeenCalled();
    container.remove();
  });

  it('ignores messages below the 50% visibility threshold', async () => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    FakeObserver.instances = [];
    const socket = { sessionId: null, on: vi.fn(), off: vi.fn(), emit: vi.fn() };
    h.current.socket = socket;

    const { useMessageVisibilityObserver } = await import('../useMessageVisibilityObserver');
    const container = makeContainer();
    const ref = { current: container };
    renderHook(() => useMessageVisibilityObserver('c1', ref as never));

    await act(async () => {
      FakeObserver.instances[0].callback([
        { isIntersecting: true, intersectionRatio: 0.4, target: container.children[0] },
      ] as never, FakeObserver.instances[0] as never);
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(socket.emit).not.toHaveBeenCalled();
    container.remove();
  });

  it('flushes pending receipts on unmount', async () => {
    FakeObserver.instances = [];
    const socket = { sessionId: null, on: vi.fn(), off: vi.fn(), emit: vi.fn() };
    h.current.socket = socket;

    const { useMessageVisibilityObserver } = await import('../useMessageVisibilityObserver');
    const container = makeContainer();
    const ref = { current: container };
    const { unmount } = renderHook(() => useMessageVisibilityObserver('c1', ref as never));

    await act(async () => {
      FakeObserver.instances[0].callback([
        { isIntersecting: true, intersectionRatio: 0.9, target: container.children[0] },
      ] as never, FakeObserver.instances[0] as never);
    });

    // Unmount before the 300ms batch fires: the cleanup flushes.
    act(() => { unmount(); });
    expect(socket.emit).toHaveBeenCalledWith('message-read-ack', {
      chatId: 'c1',
      messageIds: ['m1'],
      sessionId: null,
    });
    container.remove();
  });

  it('does nothing without a socket or a chat', async () => {
    FakeObserver.instances = [];
    h.current.socket = null;
    const { useMessageVisibilityObserver } = await import('../useMessageVisibilityObserver');
    const container = makeContainer();
    const ref = { current: container };

    renderHook(() => useMessageVisibilityObserver('c1', ref as never));
    renderHook(() => useMessageVisibilityObserver(null, ref as never));

    expect(FakeObserver.instances).toHaveLength(0);
    container.remove();
  });
});

describe('useCamera', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
  });

  // Stable track spies: every getTracks() call returns the same objects, so the
  // assertions observe the spies the hook actually stopped.
  const fakeStream = () => {
    const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }];
    return { getTracks: () => tracks, tracks };
  };

  it('starts with the front camera and plays into the video element', async () => {
    const stream = fakeStream();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(stream as never);
    const { useCamera } = await import('../useCamera');

    const video = document.createElement('video');
    video.play = vi.fn();
    const { result } = renderHook(() => useCamera());
    (result.current.videoRef as { current: HTMLVideoElement | null }).current = video;
    await act(async () => {});

    expect(vi.mocked(navigator.mediaDevices.getUserMedia)).toHaveBeenCalledWith({
      video: { facingMode: 'user' }, audio: false,
    });
    expect(video.srcObject).toBe(stream);
    expect(video.play).toHaveBeenCalled();
    expect(result.current.facingMode).toBe('user');
  });

  it('switchCamera stops the old stream and starts the rear camera', async () => {
    const first = fakeStream();
    const second = fakeStream();
    vi.mocked(navigator.mediaDevices.getUserMedia)
      .mockResolvedValueOnce(first as never)
      .mockResolvedValueOnce(second as never);
    const { useCamera } = await import('../useCamera');

    const video = document.createElement('video');
    video.play = vi.fn();
    const { result } = renderHook(() => useCamera());
    (result.current.videoRef as { current: HTMLVideoElement | null }).current = video;
    await act(async () => {});

    act(() => { result.current.switchCamera(); });
    await act(async () => {});

    expect(result.current.facingMode).toBe('environment');
    first.tracks.forEach((t) => expect(t.stop).toHaveBeenCalled());
    expect(vi.mocked(navigator.mediaDevices.getUserMedia)).toHaveBeenLastCalledWith({
      video: { facingMode: 'environment' }, audio: false,
    });
  });

  it('logs a denied camera instead of throwing', async () => {
    const { logger } = await import('../../utils/logger');
    vi.mocked(navigator.mediaDevices.getUserMedia).mockRejectedValue(new Error('NotAllowedError'));
    const { useCamera } = await import('../useCamera');

    const { result } = renderHook(() => useCamera());
    await act(async () => { await result.current.startCamera(); });

    expect(vi.mocked(logger.error)).toHaveBeenCalled();
  });

  it('stopCamera releases every track and clears the video element', async () => {
    const stream = fakeStream();
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(stream as never);
    const { useCamera } = await import('../useCamera');

    const video = document.createElement('video');
    video.play = vi.fn();
    const { result } = renderHook(() => useCamera());
    (result.current.videoRef as { current: HTMLVideoElement | null }).current = video;
    await act(async () => {});

    act(() => { result.current.stopCamera(); });
    stream.tracks.forEach((t) => expect(t.stop).toHaveBeenCalled());
    expect(video.srcObject).toBeNull();
  });
});

describe('useNotificationActions', () => {
  const notif = (over: Record<string, unknown> = {}) => ({
    id: 'n1',
    isRead: false,
    actions: [],
    action_url: null,
    ...over,
  }) as never;

  it('marks read and navigates to the primary action route', async () => {
    const { useNotificationActions } = await import('../useNotificationActions');
    const { result } = renderHook(() => useNotificationActions());

    await act(async () => {
      await result.current.handleNotificationClick(notif({
        actions: [{ label: 'View', route: '/post/p1' }],
      }));
    });

    expect(h.markRead).toHaveBeenCalledWith('n1');
    expect(h.navigate).toHaveBeenCalledWith('/post/p1');
  });

  it('falls back to action_url when there is no action', async () => {
    const { useNotificationActions } = await import('../useNotificationActions');
    const { result } = renderHook(() => useNotificationActions());

    await act(async () => {
      await result.current.handleNotificationClick(notif({ action_url: '/events/e1' }));
    });

    expect(h.navigate).toHaveBeenCalledWith('/events/e1');
  });

  it('navigates nowhere when there is no route at all', async () => {
    const { useNotificationActions } = await import('../useNotificationActions');
    const { result } = renderHook(() => useNotificationActions());

    await act(async () => { await result.current.handleNotificationClick(notif()); });
    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.markRead).toHaveBeenCalledWith('n1');
  });

  it('skips the optimistic mark for an already-read notification', async () => {
    const { useNotificationActions } = await import('../useNotificationActions');
    const { result } = renderHook(() => useNotificationActions());

    await act(async () => {
      await result.current.handleNotificationClick(notif({ isRead: true, action_url: '/x' }));
    });

    expect(h.markRead).not.toHaveBeenCalled();
    expect(h.navigate).toHaveBeenCalledWith('/x');
  });

  it('stops propagation and navigates for an inline action', async () => {
    const { useNotificationActions } = await import('../useNotificationActions');
    const { result } = renderHook(() => useNotificationActions());
    const event = { stopPropagation: vi.fn(), preventDefault: vi.fn() };

    await act(async () => {
      await result.current.handleActionClick(event as never, notif(), { label: 'Follow', route: '/profile/u2' } as never);
    });

    expect(event.stopPropagation).toHaveBeenCalled();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(h.navigate).toHaveBeenCalledWith('/profile/u2');
    expect(h.markRead).toHaveBeenCalledWith('n1');
  });

  it('exposes the store actions it was built on', async () => {
    const { useNotificationActions } = await import('../useNotificationActions');
    const { result } = renderHook(() => useNotificationActions());

    expect(result.current.markRead).toBe(h.markRead);
    expect(result.current.markAllRead).toBe(h.markAllRead);
  });
});