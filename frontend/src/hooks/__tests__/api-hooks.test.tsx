// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';

const getMock = vi.fn();
const loggerError = vi.fn();

vi.mock('../../api/api', () => ({
  default: { get: (...args: unknown[]) => getMock(...args) },
}));

vi.mock('../../utils/logger', () => ({
  logger: { error: (...a: unknown[]) => loggerError(...a), warn: vi.fn(), log: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

afterEach(() => {
  cleanup();
  getMock.mockReset();
  loggerError.mockReset();
  vi.resetModules();
});

describe('useMentionSearch', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const load = async () => (await import('../useMentionSearch')).useMentionSearch;

  it('returns an empty list synchronously below minLength', async () => {
    const useMentionSearch = await load();
    const { result } = renderHook(() => useMentionSearch('a', { debounceMs: 100, minLength: 2 }));

    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(result.current.options).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(getMock).not.toHaveBeenCalled();
  });

  it('debounces and searches after the delay', async () => {
    const useMentionSearch = await load();
    getMock.mockResolvedValue({ data: { users: [{ username: 'alice' }, { username: 'bob' }] } });

    const { result } = renderHook(() => useMentionSearch('ali', { debounceMs: 300 }));

    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(getMock).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(getMock).toHaveBeenCalledWith('/users/search?q=ali');
    expect(result.current.options).toHaveLength(2);
    expect(result.current.loading).toBe(false);
  });

  it('accepts a bare-array response shape', async () => {
    const useMentionSearch = await load();
    getMock.mockResolvedValue({ data: [{ username: 'carol' }] });

    const { result } = renderHook(() => useMentionSearch('car', { debounceMs: 10 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });

    expect(result.current.options).toEqual([{ username: 'carol' }]);
  });

  it('strips the leading @ and truncates at limit', async () => {
    const useMentionSearch = await load();
    getMock.mockResolvedValue({ data: [{ username: 'a' }, { username: 'b' }, { username: 'c' }] });

    const { result } = renderHook(() => useMentionSearch('@dan', { debounceMs: 10, limit: 2 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });

    expect(getMock).toHaveBeenCalledWith('/users/search?q=dan');
    expect(result.current.options).toHaveLength(2);
  });

  it('discards a stale response when the query changes', async () => {
    const useMentionSearch = await load();
    let resolveFirst: (v: unknown) => void = () => {};
    getMock.mockImplementationOnce(() => new Promise((r) => { resolveFirst = r; }));
    getMock.mockResolvedValueOnce({ data: [{ username: 'second' }] });

    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useMentionSearch(q, { debounceMs: 10 }),
      { initialProps: { q: 'aa' } }
    );

    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    rerender({ q: 'bb' });
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });

    await act(async () => { resolveFirst({ data: [{ username: 'stale' }] }); });
    expect(result.current.options).toEqual([{ username: 'second' }]);
  });

  it('exposes an empty list on failure', async () => {
    const useMentionSearch = await load();
    getMock.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useMentionSearch('zz', { debounceMs: 10 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });

    expect(result.current.options).toEqual([]);
    expect(loggerError).toHaveBeenCalledTimes(1);
  });

  it('fetches followings immediately for a bare @ when enabled', async () => {
    const useMentionSearch = await load();
    getMock.mockResolvedValue({ data: [] });

    const { result } = renderHook(() =>
      useMentionSearch('@', { debounceMs: 300, followingsOnBareAt: true })
    );

    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(getMock).toHaveBeenCalledWith('/users/following?q=');
    expect(result.current.options).toEqual([]);
  });

  it('respects enabled=false', async () => {
    const useMentionSearch = await load();
    const { result } = renderHook(() => useMentionSearch('abc', { enabled: false, debounceMs: 10 }));

    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(getMock).not.toHaveBeenCalled();
    expect(result.current.options).toEqual([]);
  });
});

describe('useUniversities', () => {
  it('fetches, loads, and exposes the list', async () => {
    getMock.mockResolvedValue({ data: { universities: [{ id: 1, name: 'Strathmore', country: 'Kenya' }] } });

    const { useUniversities } = await import('../useUniversities');
    const { result } = renderHook(() => useUniversities());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.universities).toHaveLength(1);
    expect(result.current.error).toBe(false);
    expect(getMock).toHaveBeenCalledWith('/universities');
  });

  it('flags an error instead of throwing', async () => {
    getMock.mockRejectedValue(new Error('offline'));

    const { useUniversities } = await import('../useUniversities');
    const { result } = renderHook(() => useUniversities());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(true);
    expect(result.current.universities).toEqual([]);
  });

  it('serves the second mount from the module cache', async () => {
    getMock.mockResolvedValue({ data: { universities: [{ id: 2, name: 'UoN', country: 'Kenya' }] } });

    const { useUniversities } = await import('../useUniversities');
    const first = renderHook(() => useUniversities());
    await waitFor(() => expect(first.result.current.loading).toBe(false));

    const second = renderHook(() => useUniversities());
    expect(second.result.current.universities).toHaveLength(1);

      });
});

describe('useDeviceSeed', () => {
  it('derives a stable seed per device + user and persists the device id', async () => {
    localStorage.clear();
    const { useUserStore } = await import('../../store/userStore');
    const { useDeviceSeed } = await import('../useDeviceSeed');

    act(() => { useUserStore.setState({ user: { user_id: 'u1' } as never }); });
    const { result, rerender } = renderHook(() => useDeviceSeed());

    const first = result.current;
    expect(first.deviceId).toBeTruthy();
    expect(localStorage.getItem('sparkle_device_id')).toBe(first.deviceId);

    rerender();
    expect(result.current.seed).toBe(first.seed);

    act(() => { useUserStore.setState({ user: { user_id: 'u2' } as never }); });
    expect(result.current.seed).not.toBe(first.seed);
  });
});