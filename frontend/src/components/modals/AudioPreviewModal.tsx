import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Music, X, Send } from 'lucide-react';
import AudioSessionManager from '../../audio/managers/AudioSessionManager';
import { logger } from '../../utils/logger';
import { useModalA11y } from '../../hooks/useModalA11y';

interface AudioPreviewModalProps {
  file: File | null;
  isOpen: boolean;
  onClose: () => void;
  onSend: (file: File) => void;
}

export const AudioPreviewModal: React.FC<AudioPreviewModalProps> = ({
  file,
  isOpen,
  onClose,
  onSend
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const a11yRef = useModalA11y(isOpen, () => { audioRef.current?.pause(); onClose(); });

  useEffect(() => {
    if (file && isOpen) {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false);

      return () => {
        URL.revokeObjectURL(url);
        setAudioUrl(null);
      };
    } else {
      setAudioUrl(null);
    }
  }, [file, isOpen]);

  if (!isOpen || !file) return null;

  const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      AudioSessionManager.registerVoicePlayback(audioRef.current);
      audioRef.current.play().catch(logger.error);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  const formatTime = (timeSeconds: number) => {
    if (isNaN(timeSeconds) || timeSeconds < 0) return '0:00';
    const mins = Math.floor(timeSeconds / 60);
    const secs = Math.floor(timeSeconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleSendClick = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onSend(file);
  };

  const handleCancelClick = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    onClose();
  };

  return (
    <AnimatePresence>
      <div ref={a11yRef} role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-(--z-modal) flex items-center justify-center p-4 select-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
          onClick={handleCancelClick}
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative z-10 w-full max-w-sm bg-[#121212]/95 border border-white/15 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl text-white flex flex-col items-center gap-6"
        >
          {/* Header */}
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400">
                <Music size={18} />
              </div>
              <span className="text-xs font-black uppercase tracking-wider text-white/70">Audio Attachment</span>
            </div>
            <button
              type="button"
              onClick={handleCancelClick}
              className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-full transition-all"
            >
              <X size={20} />
            </button>
          </div>

          {/* Audio Artwork / Visual */}
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-purple-600/30 to-pink-600/30 border border-white/10 flex flex-col items-center justify-center shadow-inner relative overflow-hidden group">
            <div className="absolute inset-0 bg-purple-500/10 animate-pulse" />
            <Music size={36} className="text-purple-300 z-10 drop-shadow-md" />
          </div>

          {/* Metadata info */}
          <div className="w-full text-center px-2">
            <h3 className="text-sm font-bold text-white/90 truncate max-w-[260px] mx-auto" title={file.name}>
              {file.name}
            </h3>
            <p className="text-[11px] font-medium text-white/40 mt-0.5">
              {fileSizeMB} MB • {file.type || 'audio/media'}
            </p>
          </div>

          {/* Audio Player Controls */}
          {audioUrl && (
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
              <audio
                ref={audioRef}
                src={audioUrl}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={() => setIsPlaying(false)}
              />

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="w-10 h-10 rounded-full bg-[#ff1493] text-white flex items-center justify-center hover:opacity-90 active:scale-95 transition-all shrink-0 shadow-lg shadow-pink-500/20"
                >
                  {isPlaying ? (
                    <Pause size={18} strokeWidth={2.5} fill="white" />
                  ) : (
                    <Play size={18} strokeWidth={2.5} fill="white" className="ml-0.5" />
                  )}
                </button>

                {/* Seeker */}
                <div className="flex-1 flex flex-col gap-1">
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer accent-[#ff1493]"
                  />
                  <div className="flex justify-between items-center text-[10px] font-bold text-white/40 tracking-wider">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="w-full grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancelClick}
              className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/80 font-bold text-xs transition-all border border-white/10 active:scale-95"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSendClick}
              className="w-full py-3 rounded-2xl bg-[#ff1493] hover:opacity-90 text-white font-bold text-xs transition-all shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2 active:scale-95"
            >
              <Send size={15} strokeWidth={2.5} />
              Send Audio
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
