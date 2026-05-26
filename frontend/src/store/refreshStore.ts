import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Global Pull‑to‑Refresh store.
 * Handles independent refresh state per page key (e.g. 'home', 'messages').
 */
export interface RefreshState {
  /** True while a refresh request is in flight for the given page */
  isRefreshing: Record<string, boolean>;
  /** Incrementing id to track the latest request – helps cancel stale requests */
  latestRequestId: Record<string, number>;
  /** Timestamp of the last successful refresh per page */
  lastRefresh: Record<string, number>;
}

export interface RefreshActions {
  /** Initiates a refresh for a page. Returns a unique request id */
  startRefresh: (pageKey: string) => number;
  /** Marks a refresh as finished; only the latest request id wins */
  finishRefresh: (pageKey: string, requestId: number) => void;
  /** Cancels a pending refresh (used when a newer request supersedes) */
  cancelRefresh: (pageKey: string, requestId: number) => void;
}

export const useRefreshStore = create<RefreshState & RefreshActions>()(
  devtools((set, get) => ({
    isRefreshing: {},
    latestRequestId: {},
    lastRefresh: {},
    startRefresh: (pageKey: string) => {
      const newId = (get().latestRequestId[pageKey] ?? 0) + 1;
      set(state => ({
        isRefreshing: { ...state.isRefreshing, [pageKey]: true },
        latestRequestId: { ...state.latestRequestId, [pageKey]: newId },
      }));
      return newId;
    },
    finishRefresh: (pageKey: string, requestId: number) => {
      // Only accept if this is the latest request for the page
      if (get().latestRequestId[pageKey] !== requestId) return;
      set(state => ({
        isRefreshing: { ...state.isRefreshing, [pageKey]: false },
        lastRefresh: { ...state.lastRefresh, [pageKey]: Date.now() },
      }));
    },
    cancelRefresh: (pageKey: string, requestId: number) => {
      if (get().latestRequestId[pageKey] !== requestId) return;
      set(state => ({
        isRefreshing: { ...state.isRefreshing, [pageKey]: false },
      }));
    },
  }))
);
