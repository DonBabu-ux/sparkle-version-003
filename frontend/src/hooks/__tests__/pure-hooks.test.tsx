// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useSelection } from '../useSelection';
import { useDebounce } from '../useDebounce';
import { useLongPress } from '../useLongPress';

afterEach(cleanup);

describe('useSelection', () => {
  it('toggles membership and keeps other selections', () => {
    const { result } = renderHook(() => useSelection());

    act(() => { result.current.toggle('a'); });
    act(() => { result.current.toggle('b'); });
    act(() => { result.current.toggle('a'); });

    expect(result.current.count).toBe(1);
    expect(result.current.isSelected('b')).toBe(true);
    expect(result.current.isSelected('a')).toBe(false);
  });

  it('accepts an initial selection set', () => {
    const { result } = renderHook(() => useSelection(['x', 'y']));
    expect(result.current.count).toBe(2);
    expect(result.current.isSelected('x')).toBe(true);
  });

  it('clear empties the set', () => {
    const { result } = renderHook(() => useSelection(['x']));
    act(() => { result.current.clear(); });
    expect(result.current.count).toBe(0);
    expect(result.current.selected.size).toBe(0);
  });

  it('returns a stable toggle identity across renders', () => {
    const { result, rerender } = renderHook(() => useSelection());
    const first = result.current.toggle;
    rerender();
    expect(result.current.toggle).toBe(first);
  });
});

describe('useDebounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('mirrors the value only after the delay', async () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    });
    expect(result.current).toBe('a');

    rerender({ value: 'b' });
    expect(result.current).toBe('a');

    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(result.current).toBe('a');

    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(result.current).toBe('b');
  });

  it('cancels the pending update when the value changes mid-wait', async () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'b' });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    rerender({ value: 'c' });

    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(result.current).toBe('c');
  });

  it('cancels the pending update on unmount', async () => {
    const { result, unmount, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'a' },
    });
    rerender({ value: 'b' });
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current).toBe('a');
  });
});

describe('useLongPress', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const pointer = (over: Record<string, unknown> = {}) => ({
    button: 0, clientX: 0, clientY: 0, ...over,
  }) as never;

  it('fires after the press duration', async () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, 500));

    act(() => { result.current.onPointerDown(pointer()); });
    expect(onLongPress).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when the pointer is released first', async () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, 500));

    act(() => { result.current.onPointerDown(pointer()); });
    act(() => { result.current.onPointerUp(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('does not fire when the finger moves beyond the tolerance', async () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, 500));

    act(() => { result.current.onPointerDown(pointer()); });
    act(() => { result.current.onPointerMove(pointer({ clientX: 200 })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('tolerates small movement (a wobbly press still fires)', async () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, 500));

    act(() => { result.current.onPointerDown(pointer()); });
    act(() => { result.current.onPointerMove(pointer({ clientX: 8, clientY: 9 })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('ignores secondary mouse buttons', async () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, 500));

    act(() => { result.current.onPointerDown(pointer({ button: 2 })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('suppresses the click that follows a fired long press', async () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, 500));

    act(() => { result.current.onPointerDown(pointer()); });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });

    const clickEvent = { stopPropagation: vi.fn(), preventDefault: vi.fn() } as never;
    act(() => { result.current.onClick(clickEvent); });

    expect(result.current).toBeDefined();
    const spies = clickEvent as unknown as { stopPropagation: ReturnType<typeof vi.fn>; preventDefault: ReturnType<typeof vi.fn> };
    expect(spies.stopPropagation).toHaveBeenCalledTimes(1);
    expect(spies.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('lets a normal click through untouched', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, 500));

    const clickEvent = { stopPropagation: vi.fn(), preventDefault: vi.fn() };
    act(() => { result.current.onClick(clickEvent as never); });

    expect(clickEvent.stopPropagation).not.toHaveBeenCalled();
  });

  it('clears the timer on unmount', async () => {
    const onLongPress = vi.fn();
    const { result, unmount } = renderHook(() => useLongPress(onLongPress, 500));

    act(() => { result.current.onPointerDown(pointer()); });
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });

    expect(onLongPress).not.toHaveBeenCalled();
  });
});