import { create } from 'zustand';
import type { Post } from '../types/post';

/**
 * Global feed store to ensure "Fast Navigation" (Section 3)
 * Prevents full reloads and refetching when switching between screens.
 */
interface FeedState {
  posts: Post[];
  stories: any[];
  suggestions: any[];
  lastFetched: number | null;
  
  setPosts: (posts: Post[]) => void;
  appendPosts: (posts: Post[]) => void;
  setStories: (stories: any[]) => void;
  setSuggestions: (suggestions: any[]) => void;
  clearFeed: () => void;
}

export const useFeedStore = create<FeedState>((set) => ({
  posts: [],
  stories: [],
  suggestions: [],
  lastFetched: null,

  setPosts: (posts) => set({ posts, lastFetched: Date.now() }),
  appendPosts: (newPosts) => set((state) => {
    const uniqueNew = newPosts.filter(p => !state.posts.some(existing => existing.post_id === p.post_id));
    return { posts: [...state.posts, ...uniqueNew] };
  }),
  setStories: (stories) => set({ stories }),
  setSuggestions: (suggestions) => set({ suggestions }),
  clearFeed: () => set({ posts: [], stories: [], suggestions: [], lastFetched: null }),
}));
