import React, { createContext, useContext, ReactNode, useRef, useEffect, useState } from 'react';
import { useRefreshStore } from '../store/refreshStore';
import { useGesture } from '@use-gesture/react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { logger } from '../utils/logger';

interface PullToRefreshContextProps {
  /** Trigger a programmatic refresh for the given pageKey */
  triggerRefresh: (pageKey: string) => number;
  /** Current refreshing state for the pageKey */
  isRefreshing: (pageKey: string) => boolean;
}

const PullToRefreshContext = createContext<PullToRefreshContextProps | null>(null);

export const PullToRefreshProvider = ({ children }: { children: ReactNode }) => {
  const startRefresh = useRefreshStore(state => state.startRefresh);
  const isRefreshingMap = useRefreshStore(state => state.isRefreshing);

  const triggerRefresh = (pageKey: string) => {
    return startRefresh(pageKey);
  };

  const isRefreshing = (pageKey: string) => !!isRefreshingMap[pageKey];
  const isAnyRefreshing = Object.values(isRefreshingMap).some(Boolean);

  // Gesture handling for elastic pull-down
  const containerRef = useRef<HTMLDivElement>(null);
  const [pullY, setPullY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // S9: the REAL scroller is AppScreen's inner wrapper; this outer container
  // only ever scrolls on pages that don't render AppScreen. Falling back to it
  // keeps raw min-h-dvh pages working.
  const getScroller = (): HTMLElement | null => {
    const root = containerRef.current;
    if (!root) return null;
    return root.querySelector<HTMLElement>('.sparkle-screen-content-wrapper') ?? root;
  };
  const isAtTop = (): boolean => {
    const scroller = getScroller();
    return !!scroller && scroller.scrollTop === 0;
  };

  useGesture(
    {
      onDrag: ({ down, movement: [, my] }) => {
        if (isAtTop() && my > 0) {
          setIsDragging(true);
          // Apply native-feeling logarithmic resistance formula
          const resistance = Math.min(my * 0.4, 90);
          setPullY(down ? resistance : 0);
        } else {
          setPullY(0);
          setIsDragging(false);
        }
      },
      onDragEnd: ({ movement: [, my] }) => {
        setIsDragging(false);
        if (isAtTop() && my > 70) {
          window.dispatchEvent(new CustomEvent('pull-to-refresh-trigger'));
        }
        setPullY(0);
      },
    },
    {
      target: containerRef,
      eventOptions: { passive: false },
    }
  );

  return (
    <PullToRefreshContext.Provider value={{ triggerRefresh, isRefreshing }}>
      <div 
        ref={containerRef} 
        className="no-scrollbar relative w-full select-none" 
        style={{ 
          overflowY: 'auto', 
          height: '100dvh', 
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y'
        }}
      >
        {/* S9: the pill is position:fixed (viewport top, above app chrome) so the
            navbar can never cover it; it is NOT an ancestor-transformed layer. */}
        <AnimatePresence>
          {(pullY > 10 || isAnyRefreshing) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              role="status" aria-live="polite"
              className="fixed left-1/2 -translate-x-1/2 top-[calc(env(safe-area-inset-top,0px)+8px)] z-(--z-sheet) flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-black/80 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-lg pointer-events-none"
            >
              <RefreshCw 
                size={16}
                className={`text-primary ${isAnyRefreshing ? 'animate-spin' : ''}`}
                style={{
                  transform: !isAnyRefreshing ? `rotate(${pullY * 4}deg)` : undefined
                }}
              />
              <span className="text-[10px] font-black uppercase tracking-widest text-black/50 dark:text-white/50">
                {isAnyRefreshing ? 'Updating...' : pullY > 60 ? 'Release to refresh' : 'Pull down to update'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* S9: in-flow spacer provides the pull push (moves static content only —
            position:fixed chrome is unaffected; the old y:pullY*0.5 content
            transform that dragged the navbar/tab bar is gone). */}
        <AnimatePresence>
          {(pullY > 0 || isAnyRefreshing) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{
                height: isAnyRefreshing ? 60 : Math.max(0, pullY),
                opacity: 1
              }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full overflow-hidden shrink-0"
            />
          )}
        </AnimatePresence>

        {children}
      </div>
    </PullToRefreshContext.Provider>
  );
};

/** Hook for pages to perform pull‑to‑refresh */
export const usePullToRefresh = (pageKey: string, refreshCallback: () => Promise<void>) => {
  const context = useContext(PullToRefreshContext);
  const latestIdRef = useRef<number>(0);

  const start = async () => {
    if (!context) {
      logger.warn('PullToRefreshContext not found');
      return;
    }
    const requestId = context.triggerRefresh(pageKey);
    latestIdRef.current = requestId;
    try {
      await refreshCallback();
      finishRefresh(pageKey, requestId);
    } catch (e) {
      cancelRefresh(pageKey, requestId);
    }
  };

  useEffect(() => {
    if (!context) return;
    const handleTrigger = () => {
      start();
    };
    window.addEventListener('pull-to-refresh-trigger', handleTrigger);
    return () => {
      window.removeEventListener('pull-to-refresh-trigger', handleTrigger);
    };
  }, [context, refreshCallback]);

  // Expose the current refreshing flag
  const refreshing = context ? context.isRefreshing(pageKey) : false;

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
