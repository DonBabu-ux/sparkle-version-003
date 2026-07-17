import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, AlertCircle, RefreshCw } from 'lucide-react';
import { useNetworkStore } from '../store/networkStore';

export const OfflineIndicator: React.FC = () => {
  const { isOffline, quality } = useNetworkStore();
  const [showWeak, setShowWeak] = useState(false);
  // Track the previous quality so we only show the banner on a *new* transition
  // to 'unstable', not every time the network API fires with the same value.
  const prevQualityRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOffline && quality === 'unstable' && prevQualityRef.current !== 'unstable') {
      // Newly entered unstable state — show banner and auto-dismiss after 3 s
      setShowWeak(true);
      const timer = setTimeout(() => setShowWeak(false), 3000);
      prevQualityRef.current = 'unstable';
      return () => clearTimeout(timer);
    } else if (quality !== 'unstable') {
      // Left unstable state — reset so the banner can show again next time
      prevQualityRef.current = quality;
      setShowWeak(false);
    }
  }, [isOffline, quality]);

  return (
    <AnimatePresence>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed top-[calc(4rem+env(safe-area-inset-top))] sm:top-4 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-md bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-3 flex items-center justify-between shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center text-red-500">
              <WifiOff size={16} />
            </div>
            <div>
              <p className="text-[13px] font-black text-white uppercase tracking-wider leading-none">Offline Mode</p>
              <p className="text-[11px] text-white/50 font-bold uppercase tracking-widest mt-1">Browsing cached content</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">Cached</span>
          </div>
        </motion.div>
      )}

      {showWeak && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed top-[calc(4rem+env(safe-area-inset-top))] sm:top-4 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-md bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-3 flex items-center justify-between shadow-2xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
              <AlertCircle size={16} />
            </div>
            <div>
              <p className="text-[13px] font-black text-white uppercase tracking-wider leading-none">Weak Connection Detected</p>
              <p className="text-[11px] text-white/50 font-bold uppercase tracking-widest mt-1">Lower Quality Media Enabled</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 animate-spin">
            <RefreshCw size={12} className="text-amber-500" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
