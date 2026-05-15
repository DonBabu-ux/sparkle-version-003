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
  const [isBuffering, setIsBuffering] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Expose the video element to parent components via ref
  useImperativeHandle(ref, () => localVideoRef.current!);

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;

    if (streamingSrc && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        abrEwmaDefaultEstimate: 5000000, // 5Mbps initial estimate for HD
        testBandwidth: false,
        autoStartLoad: true,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        capLevelToPlayerSize: false
      });
      hlsRef.current = hls;
      hls.loadSource(streamingSrc);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
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
              hls.startLoad();
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
        poster={poster}
        muted={muted}
        loop={loop}
        playsInline
        crossOrigin="anonymous"
        preload="auto"
        onTimeUpdate={onTimeUpdate}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onLoadedData={() => {
          setIsReady(true);
          if (onLoadedData) onLoadedData();
        }}
        className={`w-full h-full object-cover transition-opacity duration-500 ${isReady ? 'opacity-100' : 'opacity-0'}`}
      />
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
          <Loader2 className="w-10 h-10 text-white/50 animate-spin" />
        </div>
      )}
    </div>
  );
});

export default HlsVideoPlayer;
