import React, { createContext, useContext, ReactNode, useRef, useEffect } from 'react';
import { useRefreshStore } from '../store/refreshStore';
import { useGesture } from '@use-gesture/react';
import { motion, AnimatePresence } from 'framer-motion';

interface PullToRefreshContextProps {
  /** Trigger a programmatic refresh for the given pageKey */
  triggerRefresh: (pageKey: string) => void;
  /** Current refreshing state for the pageKey */
  isRefreshing: (pageKey: string) => boolean;
}

const PullToRefreshContext = createContext<PullToRefreshContextProps | null>(null);

export const PullToRefreshProvider = ({ children }: { children: ReactNode }) => {
  const startRefresh = useRefreshStore(state => state.startRefresh);
  const finishRefresh = useRefreshStore(state => state.finishRefresh);
  const isRefreshingMap = useRefreshStore(state => state.isRefreshing);

  const triggerRefresh = (pageKey: string) => {
    const reqId = startRefresh(pageKey);
    // Simulate async work – callers should call finishRefresh when their fetch resolves.
    // This provider only manages state, not data fetching.
    // Consumers receive the requestId via the hook for coordination.
    return reqId;
  };

  const isRefreshing = (pageKey: string) => !!isRefreshingMap[pageKey];

  // Gesture handling for elastic pull-down
  const containerRef = useRef<HTMLDivElement>(null);
  const y = useRef(0);
  const [_, setY] = React.useState(0);

  useGesture(
    {
      onDrag: ({ down, movement: [mx, my] }) => {
        // Only vertical drag from top
        if (containerRef.current && containerRef.current.scrollTop === 0) {
          y.current = down ? Math.min(my, 120) : 0;
          setY(y.current);
        }
      },
      onDragEnd: ({ movement: [, my] }) => {
        if (my > 80) {
          // Dispatch a generic "global" refresh event – pages listen via pageKey
          // Here we simply trigger a dummy refresh for "global"; actual pages use the hook directly.
          triggerRefresh('global');
        }
        y.current = 0;
        setY(0);
      },
    },
    {
      target: containerRef,
      eventOptions: { passive: false },
    }
  );

  return (
    <PullToRefreshContext.Provider value={{ triggerRefresh, isRefreshing }}>
      <div ref={containerRef} style={{ overflowY: 'auto', height: '100vh', WebkitOverflowScrolling: 'touch' }}>
        <AnimatePresence>
          {/** Simple spinner/loader shown while any refresh is active */}
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 40, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{
              background: 'rgba(250,250,250,0.9)',
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottom: '1px solid rgba(0,0,0,0.1)',
              backdropFilter: 'blur(5px)',
            }}
          >
            Refreshing…
          </motion.div>
        </AnimatePresence>
        {children}
      </div>
    </PullToRefreshContext.Provider>
  );
};

/** Hook for pages to perform pull‑to‑refresh */
export const usePullToRefresh = (pageKey: string, refreshCallback: () => Promise<void>) => {
  const context = useContext(PullToRefreshContext);
  if (!context) {
    console.warn('PullToRefreshContext not found');
    return { start: async () => {}, refreshing: false };
  }
  const { triggerRefresh, isRefreshing } = context;
  const latestIdRef = useRef<number>(0);

  const start = async () => {
    const requestId = triggerRefresh(pageKey);
    latestIdRef.current = requestId;
    try {
      await refreshCallback();
      // only finish if still latest
      finishRefresh(pageKey, requestId);
    } catch (e) {
      // rollback state on error
      cancelRefresh(pageKey, requestId);
    }
  };

  // Expose the current refreshing flag
  const refreshing = isRefreshing(pageKey);

  // Optional: attach to window pull‑to‑refresh event (if needed)
  useEffect(() => {
    // No automatic trigger – page can call start() on user gesture via provider's UI.
  }, []);

  return { start, refreshing };
};

function finishRefresh(pageKey: string, requestId: number) {
  const finish = useRefreshStore.getState().finishRefresh;
  finish(pageKey, requestId);
}

function cancelRefresh(pageKey: string, requestId: number) {
  const cancel = useRefreshStore.getState().cancelRefresh;
  cancel(pageKey, requestId);
}
