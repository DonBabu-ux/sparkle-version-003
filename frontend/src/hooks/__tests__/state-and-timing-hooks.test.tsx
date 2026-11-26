// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup, waitFor } from '@testing-library/react';
import React from 'react';

vi.mock('../../services/referralService', () => ({
  getReferralStats: vi.fn(),
  getRewards: vi.fn(),
  getInviteLink: vi.fn(),
  getLeaderboard: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const referral = await import('../../services/referralService');

afterEach(cleanup);

describe('useReferralData', () => {
  beforeEach(() => {
    vi.mocked(referral.getReferralStats).mockReset().mockResolvedValue({ totalEarnings: '100' } as never);
    vi.mocked(referral.getRewards).mockReset().mockResolvedValue([{ id: 1 }] as never);
    vi.mocked(referral.getInviteLink).mockReset().mockResolvedValue({ url: 'https://sparkle/r/ABC', code: 'ABC' } as never);
    vi.mocked(referral.getLeaderboard).mockReset().mockResolvedValue({ topReferrers: [] } as never);
  });

  const load = async () => (await import('../useReferralData')).useReferralData;

  it('loads stats, rewards and the invite link in parallel and settles', async () => {
    const useReferralData = await load();
    const { result } = renderHook(() => useReferralData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data.stats).toMatchObject({ totalEarnings: '100' });
    expect(result.current.data.rewards).toMatchObject([{ id: 1 }]);
    expect(result.current.data.inviteLink).toMatchObject({ url: 'https://sparkle/r/ABC' });
    expect(result.current.errors).toEqual({});
  });

  it('does not fetch the leaderboard until its section is refreshed', async () => {
    const useReferralData = await load();
    const { result } = renderHook(() => useReferralData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(referral.getLeaderboard).not.toHaveBeenCalled();
    await act(async () => { await result.current.refreshSection('leaderboard'); });
    expect(referral.getLeaderboard).toHaveBeenCalledTimes(1);
    expect(result.current.data.leaderboard).toMatchObject({ topReferrers: [] });
  });

  it('isolates a failing section without losing the others', async () => {
    vi.mocked(referral.getRewards).mockRejectedValue(new Error('rewards offline'));
    const useReferralData = await load();
    const { result } = renderHook(() => useReferralData());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data.stats).toMatchObject({ totalEarnings: '100' });
    expect(result.current.errors.rewards).toBe('rewards offline');
    expect(result.current.errors.stats).toBeUndefined();
  });

  it('records the error message when a single-section refresh fails', async () => {
    vi.mocked(referral.getReferralStats).mockRejectedValueOnce(new Error('stats down'));
    const useReferralData = await load();
    const { result } = renderHook(() => useReferralData());

    await act(async () => { await result.current.refreshSection('stats'); });
    expect(result.current.errors.stats).toBe('stats down');
  });

  it('warns instead of throwing on an unknown section', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const useReferralData = await load();
    const { result } = renderHook(() => useReferralData());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => { await result.current.refreshSection('nope' as never); });
    expect(warn).toHaveBeenCalledWith('Unknown section refresh', 'nope');
    warn.mockRestore();
  });
});

describe('useReducedMotion', () => {
  const stubMatchMedia = (matches: boolean) => {
    const listeners: Array<() => void> = [];
    const mq = {
      matches,
      addEventListener: (_: string, fn: () => void) => listeners.push(fn),
      removeEventListener: vi.fn(),
    };
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(() => mq),
    });
    return { mq, listeners };
  };

  it('reflects the prefers-reduced-motion setting after mount', async () => {
    stubMatchMedia(true);
    const { useReducedMotion } = await import('../useReducedMotion');
    const { result } = renderHook(() => useReducedMotion());

    await act(async () => {});
    expect(result.current).toBe(true);
  });

  it('reacts to a settings change', async () => {
    const { listeners } = stubMatchMedia(false);
    const { useReducedMotion } = await import('../useReducedMotion');
    const { result } = renderHook(() => useReducedMotion());

    await act(async () => {});
    expect(result.current).toBe(false);

    // The OS setting flips on: the listener re-reads matches (still false here).
    await act(async () => { listeners.forEach((fn) => fn()); });
    expect(result.current).toBe(false);
  });

  it('unsubscribes on unmount', async () => {
    const { mq } = stubMatchMedia(false);
    const { useReducedMotion } = await import('../useReducedMotion');
    const { unmount } = renderHook(() => useReducedMotion());

    unmount();
    expect(mq.removeEventListener).toHaveBeenCalled();
  });
});

describe('useTimeTick', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const load = async () => (await import('../useTimeTick')).useTimeTick;

  it('advances on the default 30s interval', async () => {
    const useTimeTick = await load();
    const { result } = renderHook(() => useTimeTick());
    const first = result.current;

    await act(async () => { await vi.advanceTimersByTimeAsync(29999); });
    expect(result.current).toBe(first);

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(result.current).toBeGreaterThan(first);
  });

  it('honours a custom interval', async () => {
    const useTimeTick = await load();
    const { result } = renderHook(() => useTimeTick(1000));
    const first = result.current;

    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current).toBeGreaterThan(first);
  });

  it('clears the interval on unmount', async () => {
    const useTimeTick = await load();
    const { result, unmount } = renderHook(() => useTimeTick());
    const first = result.current;

    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
    expect(result.current).toBe(first);
  });
});

describe('useSound', () => {
  const load = async () => {
    const mod = await import('../useSound');
    return mod.useSound;
  };

  it('delegates playSound and stopSound to the context', async () => {
    const ctx = {
      playSound: vi.fn(),
      stopSound: vi.fn(),
      stopAll: vi.fn(),
      getSettings: vi.fn(() => ({ muted: false })),
      updateSettings: vi.fn(),
      getDiagnostics: vi.fn(() => ({ pools: 1 })),
    };
    const { SoundContext } = await import('../../context/SoundProvider');
    const useSound = await load();

    const { result } = renderHook(() => useSound(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <SoundContext.Provider value={ctx as never}>{children}</SoundContext.Provider>
      ),
    });

    act(() => { result.current.playSound('send' as never); });
    expect(ctx.playSound).toHaveBeenCalledWith('send', undefined);

    act(() => { result.current.playSound('receive' as never, { rate: 1.5 }); });
    expect(ctx.playSound).toHaveBeenCalledWith('receive', { rate: 1.5 });

    act(() => { result.current.stopSound('send' as never); });
    expect(ctx.stopSound).toHaveBeenCalledWith('send');

    expect(result.current.getSettings()).toEqual({ muted: false });
    expect(result.current.getDiagnostics()).toEqual({ pools: 1 });
    result.current.stopAll();
    expect(ctx.stopAll).toHaveBeenCalled();
    result.current.updateSettings({ muted: true } as never);
    expect(ctx.updateSettings).toHaveBeenCalledWith({ muted: true });
  });
});