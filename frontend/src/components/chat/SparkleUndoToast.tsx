import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, CheckCircle2 } from 'lucide-react';

interface UndoToastProps {
  toast: {
    id: string;
    message: string;
    undoAction: () => void;
    commitAction: () => void;
    secondsLeft?: number;
  } | null;
  onDismiss: () => void;
}

export const SparkleUndoToast: React.FC<UndoToastProps> = ({ toast, onDismiss }) => {
  const [seconds, setSeconds] = useState(3);

  useEffect(() => {
    if (!toast) return;
    setSeconds(3);

    const timer = setInterval(() => {
      setSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          toast.commitAction();
          onDismiss();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [toast?.id]);

  if (!toast) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', damping: 22, stiffness: 320 }}
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-(--z-toast) bg-[#1a1a24]/95 border border-white/15 backdrop-blur-xl px-5 py-3 rounded-full shadow-2xl flex items-center gap-4 text-white text-xs font-semibold"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[#ff1493]" />
          <span>{toast.message}</span>
        </div>

        <button
          onClick={() => {
            toast.undoAction();
            onDismiss();
          }}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ff1493]/20 hover:bg-[#ff1493]/30 border border-[#ff1493]/40 text-[#ff1493] hover:text-white transition-all text-xs font-bold active:scale-95"
        >
          <RotateCcw size={13} />
          <span>Undo ({seconds})</span>
        </button>
      </motion.div>
    </AnimatePresence>
  );
};
