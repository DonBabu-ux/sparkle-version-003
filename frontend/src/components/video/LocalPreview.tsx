// src/components/video/LocalPreview.tsx
import React, { useEffect } from 'react';
import { useCamera } from '../../hooks/useCamera';
import { RefreshCw, User } from 'lucide-react';
import { designTokens } from '../../theme/designTokens';

/**
 * Displays the live local camera preview for the video call.
 * Uses the `useCamera` hook which abstracts the Android/web camera handling.
 * The preview is shown as a floating mini‑preview with a switch‑camera button.
 */
export const LocalPreview: React.FC<{ isCameraOn: boolean }> = ({ isCameraOn }) => {
  const { videoRef, startCamera, stopCamera, switchCamera, facingMode } = useCamera();

  useEffect(() => {
    // Start preview when component mounts if camera is enabled
    if (isCameraOn) {
      startCamera();
    }
    // Clean up on unmount
    return () => {
      stopCamera();
    };
    // We only want to run this when isCameraOn changes
  }, [isCameraOn]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden bg-black/30 border border-white/10 shadow-xl">
      {isCameraOn ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center p-1">
            <span className="text-[9px] bg-black/50 text-white/80 px-1.5 py-0.5 rounded font-mono">
              You ({facingMode === 'user' ? 'Front' : 'Back'})
            </span>
            <button
              onClick={switchCamera}
              className="p-1 bg-white/20 hover:bg-white/30 active:scale-90 rounded-full transition-all"
              title="Switch camera"
            >
              <RefreshCw size={12} className="text-white" />
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-white/50">
          <User size={32} className="opacity-70" />
          <span className="mt-1 text-[9px]">Camera Off</span>
        </div>
      )}
    </div>
  );
};
