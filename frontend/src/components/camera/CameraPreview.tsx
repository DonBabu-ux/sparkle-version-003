import React, { useRef, useEffect } from 'react';

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
  onZoomChange 
}: CameraPreviewProps) {
  const touchStartDist = useRef<number | null>(null);

  // Handle pinch-to-zoom touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartDist.current = dist;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDist.current && onZoomChange) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      
      const factor = dist / touchStartDist.current;
      const newZoom = Math.min(Math.max(1, zoomLevel * factor), 5); // caps zoom at 5x
      onZoomChange(newZoom);
      touchStartDist.current = dist;
    }
  };

  const handleTouchEnd = () => {
    touchStartDist.current = null;
  };

  return (
    <div 
      className="absolute inset-0 w-full h-full bg-black overflow-hidden flex items-center justify-center select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover transition-all duration-300 pointer-events-none`}
        style={{
          filter: activeFilter.css,
          transform: `scale(${zoomLevel}) ${facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)'}`,
          transformOrigin: 'center center',
          willChange: 'transform'
        }}
      />

      {/* Touch-to-focus ring backdrop indicator (can trigger flash/light on double tap) */}
      <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
        {zoomLevel > 1 && (
          <div className="absolute top-24 bg-black/40 backdrop-blur-md border border-white/10 text-white font-black uppercase tracking-widest text-[9px] px-3 py-1.5 rounded-full shadow-lg">
            Zoom: {zoomLevel.toFixed(1)}x
          </div>
        )}
      </div>
    </div>
  );
}
