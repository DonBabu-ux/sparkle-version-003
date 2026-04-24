import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Pause, Play, Volume2, VolumeX } from 'lucide-react';

interface Story {
  id: string;
  media_url: string;
  media_type: 'image' | 'video';
  caption?: string;
  created_at: string;
}

interface HighlightPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  coverUrl?: string;
  stories: Story[];
  ownerUsername?: string;
  ownerAvatar?: string;
}

const STORY_DURATION = 5000; // 5s per image

export default function HighlightPlayerModal({
  isOpen,
  onClose,
  title,
  stories,
  ownerUsername,
  ownerAvatar,
}: HighlightPlayerModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentStory = stories[currentIndex];
  const isVideo = currentStory?.media_type === 'video' ||
    currentStory?.media_url?.match(/\.(mp4|webm|ogg|mov)$/i);

  const goNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(i => i + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
      setProgress(0);
    }
  }, [currentIndex]);

  // Auto-advance timer for images
  useEffect(() => {
    if (!isOpen || paused || isVideo) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const interval = 50; // tick every 50ms
    timerRef.current = setInterval(() => {
      setProgress(p => {
        const next = p + (interval / STORY_DURATION) * 100;
        if (next >= 100) {
          goNext();
          return 0;
        }
        return next;
      });
    }, interval);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isOpen, paused, isVideo, currentIndex, goNext]);

  // Video auto-advance
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo) return;

    const handleTimeUpdate = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
      }
    };
    const handleEnded = () => goNext();

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.muted = muted;
    video.play().catch(() => {});

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
    };
  }, [currentIndex, isVideo, muted, goNext]);

  // Pause/resume video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isVideo) return;
    if (paused) video.pause();
    else video.play().catch(() => {});
  }, [paused, isVideo]);

  // Reset index when opened
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setProgress(0);
      setPaused(false);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') onClose();
      if (e.key === ' ') { e.preventDefault(); setPaused(p => !p); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, goNext, goPrev, onClose]);

  if (!isOpen || !stories.length) return null;

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/90">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className="relative w-full h-full sm:h-[85vh] sm:max-w-[420px] sm:max-h-[740px] sm:rounded-2xl overflow-hidden bg-black shadow-2xl flex flex-col select-none"
        style={{ zIndex: 1 }}
      >
        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-3 pb-0">
          {stories.map((_, idx) => (
            <div key={idx} className="flex-1 h-[3px] bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-none"
                style={{
                  width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-5 left-0 right-0 z-20 flex items-center justify-between px-4 pt-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full border-2 border-white/80 overflow-hidden shrink-0">
              <img src={ownerAvatar || '/uploads/avatars/default.png'} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-semibold text-sm leading-none">{ownerUsername || 'User'}</span>
              <span className="text-white/60 text-xs mt-0.5">{title}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setPaused(p => !p)} className="text-white/80 hover:text-white">
              {paused ? <Play size={18} fill="currentColor" /> : <Pause size={18} />}
            </button>
            {isVideo && (
              <button onClick={() => setMuted(m => !m)} className="text-white/80 hover:text-white">
                {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            )}
            <button onClick={onClose} className="text-white/80 hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Media */}
        <div className="flex-1 relative bg-black flex items-center justify-center">
          {isVideo ? (
            <video
              ref={videoRef}
              key={currentStory.id}
              src={currentStory.media_url}
              className="w-full h-full object-contain"
              playsInline
              muted={muted}
              autoPlay
            />
          ) : (
            <img
              key={currentStory.id}
              src={currentStory.media_url}
              alt=""
              className="w-full h-full object-contain"
            />
          )}

          {/* Caption */}
          {currentStory.caption && (
            <div className="absolute bottom-4 left-4 right-4 text-white text-sm font-medium text-center drop-shadow-lg bg-black/30 px-4 py-2 rounded-xl backdrop-blur-sm">
              {currentStory.caption}
            </div>
          )}
        </div>

        {/* Tap zones */}
        <div className="absolute inset-0 flex z-10 pointer-events-none">
          <div className="w-1/3 h-full pointer-events-auto cursor-pointer" onClick={goPrev} />
          <div
            className="flex-1 h-full pointer-events-auto cursor-pointer"
            onMouseDown={() => setPaused(true)}
            onMouseUp={() => setPaused(false)}
            onTouchStart={() => setPaused(true)}
            onTouchEnd={() => setPaused(false)}
          />
          <div className="w-1/3 h-full pointer-events-auto cursor-pointer" onClick={goNext} />
        </div>

        {/* Nav arrows (desktop) */}
        {currentIndex > 0 && (
          <button
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-1.5 text-white transition hidden md:flex"
            onClick={goPrev}
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {currentIndex < stories.length - 1 && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-1.5 text-white transition hidden md:flex"
            onClick={goNext}
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
