import React, { useEffect, useRef, useState } from 'react';
import { useNetworkStore } from '../store/networkStore';

interface VideoPlayerProps {
  src: string;
  className?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, className = '' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);
  const { quality } = useNetworkStore();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsIntersecting(entry.isIntersecting);
        });
      },
      {
        threshold: 0.6 // Play only when 60% of the video card is visible
      }
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isIntersecting) {
      // Re-hydrate source if it was unloaded for memory management
      if (!video.src) {
        video.src = src;
        video.load();
      }

      // Play video with error handling (browsers require user interaction for unmuted play)
      video.play().catch((err) => {
        console.warn('Auto-play blocked or interrupted:', err.message);
      });
    } else {
      // Pause video when out of viewport
      video.pause();

      // Release memory for offscreen video on weak connections
      if (quality === 'weak' || quality === 'unstable') {
        video.removeAttribute('src');
        video.load();
      }
    }
  }, [isIntersecting, src, quality]);

  // Adjust preload attribute dynamically based on network quality
  const preloadMode = quality === 'strong' ? 'auto' : 'metadata';

  return (
    <video
      ref={videoRef}
      loop
      muted
      playsInline
      controls
      preload={preloadMode}
      className={`w-full h-auto block max-h-[85vh] sm:max-h-[700px] object-contain ${className}`}
    />
  );
};

export default VideoPlayer;
