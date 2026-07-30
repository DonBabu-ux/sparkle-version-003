import React, { useState, useRef } from 'react';
import { Lock } from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  onUnlockConsole?: () => void;
}

export const OfficialComposerFooter: React.FC<Props> = ({ onUnlockConsole }) => {
  const [holding, setHolding] = useState(false);
  const holdTimerRef = useRef<any>(null);

  const startHold = () => {
    setHolding(true);
    holdTimerRef.current = setTimeout(() => {
      setHolding(false);
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 150]);
      }
      if (onUnlockConsole) {
        onUnlockConsole();
      }
    }, 5000);
  };

  const cancelHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
    }
    setHolding(false);
  };

  return (
    <div
      onMouseDown={startHold}
      onMouseUp={cancelHold}
      onMouseLeave={cancelHold}
      onTouchStart={startHold}
      onTouchEnd={cancelHold}
      className={`w-full py-3.5 px-6 border-t backdrop-blur-xl flex flex-col items-center justify-center text-center gap-1 shadow-2xl select-none transition-all duration-300 relative overflow-hidden cursor-pointer ${
        holding ? 'bg-rose-950/40 border-rose-500/50' : 'bg-slate-950/95 border-[#22C55E]/30'
      }`}
    >
      {holding && (
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 5, ease: 'linear' }}
          className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#22C55E] via-rose-500 to-amber-500 origin-left"
        />
      )}
      <div className="flex items-center justify-center gap-2 text-xs font-extrabold tracking-wide">
        <Lock className={`w-3.5 h-3.5 transition-colors ${holding ? 'text-rose-400 animate-bounce' : 'text-[#22C55E]'}`} />
        <span className={holding ? 'text-rose-300' : 'text-[#22C55E]'}>
          {holding ? 'Unlocking Developer & Emergency Console…' : 'Only Sparkle can send messages in this conversation.'}
        </span>
      </div>
      <p className="text-[10.5px] font-medium text-slate-400">
        🔒 Official Sparkle Account — Trusted Platform Communication
      </p>
    </div>
  );
};
