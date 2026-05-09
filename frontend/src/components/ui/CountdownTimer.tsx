import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  expiresAt: string;
  onEnd?: () => void;
  className?: string;
}

export const CountdownTimer = ({ expiresAt, onEnd, className }: CountdownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<{h:number, m:number, s:number} | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      const diff = new Date(expiresAt).getTime() - new Date().getTime();
      if (diff <= 0) {
        clearInterval(timer);
        if (onEnd) onEnd();
        return;
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ h, m, s });
    }, 1000);
    return () => clearInterval(timer);
  }, [expiresAt, onEnd]);

  if (!timeLeft) return null;

  return (
    <div className={`flex items-center gap-1.5 text-[10px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-100 ${className}`}>
      <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
      Ends in: {timeLeft.h > 0 && `${timeLeft.h}h `}{timeLeft.m}m {timeLeft.s}s
    </div>
  );
};

export default CountdownTimer;
