import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { CameraService } from '../../services/CameraService';

interface CameraContextType {
  stream: MediaStream | null;
  hasPermission: boolean | null;
  facingMode: 'user' | 'environment';
  flash: boolean;
  zoomLevel: number;
  isRecording: boolean;
  recordingSeconds: number;

  requestPermission: () => Promise<boolean>;
  toggleFacingMode: () => void;
  toggleFlash: () => void;
  setZoomLevel: (zoom: number) => void;

  startCamera: () => Promise<void>;
  stopCamera: () => void;

  capturePhoto: (videoEl: HTMLVideoElement, filterCss: string) => Promise<string | null>;
  startVideoRecording: () => void;
  stopVideoRecording: () => Promise<File | null>;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export function CameraProvider({ children }: { children: React.ReactNode }) {
  const [stream, setStream]               = useState<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [facingMode, setFacingMode]       = useState<'user' | 'environment'>('environment');
  const [flash, setFlash]                 = useState(false);
  const [zoomLevel, setZoomLevel]         = useState(1);
  const [isRecording, setIsRecording]     = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // ── Refs (avoid stale-closure issues in callbacks) ─────────────────────────
  const streamRef      = useRef<MediaStream | null>(null);      // live stream handle
  const facingModeRef  = useRef<'user' | 'environment'>('environment'); // live facing

  const mediaRecorderRef    = useRef<MediaRecorder | null>(null);
  const recordedChunksRef   = useRef<Blob[]>([]);
  const recordingIntervalRef= useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep facingModeRef in sync with state (set by toggleFacingMode)
  useEffect(() => { facingModeRef.current = facingMode; }, [facingMode]);

  // ── stopCamera ──────────────────────────────────────────────────────────────
  // Stable — no state in deps; uses refs only.
  const stopCamera = useCallback(() => {
    const current = streamRef.current;
    if (current) {
      current.getTracks().forEach(t => { t.stop(); });
      setStream(null);
      streamRef.current = null;
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
  }, []); // intentionally stable

  // ── startCamera ─────────────────────────────────────────────────────────────
  // Stable — reads facingMode from ref, not closure. This means the reference
  // never changes when facingMode changes, so CallerEffects won't re-fire.
  const startCamera = useCallback(async () => {
    // Release previous tracks first
    const existing = streamRef.current;
    if (existing) {
      existing.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setStream(null);
    }

    const facing = facingModeRef.current;

    const tryGetStream = async (audio: boolean): Promise<MediaStream> =>
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio,
      });

    try {
      let newStream: MediaStream;
      try {
        newStream = await tryGetStream(true);
      } catch {
        // Microphone denied or unavailable — fall back to video-only
        newStream = await tryGetStream(false);
      }
      streamRef.current = newStream;
      setStream(newStream);
      setHasPermission(true);
      console.log(`🎉 In-app camera stream ready (facing: ${facing}).`);
    } catch (err) {
      console.error('[CameraProvider] Failed to start stream:', err);
      setHasPermission(false);
    }
  }, [/* stable — reads facing from ref */]);

  // ── requestPermission ───────────────────────────────────────────────────────
  const requestPermission = useCallback(async () => {
    const granted = await CameraService.requestPermissions();
    setHasPermission(granted);
    return granted;
  }, []);

  // ── toggleFacingMode ────────────────────────────────────────────────────────
  // Updates the ref + state, then explicitly restarts the stream.
  // Because startCamera is stable, callers' useEffects won't fire again.
  const toggleFacingMode = useCallback(() => {
    const next: 'user' | 'environment' =
      facingModeRef.current === 'user' ? 'environment' : 'user';
    facingModeRef.current = next;
    setFacingMode(next);
    setZoomLevel(1);
    startCamera(); // restart with the new facing — ref is already updated
  }, [startCamera]);

  // ── toggleFlash ─────────────────────────────────────────────────────────────
  const toggleFlash = useCallback(() => setFlash(p => !p), []);

  // ── Background / Foreground lifecycle ───────────────────────────────────────
  // Release camera when the app moves to background so Android doesn't block
  // the camera for the system camera or other apps.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        console.log('📴 App backgrounded — pausing camera.');
        stopCamera();
      }
      // Foreground recovery: CreateStory's phase-based useEffect handles restart.
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [stopCamera]);

  // ── Global cleanup on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
    };
  }, []);

  // ── capturePhoto (Canvas snapshot) ─────────────────────────────────────────
  const capturePhoto = useCallback(
    async (videoEl: HTMLVideoElement, filterCss: string): Promise<string | null> => {
      if (!videoEl) return null;
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = videoEl.videoWidth  || videoEl.clientWidth;
        canvas.height = videoEl.videoHeight || videoEl.clientHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        if (filterCss && filterCss !== 'none') ctx.filter = filterCss;

        // Mirror front-cam so selfies look natural
        if (facingModeRef.current === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }

        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.92);
      } catch (e) {
        console.error('[CameraProvider] Canvas snapshot failed:', e);
        return null;
      }
    },
    [] // reads facingMode from ref — stable
  );

  // ── Video recording ─────────────────────────────────────────────────────────
  const startVideoRecording = useCallback(() => {
    const current = streamRef.current;
    if (!current) return;

    recordedChunksRef.current = [];

    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/mp4',
      'video/webm',
    ];
    const mimeType = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) ?? '';

    try {
      const recorder = new MediaRecorder(current, mimeType ? { mimeType } : undefined);
      recorder.ondataavailable = e => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(200); // 200 ms chunks for low-latency streaming

      setIsRecording(true);
      setRecordingSeconds(0);
      recordingIntervalRef.current = setInterval(
        () => setRecordingSeconds(s => s + 1), 1000
      );
      console.log(`🎥 Recording started (${mimeType || 'default codec'}).`);
    } catch (err) {
      console.error('[CameraProvider] MediaRecorder init failed:', err);
    }
  }, []);

  const stopVideoRecording = useCallback(async (): Promise<File | null> => {
    return new Promise(resolve => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') { resolve(null); return; }

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, {
          type: recorder.mimeType || 'video/webm',
        });
        const ext  = recorder.mimeType?.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `sparkle-${Date.now()}.${ext}`, { type: blob.type });
        console.log(`🎬 Recording saved: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
        resolve(file);
      };

      recorder.stop();
      setIsRecording(false);
      setRecordingSeconds(0);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    });
  }, []);

  return (
    <CameraContext.Provider value={{
      stream, hasPermission, facingMode, flash, zoomLevel,
      isRecording, recordingSeconds,
      requestPermission, toggleFacingMode, toggleFlash, setZoomLevel,
      startCamera, stopCamera,
      capturePhoto, startVideoRecording, stopVideoRecording,
    }}>
      {children}
    </CameraContext.Provider>
  );
}

export function useCamera() {
  const ctx = useContext(CameraContext);
  if (!ctx) throw new Error('useCamera must be used inside <CameraProvider>');
  return ctx;
}
