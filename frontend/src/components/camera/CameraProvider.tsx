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
  
  // Controls
  requestPermission: () => Promise<boolean>;
  toggleFacingMode: () => void;
  toggleFlash: () => void;
  setZoomLevel: (zoom: number) => void;
  
  // Media outputs
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  capturePhoto: (videoEl: HTMLVideoElement, filterCss: string) => Promise<string | null>;
  startVideoRecording: () => void;
  stopVideoRecording: () => Promise<File | null>;
}

const CameraContext = createContext<CameraContextType | undefined>(undefined);

export function CameraProvider({ children }: { children: React.ReactNode }) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('back');
  const [flash, setFlash] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<any>(null);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
        console.log(`📸 Released camera track: ${track.label}`);
      });
      setStream(null);
    }
    
    // Stop recording intervals
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
  }, [stream]);

  // Request permissions
  const requestPermission = useCallback(async () => {
    const granted = await CameraService.requestPermissions();
    setHasPermission(granted);
    return granted;
  }, []);

  // Boot up camera
  const startCamera = useCallback(async () => {
    // Release any old tracks first
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }

    try {
      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: true
      };

      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      setHasPermission(true);
      console.log('🎉 Embedded Camera MediaStream successfully initialized.');
    } catch (err) {
      console.warn('Audio constraints failed, falling back to video-only stream:', err);
      try {
        const fallbackConstraints = {
          video: {
            facingMode: facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        };
        const videoStream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        setStream(videoStream);
        setHasPermission(true);
      } catch (e) {
        console.error('Failed to initialize local camera stream:', e);
        setHasPermission(false);
      }
    }
  }, [facingMode, stream]);

  // Auto clean-up on destroy
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [stream]);

  // Toggle camera direction
  const toggleFacingMode = useCallback(() => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setZoomLevel(1); // Reset zoom on direction flip
  }, []);

  // Flash toggling
  const toggleFlash = useCallback(() => {
    setFlash(prev => !prev);
  }, []);

  // Take Image snapshot using Canvas
  const capturePhoto = useCallback(async (videoEl: HTMLVideoElement, filterCss: string): Promise<string | null> => {
    if (!videoEl) return null;
    
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoEl.videoWidth || videoEl.clientWidth;
      canvas.height = videoEl.videoHeight || videoEl.clientHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      // Apply CSS Filters on Canvas rendering context
      if (filterCss && filterCss !== 'none') {
        ctx.filter = filterCss;
      }

      // Handle selfies mirroring transformations
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      // Draw active video frames
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      return dataUrl;
    } catch (e) {
      console.error('Canvas snapshot extraction failed:', e);
      return null;
    }
  }, [facingMode]);

  // Video recording capture
  const startVideoRecording = useCallback(() => {
    if (!stream) return;

    recordedChunksRef.current = [];
    let options = { mimeType: 'video/webm;codecs=vp9' };
    
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm;codecs=vp8' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/mp4' }; // Safari & native iOS fallback
      }
    }

    try {
      const recorder = new MediaRecorder(stream, options);
      
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(200); // 200ms slices

      setIsRecording(true);
      setRecordingSeconds(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);

      console.log('🎥 Started dynamic HTML5 video MediaRecorder.');
    } catch (err) {
      console.error('Failed to start MediaRecorder:', err);
    }
  }, [stream]);

  const stopVideoRecording = useCallback(async (): Promise<File | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'video/webm' });
        const extension = recorder.mimeType.includes('mp4') ? 'mp4' : 'webm';
        const fileObj = new File([blob], `recording-${Date.now()}.${extension}`, {
          type: blob.type
        });
        
        console.log('🎬 Stopped MediaRecorder. Output file:', fileObj.name, fileObj.size);
        resolve(fileObj);
      };

      recorder.stop();
      setIsRecording(false);
      
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    });
  }, []);

  return (
    <CameraContext.Provider value={{
      stream,
      hasPermission,
      facingMode,
      flash,
      zoomLevel,
      isRecording,
      recordingSeconds,
      requestPermission,
      toggleFacingMode,
      toggleFlash,
      setZoomLevel,
      startCamera,
      stopCamera,
      capturePhoto,
      startVideoRecording,
      stopVideoRecording
    }}>
      {children}
    </CameraContext.Provider>
  );
}

export function useCamera() {
  const context = useContext(CameraContext);
  if (!context) {
    throw new Error('useCamera must be used within a CameraProvider');
  }
  return context;
}
