import { useState, useEffect } from 'react';

/**
 * Shared time tick hook for live-updating relative timestamps and 12-hour window transitions.
 * Runs once every `intervalMs` (default 30 seconds), preventing per-row intervals.
 */
export const useTimeTick = (intervalMs: number = 30000): number => {
  const [tick, setTick] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setTick(Date.now());
    }, intervalMs);

    return () => clearInterval(timer);
  }, [intervalMs]);

  return tick;
};
