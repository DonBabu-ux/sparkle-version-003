// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { useInfiniteScroll } from '../useInfiniteScroll';

afterEach(cleanup);

// Minimal IntersectionObserver stub that records instances so tests can fire
// intersection callbacks by hand.
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  observed: Element[] = [];
  disconnected = false;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    FakeIntersectionObserver.instances.push(this);
  }
  observe(node: Element) { this.observed.push(node); }
  unobserve() {}
  disconnect() { this.disconnected = true; }
  takeRecords() { return []; }
  root = null;
  rootMargin = '';
  thresholds = [];
}

beforeEach(() => {
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

describe('useInfiniteScroll', () => {
  it('observes the sentinel node with the given margins', () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({ loading: false, hasNextPage: true, onLoadMore })
    );

    const node = document.createElement('div');
    act(() => { result.current.lastElementRef(node); });

    expect(FakeIntersectionObserver.instances).toHaveLength(1);
    const observer = FakeIntersectionObserver.instances[0];
    expect(observer.options).toMatchObject({ rootMargin: '400px', threshold: 0.1 });
    expect(observer.observed).toEqual([node]);
  });

  it('calls onLoadMore when the sentinel intersects with more pages', () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({ loading: false, hasNextPage: true, onLoadMore })
    );

    act(() => { result.current.lastElementRef(document.createElement('div')); });
    const observer = FakeIntersectionObserver.instances[0];

    act(() => {
      observer.callback([{ isIntersecting: true } as IntersectionObserverEntry], observer as never);
    });
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('does not load more when there is no next page', () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({ loading: false, hasNextPage: false, onLoadMore })
    );

    act(() => { result.current.lastElementRef(document.createElement('div')); });
    const observer = FakeIntersectionObserver.instances[0];

    act(() => {
      observer.callback([{ isIntersecting: true } as IntersectionObserverEntry], observer as never);
    });
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('ignores the sentinel while a page is loading', () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({ loading: true, hasNextPage: true, onLoadMore })
    );

    act(() => { result.current.lastElementRef(document.createElement('div')); });
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
  });

  it('does not fire when the sentinel leaves the viewport', () => {
    const onLoadMore = vi.fn();
    const { result } = renderHook(() =>
      useInfiniteScroll({ loading: false, hasNextPage: true, onLoadMore })
    );

    act(() => { result.current.lastElementRef(document.createElement('div')); });
    const observer = FakeIntersectionObserver.instances[0];

    act(() => {
      observer.callback([{ isIntersecting: false } as IntersectionObserverEntry], observer as never);
    });
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it('rebinds when the dependencies change (React calls the ref with null then the node)', () => {
    const onLoadMore = vi.fn();
    const { result, rerender } = renderHook(
      ({ hasNextPage }: { hasNextPage: boolean }) =>
        useInfiniteScroll({ loading: false, hasNextPage, onLoadMore }),
      { initialProps: { hasNextPage: false } }
    );

    const node = document.createElement('div');
    act(() => { result.current.lastElementRef(node); });

    rerender({ hasNextPage: true });
    act(() => { result.current.lastElementRef(node); });

    expect(FakeIntersectionObserver.instances.length).toBeGreaterThan(1);
    expect(FakeIntersectionObserver.instances[0].disconnected).toBe(true);
  });
});