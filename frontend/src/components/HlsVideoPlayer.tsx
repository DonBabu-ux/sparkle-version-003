import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import Hls from 'hls.js';
import { Loader2 } from 'lucide-react';

interface HlsVideoPlayerProps {
  src?: string;
  streamingSrc?: string;
  poster?: string;
  active?: boolean;
  muted?: boolean;
  loop?: boolean;
  className?: string;
  onTimeUpdate?: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onLoadedData?: () => void;
  onQualityChange?: (quality: string) => void;
}

const HlsVideoPlayer = forwardRef<HTMLVideoElement, HlsVideoPlayerProps>(({
  src,
  streamingSrc,
  poster,
  active = true,
  muted = false,
  loop = true,
  className = "",
  onTimeUpdate,
  onLoadedData,
  onQualityChange
}, ref) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  // Buffering state removed for seamless experience

  // Expose the video element to parent components via ref
  useImperativeHandle(ref, () => localVideoRef.current!);

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;

    if (streamingSrc && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        // Start at the highest quality level
        startLevel: -1, 
        // We'll manually set it to highest once parsed
      });
      hlsRef.current = hls;
      hls.loadSource(streamingSrc);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Force and LOCK the highest quality level (Fixed HD)
        hls.currentLevel = hls.levels.length - 1;
        hls.loadLevel = hls.levels.length - 1;
        hls.autoLevelEnabled = false; // Disable switching
        if (active) video.play().catch(() => {});
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        const level = hls.levels[data.level];
        if (level && onQualityChange) {
          const height = level.height;
          onQualityChange(`${height}p`);
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              // If manifest fails to load (400, 404), fall back to MP4
              if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT) {
                console.warn("HLS Manifest failed, falling back to MP4:", streamingSrc);
                hls.destroy();
                if (src) video.src = src;
              } else {
                hls.startLoad();
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              if (src) video.src = src;
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari/iOS)
      video.src = streamingSrc || src || '';
    } else if (src) {
      // Fallback to regular MP4
      video.src = src;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamingSrc, src]);

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;

    if (active) {
      video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [active]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <video
        ref={localVideoRef}
        muted={muted}
        loop={loop}
        playsInline
        crossOrigin="anonymous"
        preload="auto"
        onTimeUpdate={onTimeUpdate}
        onWaiting={() => {}}
        onPlaying={() => {}}
        onLoadedData={onLoadedData}
        className={`w-full h-full object-cover`}
      />
      {/* Buffering overlay removed */}
    </div>
  );
});

export default HlsVideoPlayer;
