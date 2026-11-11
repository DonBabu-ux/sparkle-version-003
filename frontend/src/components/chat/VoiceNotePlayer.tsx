import { useState, useEffect, useRef } from 'react';
import { AlertCircle, Play, Pause } from 'lucide-react';
import AudioSessionManager from '../../audio/managers/AudioSessionManager';
import { logger } from '../../utils/logger';

/**
 * Audio player with a waveform, plus the three module-level values that exist
 * only to support it:
 *
 *   SYNTHETIC_BARS   - precomputed bar heights shown before the real peaks
 *                      have decoded, so the waveform never appears empty
 *   voiceWaveformCache - URL -> peaks, so replaying a note does not re-decode
 *   computeVoicePeaks - decodes the audio into normalised amplitude peaks
 *
 * AudioSessionManager stays imported in Messages.tsx as well, because four
 * other call sites there use it.
 */

const voiceWaveformCache = new Map<string, number[]>();
const SYNTHETIC_BARS = Array.from({ length: 32 }, (_, i) => 0.15 + Math.abs(Math.sin(i * 0.4)) * 0.85);

/** Decodes an audio URL into normalised amplitude peaks (0..1) for rendering. */
async function computeVoicePeaks(url: string, buckets = 32): Promise<number[]> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    const audio = await ctx.decodeAudioData(buf);
    const data = audio.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / buckets));
    const peaks: number[] = [];
    for (let b = 0; b < buckets; b++) {
      let max = 0;
      const start = b * step;
      const end = Math.min(start + step, data.length);
      for (let j = start; j < end; j++) max = Math.max(max, Math.abs(data[j]));
      peaks.push(max);
    }
    const loudest = Math.max(...peaks, 0.0001);
    return peaks.map((p) => Math.max(0.08, p / loudest));
  } finally {
    ctx.close().catch(() => {});
  }
}

const VoiceNotePlayer = ({ url }: { url: string }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [peaks, setPeaks] = useState<number[] | null>(() => voiceWaveformCache.get(url) ?? null);
  const [audioError, setAudioError] = useState(false);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        AudioSessionManager.unregisterVoicePlayback(audioRef.current);
      }
    };
  }, []);

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
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration || 0);
  };

  const toggleSpeed = () => {
    if (!audioRef.current) return;
    let nextRate = 1;
    if (playbackRate === 1) nextRate = 1.5;
    else if (playbackRate === 1.5) nextRate = 2;
    else nextRate = 1;

    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  // Decode the real waveform once per URL; synthetic bars remain as fallback
  // when decoding is unavailable (CORS-blocked, exotic codec, decoding error).
  useEffect(() => {
    let cancelled = false;
    const cached = voiceWaveformCache.get(url);
    if (cached) {
      setPeaks(cached);
      return;
    }
    computeVoicePeaks(url)
      .then((p) => {
        voiceWaveformCache.set(url, p);
        if (!cancelled) setPeaks(p);
      })
      .catch(() => {
        if (!cancelled) setPeaks(null);
      });
    return () => { cancelled = true; };
  }, [url]);

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!waveformRef.current || !audioRef.current || duration <= 0) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = fraction * duration;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || time < 0) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (audioError) {
    return (
      <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3 min-w-[240px] max-w-[300px] select-none">
        <AlertCircle size={18} className="text-white/40 shrink-0" />
        <span className="flex-1 text-[11px] font-bold text-white/50">Voice note unavailable</span>
        <button
          type="button"
          onClick={() => {
            setAudioError(false);
            setPeaks(voiceWaveformCache.get(url) ?? null);
            if (audioRef.current) audioRef.current.load();
          }}
          className="px-2 py-1 rounded-lg bg-white/10 text-white text-[10px] font-black border border-white/5 hover:bg-white/20 transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl p-3 min-w-[240px] max-w-[300px] select-none">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onError={() => setAudioError(true)}
        onPlay={() => {
          setIsPlaying(true);
          if (audioRef.current) AudioSessionManager.registerVoicePlayback(audioRef.current);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />
      <button
        type="button"
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all shrink-0 shadow-md"
      >
        {isPlaying ? <Pause size={18} strokeWidth={2.5} fill="white" /> : <Play size={18} strokeWidth={2.5} fill="white" className="ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1 min-w-0 cursor-pointer" onClick={handleWaveformClick}>
        <div ref={waveformRef} className="flex items-end gap-[3px] h-[22px] px-1 overflow-hidden">
          {(peaks ?? SYNTHETIC_BARS).map((peak, i) => {
            const progress = duration > 0 ? currentTime / duration : 0;
            const barIndex = i / (peaks?.length ?? SYNTHETIC_BARS.length);
            const isActive = progress >= barIndex;
            const height = 4 + peak * 16;
            return (
              <div
                key={i}
                className="flex-1 rounded-full transition-all duration-150"
                style={{
                  height: `${height}px`,
                  backgroundColor: isActive ? '#ff1493' : 'rgba(255,255,255,0.2)'
                }}
              />
            );
          })}
        </div>
        <div className="flex justify-between items-center text-[10px] text-white/50 font-bold uppercase tracking-wider">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration || 0)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={toggleSpeed}
        className="px-2 py-1 rounded-lg bg-white/10 text-white text-[10.5px] font-black border border-white/5 hover:bg-white/20 transition-all active:scale-95 shrink-0"
      >
        {playbackRate}x
      </button>
    </div>
  );
};

export default VoiceNotePlayer;
