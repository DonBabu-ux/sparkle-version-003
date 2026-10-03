import { useRef, useCallback, useEffect } from 'react';

/**
 * Hook to detect long press gestures with touch/pointer movement tolerance.
 * @param onLongPress Callback invoked after press duration.
 * @param ms Duration (ms) to consider as long press (default 500).
 */
export function useLongPress(onLongPress: () => void, ms: number = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== undefined && e.button !== 0) return;

      startPosRef.current = { x: e.clientX, y: e.clientY };
      firedRef.current = false;

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        onLongPress();
      }, ms);
    },
    [onLongPress, ms]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startPosRef.current) return;
      const dx = Math.abs(e.clientX - startPosRef.current.x);
      const dy = Math.abs(e.clientY - startPosRef.current.y);
      if (dx > 10 || dy > 10) {
        cancel();
      }
    },
    [cancel]
  );

  const onPointerUp = useCallback(() => {
    cancel();
  }, [cancel]);

  const onPointerCancel = useCallback(() => {
    cancel();
  }, [cancel]);

  const onClick = useCallback((e: React.MouseEvent) => {
    if (firedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      firedRef.current = false;
    }
  }, []);

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onClick,
  };
}

