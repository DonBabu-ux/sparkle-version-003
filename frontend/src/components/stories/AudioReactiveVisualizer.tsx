import React, { useEffect, useRef } from 'react';
import StoryAudioManager from '../../services/StoryAudioManager';

interface AudioReactiveVisualizerProps {
  isPlaying: boolean;
  barColor?: string;
  count?: number;
}

export const AudioReactiveVisualizer: React.FC<AudioReactiveVisualizerProps> = ({
  isPlaying,
  barColor = 'bg-rose-500',
  count = 18
}) => {
  const barsRef = useRef<HTMLDivElement[]>([]);
  const animationFrameId = useRef<number | null>(null);

  useEffect(() => {
    const audioManager = StoryAudioManager.getInstance();

    const updateVisuals = () => {
      if (!isPlaying) {
        // Return to resting state when paused
        barsRef.current.forEach((bar) => {
          if (bar) bar.style.height = '4px';
        });
        animationFrameId.current = requestAnimationFrame(updateVisuals);
        return;
      }

      const frequencyData = audioManager.getByteFrequencyData();
      const length = frequencyData.length;

      if (length > 0) {
        const step = Math.max(1, Math.floor(length / count));
        for (let i = 0; i < count; i++) {
          const bar = barsRef.current[i];
          if (bar) {
            // Read value from frequency data (0 - 255)
            const dataIndex = Math.min(i * step, length - 1);
            const value = frequencyData[dataIndex];
            
            // Map to percentage height range (15% to 100%)
            const heightPercent = 15 + (value / 255) * 85;
            bar.style.height = `${heightPercent}%`;
          }
        }
      } else {
        // Fallback decorative animation if Web Audio is loading or blocked by context autoplay restrictions
        const now = Date.now();
        for (let i = 0; i < count; i++) {
          const bar = barsRef.current[i];
          if (bar) {
            const heightPercent = 15 + Math.abs(Math.sin((now + i * 120) / 180)) * 75;
            bar.style.height = `${heightPercent}%`;
          }
        }
      }

      animationFrameId.current = requestAnimationFrame(updateVisuals);
    };

    updateVisuals();

    return () => {
      if (animationFrameId.current !== null) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isPlaying, count]);

  return (
    <div className="flex gap-0.5 items-end h-8 justify-center select-none w-full px-1">
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          ref={(el) => {
            if (el) barsRef.current[i] = el;
          }}
          className={`w-1 rounded-full transition-[height] duration-75 ease-out ${barColor}`}
          style={{ height: '4px' }}
        />
      ))}
    </div>
  );
};

export default AudioReactiveVisualizer;
