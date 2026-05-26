import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Post } from '../types/post';

/**
 * Production-grade Home Feed Store with Normalized State (Batch 4 Rebuild)
 */
export interface FeedState {
  orderedPostIds: string[];
  postsById: Record<string, Post>;
  optimisticPosts: Record<string, Post>;
  paginationState: {
    offset: number;
    hasMore: boolean;
    seed: number;
  };
  mediaCache: Record<string, { loaded: boolean; failed: boolean; retryCount: number }>;
  socketPatchQueue: any[];
  visiblePostIds: string[];
  pendingUploads: Record<string, any>;
  feedVersion: number;
  stories: any[];
  suggestions: any[];
  lastFetched: number | null;

  // Feed Population & Pagination
  setPosts: (posts: Post[]) => void;
  appendPosts: (posts: Post[]) => void;
  prependPosts: (posts: Post[]) => void;
  
  // Normalized & Socket Patching Actions
  patchPost: (postId: string, updates: Partial<Post>) => void;
  removePost: (postId: string) => void;
  
  // Optimistic Insertion Flow
  addOptimisticPost: (post: Post) => void;
  confirmOptimisticPost: (tempId: string, realPost: Post) => void;

  // Media preloading & caching
  setMediaCache: (url: string, status: { loaded: boolean; failed: boolean; retryCount: number }) => void;

  // Additional Feed Meta State
  setStories: (stories: any[]) => void;
  setSuggestions: (suggestions: any[]) => void;
  setPaginationState: (updates: Partial<FeedState['paginationState']>) => void;
  clearFeed: () => void;
}

export const useFeedStore = create<FeedState>()(
  persist(
    (set, get) => ({
      orderedPostIds: [],
      postsById: {},
      optimisticPosts: {},
      paginationState: {
        offset: 0,
        hasMore: true,
        seed: Math.floor(Math.random() * 100000)
      },
      mediaCache: {},
      socketPatchQueue: [],
      visiblePostIds: [],
      pendingUploads: {},
      feedVersion: 0,
      stories: [],
      suggestions: [],
      lastFetched: null,

      setPosts: (posts) => set((state) => {
        const postsById: Record<string, Post> = {};
        const orderedPostIds: string[] = [];

        // Apply ranking score calculations with temporary post boost
        const rankedPosts = [...posts].sort((a, b) => {
          let scoreA = 0;
          let scoreB = 0;
          
          // Check for temporal new post boost
          const now = Date.now();
          const createdA = new Date(a.created_at).getTime();
          const createdB = new Date(b.created_at).getTime();

          // 500 points boost for posts newer than 1 hour
          if (now - createdA < 3600000) {
            scoreA += 500;
          }
          if (now - createdB < 3600000) {
            scoreB += 500;
          }

          // Merge engagement metrics
          scoreA += (a.spark_count || 0) * 10 + (a.comment_count || 0) * 5;
          scoreB += (b.spark_count || 0) * 10 + (b.comment_count || 0) * 5;

          return scoreB - scoreA;
        });

        rankedPosts.forEach((post) => {
          if (post.post_id) {
            postsById[post.post_id] = post;
            orderedPostIds.push(post.post_id);
          }
        });

        return {
          postsById,
          orderedPostIds,
          lastFetched: Date.now(),
          feedVersion: state.feedVersion + 1
        };
      }),

      appendPosts: (newPosts) => set((state) => {
        const postsById = { ...state.postsById };
        const orderedPostIds = [...state.orderedPostIds];

        newPosts.forEach((post) => {
          // Deduplication rule
          if (post.post_id && !postsById[post.post_id]) {
            postsById[post.post_id] = post;
            orderedPostIds.push(post.post_id);
          }
        });

        return {
          postsById,
          orderedPostIds,
          feedVersion: state.feedVersion + 1
        };
      }),

      prependPosts: (newPosts) => set((state) => {
        const postsById = { ...state.postsById };
        const orderedPostIds = [...state.orderedPostIds];

        // Process in reverse to maintain order at the top
        [...newPosts].reverse().forEach((post) => {
          // Deduplication rule
          if (post.post_id) {
            postsById[post.post_id] = post;
            if (!orderedPostIds.includes(post.post_id)) {
              orderedPostIds.unshift(post.post_id);
            }
          }
        });

        return {
          postsById,
          orderedPostIds,
          lastFetched: Date.now(),
          feedVersion: state.feedVersion + 1
        };
      }),

      patchPost: (postId, updates) => set((state) => {
        if (!state.postsById[postId]) return {};
        return {
          postsById: {
            ...state.postsById,
            [postId]: {
              ...state.postsById[postId],
              ...updates
            }
          }
        };
      }),

      removePost: (postId) => set((state) => {
        const postsById = { ...state.postsById };
        delete postsById[postId];
        return {
          postsById,
          orderedPostIds: state.orderedPostIds.filter(id => id !== postId),
          feedVersion: state.feedVersion + 1
        };
      }),

      addOptimisticPost: (post) => set((state) => {
        const tempId = post.post_id;
        const postsById = {
          ...state.postsById,
          [tempId]: post
        };
        const orderedPostIds = [tempId, ...state.orderedPostIds];
        const optimisticPosts = {
          ...state.optimisticPosts,
          [tempId]: post
        };
        return {
          postsById,
          orderedPostIds,
          optimisticPosts,
          feedVersion: state.feedVersion + 1
        };
      }),

      confirmOptimisticPost: (tempId, realPost) => set((state) => {
        const postsById = { ...state.postsById };
        const optimisticPosts = { ...state.optimisticPosts };
        
        delete postsById[tempId];
        delete optimisticPosts[tempId];

        if (realPost.post_id) {
          postsById[realPost.post_id] = realPost;
        }

        const orderedPostIds = state.orderedPostIds.map(id => id === tempId ? realPost.post_id : id);

        return {
          postsById,
          optimisticPosts,
          orderedPostIds,
          feedVersion: state.feedVersion + 1
        };
      }),

      setMediaCache: (url, status) => set((state) => ({
        mediaCache: {
          ...state.mediaCache,
          [url]: status
        }
      })),

      setStories: (stories) => set({ stories }),
      setSuggestions: (suggestions) => set({ suggestions }),
      setPaginationState: (updates) => set((state) => ({
        paginationState: {
          ...state.paginationState,
          ...updates
        }
      })),
      
      clearFeed: () => set({
        orderedPostIds: [],
        postsById: {},
        optimisticPosts: {},
        lastFetched: null,
        feedVersion: 0
      }),
    }),
    {
      name: 'sparkle-feed-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        // Persist limited normalized metadata for speed
        orderedPostIds: state.orderedPostIds.slice(0, 20),
        postsById: Object.fromEntries(
          Object.entries(state.postsById).filter(([id]) => state.orderedPostIds.slice(0, 20).includes(id))
        ),
        stories: state.stories,
        suggestions: state.suggestions,
        lastFetched: state.lastFetched 
      }),
    }
  )
);
