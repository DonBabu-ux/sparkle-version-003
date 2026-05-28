import React, { createContext, useContext, ReactNode, useRef, useEffect, useState } from 'react';
import { useRefreshStore } from '../store/refreshStore';
import { useGesture } from '@use-gesture/react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

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

  useGesture(
    {
      onDrag: ({ down, movement: [, my] }) => {
        if (containerRef.current && containerRef.current.scrollTop === 0 && my > 0) {
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
        if (containerRef.current && containerRef.current.scrollTop === 0 && my > 70) {
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
          height: '100vh', 
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y'
        }}
      >
        {/* Animated Refresh Indicator Container */}
        <AnimatePresence>
          {(pullY > 10 || isAnyRefreshing) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ 
                height: isAnyRefreshing ? 60 : Math.max(0, pullY), 
                opacity: 1 
              }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="w-full flex items-center justify-center overflow-hidden shrink-0 z-50 bg-transparent"
            >
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-black/80 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-lg">
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          animate={{ y: isAnyRefreshing ? 0 : pullY * 0.5 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="w-full min-h-full"
        >
          {children}
        </motion.div>
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
      finishRefresh(pageKey, requestId);
    } catch (e) {
      cancelRefresh(pageKey, requestId);
    }
  };

  useEffect(() => {
    const handleTrigger = () => {
      start();
    };
    window.addEventListener('pull-to-refresh-trigger', handleTrigger);
    return () => {
      window.removeEventListener('pull-to-refresh-trigger', handleTrigger);
    };
  }, [refreshCallback]);

  // Expose the current refreshing flag
  const refreshing = isRefreshing(pageKey);

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
