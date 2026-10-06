import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ArrowUp } from 'lucide-react';
import api from '../../api/api';
import { logger } from '../../utils/logger';

interface PullUpDisappearingGestureProps {
  chatId: string;
  disappearingDuration: number;
  onDurationChanged?: (newDuration: number) => void;
  children: React.ReactNode;
}

export const PullUpDisappearingGesture: React.FC<PullUpDisappearingGestureProps> = ({
  chatId,
  disappearingDuration,
  onDurationChanged,
  children,
}) => {
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const startYRef = useRef<number | null>(null);
  const isThresholdMetRef = useRef(false);

  const THRESHOLD = 80; // pixels to pull upward from bottom

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only register bottom touch start if near bottom 120px of window
    const touch = e.touches[0];
    const windowHeight = window.innerHeight;
    if (touch.clientY >= windowHeight - 140) {
      startYRef.current = touch.clientY;
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startYRef.current === null) return;
    const touch = e.touches[0];
    const deltaY = startYRef.current - touch.clientY; // positive when pulling UP

    if (deltaY > 0) {
      // Clamped upward pull distance
      const distance = Math.min(deltaY * 0.6, 120);
      setPullY(distance);
      isThresholdMetRef.current = distance >= THRESHOLD;
    } else {
      setPullY(0);
      isThresholdMetRef.current = false;
    }
  };

  const handleTouchEnd = async () => {
    if (isThresholdMetRef.current && chatId) {
      // Toggle disappearing messages duration (Off -> 24h / 86400s -> Off)
      const targetDuration = disappearingDuration > 0 ? 0 : 86400;
      try {
        const res = await api.patch(`/messages/${chatId}/privacy`, {
          disappearingDuration: targetDuration,
        });
        const newDur = res.data?.disappearingDuration ?? targetDuration;
        if (onDurationChanged) onDurationChanged(newDur);
      } catch (err) {
        logger.error('Failed to toggle disappearing messages via pull-up gesture:', err);
      }
    }

    startYRef.current = null;
    setIsPulling(false);
    setPullY(0);
    isThresholdMetRef.current = false;
  };

  const isEnabled = disappearingDuration > 0;

  return (
    <div
      className="relative flex-1 flex flex-col min-h-0 overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {/* Wrapped Conversation Content */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </div>

      {/* Subtle Pull-Up Indicator Overlay */}
      <AnimatePresence>
        {isPulling && pullY > 15 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: -pullY * 0.3 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-16 left-0 right-0 flex justify-center pointer-events-none z-50 px-4"
          >
            <div className="bg-[#121212]/90 border border-white/15 backdrop-blur-xl px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 text-white select-none">
              <motion.div animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.8 }}>
                <ArrowUp size={16} className={pullY >= THRESHOLD ? 'text-[#ff1493]' : 'text-white/60'} />
              </motion.div>
              <Clock size={16} className="text-[#ff1493]" />
              <span className="text-xs font-bold tracking-wide">
                {pullY >= THRESHOLD
                  ? isEnabled
                    ? 'Release to disable disappearing messages'
                    : 'Release to enable disappearing messages (24h)'
                  : isEnabled
                    ? 'Pull up to turn off disappearing messages'
                    : 'Pull up to activate disappearing messages'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
