import { useRef, useEffect } from 'react';

/**
 * Hook to detect long press gestures.
 * @param onLongPress Callback invoked after press duration.
 * @param ms Duration (ms) to consider as long press (default 500).
 */
export function useLongPress(onLongPress: () => void, ms: number = 500) {
  const timerRef = useRef<number>();

  const start = () => {
    // @ts-ignore – window.setTimeout returns number in browser env
    timerRef.current = window.setTimeout(onLongPress, ms);
  };

  const cancel = () => {
    if (timerRef.current) {
      // @ts-ignore – clearTimeout accepts number
      clearTimeout(timerRef.current);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: cancel,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: cancel,
  } as const;
}
