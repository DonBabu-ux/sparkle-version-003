import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CameraPreviewProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  facingMode: 'user' | 'environment';
  activeFilter: { id: string; name: string; css: string };
  zoomLevel: number;
  onZoomChange?: (zoom: number) => void;
}

export default function CameraPreview({
  videoRef,
  facingMode,
  activeFilter,
  zoomLevel,
  onZoomChange,
}: CameraPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartDist = useRef<number | null>(null);
  const baseZoomRef = useRef<number>(1);

  // Tap-to-focus state — shows the focus ring
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Tap to Focus ─────────────────────────────────────────────────────────
  const handleTap = useCallback(
    (e: React.TouchEvent | React.MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      let clientX: number, clientY: number;
      if ('touches' in e && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = e.clientX;
        clientY = e.clientY;
      } else return;

      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;

      // Show focus ring at tap point
      setFocusPoint({ x, y });

      // Attempt native focus point constraint (supported on some Android browsers)
      if (videoRef.current?.srcObject) {
        const track = (videoRef.current.srcObject as MediaStream)
          .getVideoTracks()[0];
        if (track && typeof track.getCapabilities === 'function') {
          try {
            const capabilities = track.getCapabilities() as any;
            if (capabilities.focusMode?.includes('manual') && 'applyConstraints' in track) {
              track.applyConstraints({
                advanced: [
                  {
                    pointsOfInterest: [{ x: clientX / rect.width, y: clientY / rect.height }],
                    focusMode: 'single-shot',
                  } as any,
                ],
              } as any).catch(() => {/* silently ignore unsupported constraints */});
            }
          } catch {/* not supported on this device — focus ring is purely cosmetic */}
        }
      }

      // Auto-hide focus ring after 1.5s
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
      focusTimerRef.current = setTimeout(() => setFocusPoint(null), 1500);
    },
    [videoRef]
  );

  // ─── Pinch to Zoom ────────────────────────────────────────────────────────
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDist.current = dist;
      baseZoomRef.current = zoomLevel;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist.current && onZoomChange) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchStartDist.current;
      const newZoom = Math.min(Math.max(1, baseZoomRef.current * factor), 5);
      onZoomChange(newZoom);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      touchStartDist.current = null;
    }
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full bg-black overflow-hidden flex items-center justify-center select-none"
      onTouchStart={(e) => { handleTouchStart(e); if (e.touches.length === 1) handleTap(e); }}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleTap}
    >
      {/* Live camera preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover pointer-events-none"
        style={{
          filter: activeFilter.css !== 'none' ? activeFilter.css : undefined,
          transform: `scale(${zoomLevel}) ${facingMode === 'user' ? 'scaleX(-1)' : ''}`,
          transformOrigin: 'center center',
          willChange: 'transform',
          // Edge-to-edge: extend behind the status bar (handled by the parent's
          // absolute inset-0, but we explicitly avoid any top margin here)
          marginTop: 0,
        }}
      />

      {/* Zoom indicator badge */}
      <AnimatePresence>
        {zoomLevel > 1.05 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-xl border border-white/10 text-white font-black uppercase tracking-widest text-[9px] px-3 py-1.5 rounded-full shadow-lg pointer-events-none z-10"
          >
            {zoomLevel.toFixed(1)}×
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tap-to-focus ring */}
      <AnimatePresence>
        {focusPoint && (
          <motion.div
            key={`focus-${focusPoint.x}-${focusPoint.y}`}
            initial={{ opacity: 1, scale: 1.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute w-16 h-16 border-2 border-yellow-400 rounded-xl pointer-events-none z-20"
            style={{
              left: `${focusPoint.x}%`,
              top: `${focusPoint.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-yellow-400 -translate-x-0.5 -translate-y-0.5" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-yellow-400 translate-x-0.5 -translate-y-0.5" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-yellow-400 -translate-x-0.5 translate-y-0.5" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-yellow-400 translate-x-0.5 translate-y-0.5" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
