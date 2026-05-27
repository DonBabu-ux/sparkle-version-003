// src/hooks/useCamera.ts
import { useEffect, useRef, useState } from 'react';

/**
 * Hook to manage device camera preview.
 * Supports front (user) and back (environment) cameras.
 * Works on Android via Capacitor (if present) and falls back to
 * `navigator.mediaDevices.getUserMedia` on the web.
 */
export const useCamera = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [stream, setStream] = useState<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const constraints = {
        video: { facingMode },
        audio: false,
      } as MediaStreamConstraints;
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera error:', err);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Restart camera when facingMode changes
  useEffect(() => {
    stopCamera();
    startCamera();
    // cleanup on unmount
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  return { videoRef, startCamera, stopCamera, switchCamera, facingMode };
};
