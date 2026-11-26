import { describe, it, expect, beforeEach, vi } from 'vitest';

class MemoryStorage {
  private store = new Map<string, string>();
  getItem(k: string) { return this.store.has(k) ? this.store.get(k)! : null; }
  setItem(k: string, v: string) { this.store.set(k, String(v)); }
  removeItem(k: string) { this.store.delete(k); }
  clear() { this.store.clear(); }
}
vi.stubGlobal('localStorage', new MemoryStorage());

const { useFeedStore } = await import('../feedStore');
import type { Post } from '../../types/post';

const state = () => useFeedStore.getState();

const post = (over: Partial<Post> = {}): Post => ({
  post_id: 'p1',
  username: 'u',
  name: 'U',
  content: 'hello',
  spark_count: 0,
  comment_count: 0,
  is_sparked: false,
  is_saved: false,
  created_at: '2026-11-01T00:00:00Z',
  ...over,
} as Post);

describe('feed store — normalized order, patching, optimistic flow', () => {
  beforeEach(() => {
    useFeedStore.setState({
      orderedPostIds: [], postsById: {}, optimisticPosts: {},
      mediaCache: {}, socketPatchQueue: [], visiblePostIds: [], pendingUploads: {},
      stories: [], suggestions: [], lastFetched: null,
      paginationState: { offset: 0, hasMore: true, seed: 1 },
      feedVersion: 0,
    });
  });

  it('setPosts preserves API order (newest first, no reversal)', () => {
    state().setPosts([post({ post_id: 'a' }), post({ post_id: 'b' })]);
    expect(state().orderedPostIds).toEqual(['a', 'b']);
    expect(state().postsById.a.post_id).toBe('a');
    expect(state().lastFetched).toBeGreaterThan(0);
  });

  it('appendPosts appends and dedupes the order array', () => {
    state().setPosts([post({ post_id: 'a' })]);
    state().appendPosts([post({ post_id: 'b' }), post({ post_id: 'a' }), post({ post_id: 'c' })]);
    expect(state().orderedPostIds).toEqual(['a', 'b', 'c']);
  });

  it('appendPosts overwrites the map entry for a known id', () => {
    state().setPosts([post({ post_id: 'a', content: 'old' })]);
    state().appendPosts([post({ post_id: 'a', content: 'new' })]);
    expect(state().postsById.a.content).toBe('new');
    expect(state().orderedPostIds).toEqual(['a']);
  });

  it('prependPosts keeps the newest batch in order at the top', () => {
    state().setPosts([post({ post_id: 'a' })]);
    state().prependPosts([post({ post_id: 'b' }), post({ post_id: 'c' })]);
    expect(state().orderedPostIds).toEqual(['b', 'c', 'a']);
  });

  it('ignores rows without a post_id', () => {
    state().setPosts([post({ post_id: '' }), post({ post_id: 'a' })]);
    expect(state().orderedPostIds).toEqual(['a']);
  });

  it('patchPost merges a socket update and bumps the version', () => {
    state().setPosts([post({ post_id: 'a', spark_count: 0 })]);
    const v = state().feedVersion;
    state().patchPost('a', { spark_count: 5 });
    expect(state().postsById.a.spark_count).toBe(5);
    expect(state().postsById.a.content).toBe('hello');
    expect(state().feedVersion).toBe(v + 1);
  });

  it('patchPost on an unknown id is a no-op', () => {
    state().setPosts([post({ post_id: 'a' })]);
    const before = useFeedStore.getState();
    state().patchPost('ghost', { spark_count: 9 });
    expect(useFeedStore.getState().postsById).toBe(before.postsById);
  });

  it('optimistic insert lands at the top and is tracked until confirmed', () => {
    state().setPosts([post({ post_id: 'a' })]);
    const temp = post({ post_id: 'temp-1', content: 'pending' });

    state().addOptimisticPost(temp);
    expect(state().orderedPostIds).toEqual(['temp-1', 'a']);
    expect(state().optimisticPosts['temp-1']).toBeDefined();
    expect(state().postsById['temp-1'].content).toBe('pending');

    state().confirmOptimisticPost('temp-1', post({ post_id: 'real-1', content: 'server' }));
    expect(state().orderedPostIds).toEqual(['real-1', 'a']);
    expect(state().optimisticPosts['temp-1']).toBeUndefined();
    expect(state().postsById['temp-1']).toBeUndefined();
    expect(state().postsById['real-1'].content).toBe('server');
  });

  it('confirming an optimistic post does not duplicate a real post already loaded', () => {
    state().setPosts([post({ post_id: 'real-1' })]);
    state().addOptimisticPost(post({ post_id: 'temp-1' }));
    state().confirmOptimisticPost('temp-1', post({ post_id: 'real-1', content: 'server' }));

    expect(state().orderedPostIds.filter((id) => id === 'real-1')).toHaveLength(1);
    expect(state().postsById['real-1'].content).toBe('server');
  });

  it('removePost drops it from order and map', () => {
    state().setPosts([post({ post_id: 'a' }), post({ post_id: 'b' })]);
    state().removePost('a');
    expect(state().orderedPostIds).toEqual(['b']);
    expect(state().postsById.a).toBeUndefined();
  });

  it('clearFeed empties the feed but keeps pagination and stories', () => {
    state().setPosts([post({ post_id: 'a' })]);
    state().setStories([{ id: 's1' }]);
    state().setPaginationState({ offset: 40, hasMore: false, seed: 99 });

    state().clearFeed();

    expect(state().orderedPostIds).toEqual([]);
    expect(state().postsById).toEqual({});
    expect(state().paginationState).toEqual({ offset: 40, hasMore: false, seed: 99 });
    expect(state().stories).toHaveLength(1);
  });

  it('records media cache status separately from feed mutations', () => {
    state().setMediaCache('https://cdn/x.jpg', { loaded: true, failed: false, retryCount: 0 });
    expect(state().mediaCache['https://cdn/x.jpg'].loaded).toBe(true);
  });
});