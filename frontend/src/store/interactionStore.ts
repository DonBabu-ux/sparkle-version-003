import { create } from 'zustand';

type PendingMap = Map<string, boolean>;

interface InteractionState {
  pendingLikes: PendingMap;
  pendingBookmarks: PendingMap;
  pendingSparks: PendingMap;
  setPending: (type: 'pendingLikes' | 'pendingBookmarks' | 'pendingSparks', postId: string, value: boolean) => void;
  isPending: (type: 'pendingLikes' | 'pendingBookmarks' | 'pendingSparks', postId: string) => boolean;
}

export const useInteractionStore = create<InteractionState>((set, get) => ({
  pendingLikes: new Map(),
  pendingBookmarks: new Map(),
  pendingSparks: new Map(),
  setPending: (type, postId, value) => {
    set(state => {
      const nextMap = new Map(state[type]);
      if (value) {
        nextMap.set(postId, true);
      } else {
        nextMap.delete(postId);
      }
      return {
        ...state,
        [type]: nextMap
      };
    });
  },
  isPending: (type, postId) => {
    const map = get()[type];
    return map.has(postId);
  },
}));

// Helper hooks for specific actions
export const usePendingLike = (postId: string) => useInteractionStore(state => state.isPending('pendingLikes', postId));
export const useSetPendingLike = (postId: string, value: boolean) => useInteractionStore(state => state.setPending('pendingLikes', postId, value));

export const usePendingBookmark = (postId: string) => useInteractionStore(state => state.isPending('pendingBookmarks', postId));
export const useSetPendingBookmark = (postId: string, value: boolean) => useInteractionStore(state => state.setPending('pendingBookmarks', postId, value));

export const usePendingSpark = (postId: string) => useInteractionStore(state => state.isPending('pendingSparks', postId));
export const useSetPendingSpark = (postId: string, value: boolean) => useInteractionStore(state => state.setPending('pendingSparks', postId, value));
