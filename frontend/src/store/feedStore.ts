import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Post } from '../types/post';

/**
 * Global feed store with persistence (Batch 4)
 */
interface FeedState {
  posts: Post[];
  stories: any[];
  suggestions: any[];
  lastFetched: number | null;
  
  setPosts: (posts: Post[]) => void;
  appendPosts: (posts: Post[]) => void;
  prependPosts: (posts: Post[]) => void;
  setStories: (stories: any[]) => void;
  setSuggestions: (suggestions: any[]) => void;
  clearFeed: () => void;
}

export const useFeedStore = create<FeedState>()(
  persist(
    (set) => ({
      posts: [],
      stories: [],
      suggestions: [],
      lastFetched: null,

      setPosts: (posts) => set({ posts, lastFetched: Date.now() }),
      appendPosts: (newPosts) => set((state) => {
        const uniqueNew = newPosts.filter(p => !state.posts.some(existing => existing.post_id === p.post_id));
        return { posts: [...state.posts, ...uniqueNew] };
      }),
      prependPosts: (newPosts) => set((state) => {
        const uniqueNew = newPosts.filter(p => !state.posts.some(existing => existing.post_id === p.post_id));
        return { posts: [...uniqueNew, ...state.posts], lastFetched: Date.now() };
      }),
      setStories: (stories) => set({ stories }),
      setSuggestions: (suggestions) => set({ suggestions }),
      clearFeed: () => set({ posts: [], stories: [], suggestions: [], lastFetched: null }),
    }),
    {
      name: 'sparkle-feed-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        posts: state.posts.slice(0, 20), // Only persist top 20 for speed
        stories: state.stories,
        suggestions: state.suggestions,
        lastFetched: state.lastFetched 
      }),
    }
  )
);
