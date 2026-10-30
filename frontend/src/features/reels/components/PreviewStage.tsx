import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Music, Smile, Type, Captions, Scissors, Play, Pause,
  Wand2, Check, AlertCircle, Loader2, Plus,
} from 'lucide-react';
import { useReelCreatorStore } from '../reelCreatorStore';
import { StageShell, BottomSheet, InlineSpinner, PINK } from './shell';
import { useCreateMomentsTheme } from '../useCreateMomentsTheme';
import { transcribeMedia, makeCaptionsState } from '../services/captionsService';
import { stopPreview, togglePreview, subscribePlayback } from '../services/musicService';
import { showSuccess } from '../../../utils/toast';
import { logger } from '../../../utils/logger';

const EMOJI_SET = [
  '❤️', '🔥', '😂', '😍', '🎉', '👏', '💯', '✨',
  '😎', '🥳', '😢', '🥺', '👍', '🙌', '🌈', '⭐',
  '🍕', '☕', '🎵', '📸', '🌸', '💥', '🥳', '🤝',
];

/**
 * Preview stage: plays the reel's clips in order, shows added overlays,
 * and exposes the Audio / Stickers / Text / Captions edit tools.
 */
export default function PreviewStage({
  onBack,
  onNext,
  onOpenMusic,
  onOpenTextEditor,
  onAddClip,
}: {
  onBack: () => void;
  onNext: () => void;
  onOpenMusic: () => void;
  onOpenTextEditor: () => void;
  onAddClip: () => void;
}) {
  const clips = useReelCreatorStore(s => s.clips);
  const selectedMusic = useReelCreatorStore(s => s.selectedMusic);
  const setMusic = useReelCreatorStore(s => s.setMusic);
  const textOverlays = useReelCreatorStore(s => s.textOverlays);
  const stickerOverlays = useReelCreatorStore(s => s.stickerOverlays);
  const addSticker = useReelCreatorStore(s => s.addSticker);
  const removeSticker = useReelCreatorStore(s => s.removeSticker);
  const captions = useReelCreatorStore(s => s.captions);
  const setCaptions = useReelCreatorStore(s => s.setCaptions);
  const { isDark } = useCreateMomentsTheme();

  const videoRef = useRef<HTMLVideoElement>(null);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const [clipIndex, setClipIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [stickerSheet, setStickerSheet] = useState(false);
  const [audioSheet, setAudioSheet] = useState(false);
  const [captionsSheet, setCaptionsSheet] = useState(false);
  const [captionBusy, setCaptionBusy] = useState(false);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [manualCaptions, setManualCaptions] = useState(captions.text);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);

  const activeClip = clips[clipIndex] ?? clips[0] ?? null;
  const total = clips.length;

  useEffect(() => subscribePlayback(setPlayingTrackId), []);

  // Playlist: advance to next clip when the current one ends
  const handleEnded = useCallback(() => {
    setClipIndex((i) => {
      if (i + 1 < total) return i + 1;
      // Loop back to the start and restart music if looped
      if (musicAudioRef.current) musicAudioRef.current.currentTime = 0;
      return 0;
    });
  }, [total]);

  // Video playback control
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (playing) {
      el.play().catch(() => {
        el.muted = true;
        el.play().catch(() => setPlaying(false));
      });
    } else {
      el.pause();
    }
  }, [playing, clipIndex, clips]);

  // Image slideshow auto-advance timer for multiple images
  useEffect(() => {
    if (!activeClip || activeClip.kind !== 'image' || !playing) return;
    if (total <= 1) return;

    const duration = Math.max(1, (activeClip.trimEnd ?? activeClip.durationSec) - (activeClip.trimStart || 0));
    const timer = setTimeout(() => {
      handleEnded();
    }, duration * 1000);

    return () => clearTimeout(timer);
  }, [activeClip, playing, total, handleEnded]);

  // Continuous background music playback during preview
  useEffect(() => {
    if (!selectedMusic?.audioUrl) {
      if (musicAudioRef.current) {
        musicAudioRef.current.pause();
        musicAudioRef.current = null;
      }
      return;
    }

    if (!musicAudioRef.current || musicAudioRef.current.src !== selectedMusic.audioUrl) {
      if (musicAudioRef.current) musicAudioRef.current.pause();
      const a = new Audio(selectedMusic.audioUrl);
      a.loop = true;
      a.volume = 0.85;
      musicAudioRef.current = a;
    }

    const a = musicAudioRef.current;
    if (playing) {
      void a.play().catch(() => {});
    } else {
      a.pause();
    }

    return () => {
      a.pause();
    };
  }, [selectedMusic?.audioUrl, playing]);

  // Stop music previews when leaving
  useEffect(() => () => {
    stopPreview();
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
      musicAudioRef.current = null;
    }
  }, []);

  const currentCue = useMemo(() => {
    if (!captions.enabled || !captions.cues.length) return null;
    // Rough: show full text when cues exist (position-agnostic preview)
    return captions.cues;
  }, [captions]);

  const generateCaptions = async () => {
    setCaptionError(null);
    const source = clips.find(c => c.file && c.kind === 'video') || clips.find(c => c.file);
    if (!source?.file) {
      setCaptionError('This clip is unavailable for transcription. Try re-adding the video.');
      return;
    }
    setCaptionBusy(true);
    setCaptions({ ...captions, status: 'generating', error: undefined });
    try {
      const result = await transcribeMedia(source.file, source.name || 'reel.mp4');
      if (!result.ok) {
        const code = result.code || 'CAPTIONS_FAILED';
        setCaptionError(
          code === 'CAPTIONS_NOT_CONFIGURED' || code === 'CAPTIONS_AUTH'
            ? 'Auto captions are not configured on this server yet. You can type them manually.'
            : code === 'CAPTIONS_RATE_LIMIT'
              ? 'Too many transcription requests — wait a moment, then retry.'
              : (result.errorMessage || 'Transcription failed. Retry, or type captions manually.'),
        );
        setCaptions({ ...captions, status: 'error', error: code });
        return;
      }
      if (!result.text.trim() && !result.cues.length) {
        setCaptionError('No speech was detected in this clip. You can type captions manually.');
        setCaptions({ ...captions, status: 'error', error: 'EMPTY_TRANSCRIPT' });
        return;
      }
      const next = makeCaptionsState({
        enabled: true,
        text: result.text,
        cues: result.cues,
        source: 'auto',
        status: 'ready',
      });
      setCaptions(next);
      setManualCaptions(next.text);
      showSuccess('Captions generated — review them below.');
    } catch (err) {
      const msg = (err as Error).message || 'Caption generation failed.';
      logger.warn('[Captions] STT failed:', err);
      setCaptionError('Transcription failed. Check your connection, or type captions manually.');
      setCaptions({ ...captions, status: 'error', error: msg });
    } finally {
      setCaptionBusy(false);
    }
  };

  const saveManualCaptions = () => {
    const text = manualCaptions.trim();
    if (!text) {
      setCaptions({ enabled: false, cues: [], text: '', source: null, status: 'idle' });
      showSuccess('Captions removed');
      return;
    }
    const dur = clips.reduce((s, c) => s + Math.max(0, (c.trimEnd ?? c.durationSec) - c.trimStart), 0) || 10;
    const cues = captions.cues.length && captions.source === 'auto'
      ? captions.cues
      : [{ start: 0, end: dur, text }];
    setCaptions({ enabled: true, text, cues, source: captions.source ?? 'manual', status: 'ready' });
    showSuccess('Captions saved');
    setCaptionsSheet(false);
  };

  if (!activeClip) {
    return (
      <StageShell title="Preview" leftIcon="back" onLeft={onBack}>
        <div className="h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
          <p className={`text-sm font-bold ${isDark ? "text-white/70" : "text-gray-800"}`}>Add a photo or video to preview your reel.</p>
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 rounded-2xl font-bold text-white"
            style={{ background: '#ff1493' }}
          >
            Back to creation
          </button>
        </div>
      </StageShell>
    );
  }

  return (
    <StageShell
      title="Preview"
      leftIcon="back"
      onLeft={onBack}
      right={
        <button
          type="button"
          onClick={onNext}
          className="px-4 h-9 rounded-full text-[13px] font-extrabold text-white"
          style={{ background: PINK }}
        >
          Next
        </button>
      }
    >
      {/* Media preview */}
      <div className="relative w-full flex items-center justify-center bg-black" style={{ minHeight: '46dvh' }}>
        {activeClip.kind === 'image' ? (
          <div className="relative w-full max-h-[60dvh] flex items-center justify-center overflow-hidden">
            {/* Ambient blurred backdrop for landscape or non-portrait images */}
            <img
              src={activeClip.previewUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-35 scale-110 pointer-events-none select-none"
              aria-hidden
            />
            {/* Sharp contained foreground image */}
            <img
              key={activeClip.id}
              src={activeClip.previewUrl}
              alt={`Clip ${clipIndex + 1} of ${total} preview`}
              className="relative max-h-[60dvh] w-full object-contain pointer-events-none select-none z-10"
            />
          </div>
        ) : (
          <video
            key={activeClip.id}
            ref={videoRef}
            src={activeClip.previewUrl}
            playsInline
            autoPlay
            muted={!!selectedMusic}
            loop={total === 1}
            onEnded={handleEnded}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className="max-h-[60dvh] w-full object-contain"
            aria-label={`Clip ${clipIndex + 1} of ${total} preview`}
          />
        )}

        {/* Overlay previews (positioned normalized) */}
        {textOverlays.map(o => (
          <div
            key={o.id}
            className="absolute pointer-events-none select-none"
            style={{
              left: `${o.x * 100}%`,
              top: `${o.y * 100}%`,
              transform: 'translate(-50%, -50%)',
              color: o.color,
              fontFamily: `'${o.font}', sans-serif`,
              fontSize: `${Math.max(14, o.fontSize)}px`,
              fontWeight: 800,
              textAlign: o.align,
              textShadow: '0 2px 8px rgba(0,0,0,0.6)',
              maxWidth: '84%',
            }}
          >
            {o.text}
          </div>
        ))}
        {stickerOverlays.map(s => (
          <div
            key={s.id}
            className="absolute pointer-events-none select-none"
            style={{
              left: `${s.x * 100}%`,
              top: `${s.y * 100}%`,
              transform: `translate(-50%, -50%) rotate(${s.rotation}deg) scale(${s.scale})`,
              fontSize: '44px',
              lineHeight: 1,
            }}
          >
            {s.content}
          </div>
        ))}

        {/* Captions preview strip */}
        {captions.enabled && currentCue && (
          <div
            className="absolute left-0 right-0 bottom-4 px-6 text-center pointer-events-none"
            aria-live="polite"
          >
            <span
              className="inline-block px-3 py-1.5 rounded-lg text-[15px] font-extrabold"
              style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}
            >
              {captions.text || captions.cues[0]?.text}
            </span>
          </div>
        )}

        {/* Play/pause + clip indicator */}
        <button
          type="button"
          onClick={() => setPlaying(p => !p)}
          aria-label={playing ? 'Pause preview' : 'Play preview'}
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: playing ? 'transparent' : 'rgba(0,0,0,0.35)' }}
        >
          {!playing && (
            <span className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
              <Play size={26} color="#fff" />
            </span>
          )}
        </button>

        {total > 1 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1.5" aria-hidden>
            {clips.map((c, i) => (
              <span
                key={c.id}
                className="h-1 rounded-full transition-all"
                style={{
                  width: i === clipIndex ? 22 : 8,
                  background: i === clipIndex ? PINK : 'rgba(255,255,255,0.45)',
                }}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => { stopPreview(); }}
          aria-label="Stop music preview"
          className="hidden"
        />
      </div>

      {/* Clip strip + trim entry */}
      {total > 0 && (
        <div className="px-4 pt-3 flex items-center gap-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <div className="flex gap-2 flex-1 min-w-0">
            {clips.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setClipIndex(i)}
                className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0"
                style={{ border: i === clipIndex ? `2px solid ${PINK}` : '2px solid transparent' }}
                aria-label={`Clip ${i + 1}${i === clipIndex ? ', selected' : ''}`}
                aria-current={i === clipIndex}
              >
                <img src={c.previewUrl} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
            <button
              type="button"
              onClick={onAddClip}
              className="w-14 h-14 rounded-lg shrink-0 flex items-center justify-center"
              style={{
                border: `2px dashed ${isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)'}`,
                color: isDark ? 'rgba(255,255,255,0.85)' : '#111827',
                background: isDark ? 'transparent' : '#F9FAFB',
              }}
              aria-label="Add another clip"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>
      )}

      {/* Edit tools */}
      <nav className="px-4 pt-5 pb-8 grid grid-cols-4 gap-2" aria-label="Edit tools">
        <ToolButton
          icon={<Music size={19} />}
          label={selectedMusic ? 'Audio' : 'Add audio'}
          accent={!!selectedMusic}
          isDark={isDark}
          onClick={() => setAudioSheet(true)}
        />
        <ToolButton
          icon={<Smile size={19} />}
          label="Stickers"
          accent={stickerOverlays.length > 0}
          isDark={isDark}
          onClick={() => setStickerSheet(true)}
        />
        <ToolButton
          icon={<Type size={19} />}
          label="Text"
          accent={textOverlays.length > 0}
          isDark={isDark}
          onClick={onOpenTextEditor}
        />
        <ToolButton
          icon={<Captions size={19} />}
          label="Captions"
          accent={captions.enabled}
          isDark={isDark}
          onClick={() => { setManualCaptions(captions.text); setCaptionsSheet(true); }}
        />
      </nav>

      <div className="px-4 pb-8 -mt-2">
        <button
          type="button"
          onClick={onNext}
          className="w-full py-3.5 rounded-2xl font-extrabold text-white text-[15px] flex items-center justify-center gap-2"
          style={{ background: '#ff1493' }}
        >
          <Scissors size={16} /> Trim & arrange clips
        </button>
      </div>

      {/* ── Audio sheet ── */}
      <BottomSheet open={audioSheet} onClose={() => setAudioSheet(false)} title="Audio">
        {selectedMusic ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-2xl px-3 py-3" style={{ background: isDark ? 'rgba(255,255,255,0.06)' : '#F3F4F6' }}>
              {selectedMusic.thumbnailUrl ? (
                <img src={selectedMusic.thumbnailUrl} alt="" className="w-10 h-10 rounded-lg object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <Music size={16} color="#FFB3C6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-bold truncate ${isDark ? "text-white" : "text-gray-900"}`}>{selectedMusic.title}</p>
                <p className={`text-xs truncate ${isDark ? "text-white/55" : "text-gray-500"}`}>{selectedMusic.artist}</p>
              </div>
              <button
                type="button"
                onClick={() => togglePreview({ ...selectedMusic, duration: selectedMusic.durationSec ?? 30 })}
                aria-label="Preview music"
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: playingTrackId === selectedMusic.id ? PINK : 'rgba(255,255,255,0.12)', color: '#fff' }}
              >
                {playingTrackId === selectedMusic.id ? <Pause size={15} /> : <Play size={15} />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => { setAudioSheet(false); onOpenMusic(); }}
              className="w-full py-3 rounded-2xl font-bold text-white"
              style={{ background: '#ff1493' }}
            >
              Change audio
            </button>
            <button
              type="button"
              onClick={() => { setMusic(null); stopPreview(); setAudioSheet(false); }}
              className="w-full py-3 rounded-2xl font-bold"
              style={{
                background: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
                color: isDark ? 'rgba(255,255,255,0.75)' : '#374151',
                border: `1px solid ${isDark ? 'transparent' : '#E5E7EB'}`,
              }}
            >
              Remove music
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className={`text-sm ${isDark ? "text-white/60" : "text-gray-600"}`}>Add a soundtrack to your reel.</p>
            <button
              type="button"
              onClick={() => { setAudioSheet(false); onOpenMusic(); }}
              className="w-full py-3 rounded-2xl font-bold text-white"
              style={{ background: '#ff1493' }}
            >
              Choose music
            </button>
          </div>
        )}
      </BottomSheet>

      {/* ── Sticker sheet ── */}
      <BottomSheet open={stickerSheet} onClose={() => setStickerSheet(false)} title="Stickers">
        <div className="grid grid-cols-6 gap-2 pb-2">
          {EMOJI_SET.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                addSticker({
                  id: `stk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                  content: e,
                  type: 'emoji',
                  x: 0.5,
                  y: 0.4 + Math.random() * 0.2,
                  scale: 1,
                  rotation: 0,
                });
                setStickerSheet(false);
                showSuccess('Sticker added — drag it in the preview to reposition.');
              }}
              className="aspect-square rounded-xl flex items-center justify-center text-2xl"
              style={{ background: isDark ? 'rgba(255,255,255,0.07)' : '#F3F4F6' }}
              aria-label={`Add ${e} sticker`}
            >
              {e}
            </button>
          ))}
        </div>
        {stickerOverlays.length > 0 && (
          <div className="pt-3 mt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <p className={`text-xs mb-2 ${isDark ? "text-white/55" : "text-gray-500"}`}>Added stickers</p>
            <div className="flex gap-2 flex-wrap">
              {stickerOverlays.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { removeSticker(s.id); showSuccess('Sticker removed'); }}
                  className="px-3 py-2 rounded-xl text-lg"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                  aria-label={`Remove ${s.content} sticker`}
                  title="Tap to remove"
                >
                  {s.content} <span className="text-[11px] text-white/50">remove</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </BottomSheet>

      {/* ── Captions sheet ── */}
      <BottomSheet open={captionsSheet} onClose={() => setCaptionsSheet(false)} title="Captions">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className={`text-sm ${isDark ? "text-white/70" : "text-gray-700"}`}>Auto-generate from speech</span>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={captions.enabled}
                onChange={(e) => {
                  if (e.target.checked && !captions.cues.length && !captions.text) void generateCaptions();
                  else setCaptions({ ...captions, enabled: e.target.checked });
                }}
                className="w-5 h-5 accent-pink-500"
                aria-label="Enable captions"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={generateCaptions}
            disabled={captionBusy}
            className="w-full py-3 rounded-2xl font-bold text-white flex items-center justify-center gap-2"
            style={{ background: '#ff1493', opacity: captionBusy ? 0.7 : 1 }}
          >
            {captionBusy ? <><Loader2 size={16} className="animate-spin" /> Generating captions…</> : <><Wand2 size={16} /> {captions.source === 'auto' ? 'Regenerate' : 'Generate'}</>}
          </button>

          {captionError && (
            <div className="rounded-xl px-3 py-2 text-[13px] flex items-start gap-2" style={{ background: 'rgba(255,80,80,0.12)', color: '#FFC9C9' }}>
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{captionError}</span>
            </div>
          )}

          <label className={`text-sm ${isDark ? "text-white/70" : "text-gray-700"}`} htmlFor="caption-text">Edit caption text</label>
          <textarea
            id="caption-text"
            value={manualCaptions}
            onChange={(e) => setManualCaptions(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Type what should appear as captions…"
            className={`w-full rounded-2xl px-3.5 py-3 bg-transparent text-sm outline-none resize-none ${isDark ? "text-white" : "text-gray-900"}`}
            style={{ border: `1px solid ${isDark ? "rgba(255,255,255,0.14)" : "#E5E7EB"}` }}
          />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setCaptionsSheet(false)}
              className="flex-1 py-3 rounded-2xl font-bold"
              style={{
                background: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
                color: isDark ? 'rgba(255,255,255,0.75)' : '#374151',
                border: `1px solid ${isDark ? 'transparent' : '#E5E7EB'}`,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveManualCaptions}
              className="flex-1 py-3 rounded-2xl font-bold text-white flex items-center justify-center gap-2"
              style={{ background: PINK }}
            >
              <Check size={16} /> Save
            </button>
          </div>

          {captionBusy && <InlineSpinner size={16} />}
        </div>
      </BottomSheet>
    </StageShell>
  );
}

function ToolButton({
  icon, label, onClick, accent, isDark = true,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  accent?: boolean;
  isDark?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all active:scale-95"
      style={{
        background: accent
          ? (isDark ? 'rgba(255,0,110,0.18)' : '#FDF2F8')
          : (isDark ? 'rgba(255,255,255,0.07)' : '#FFFFFF'),
        color: accent
          ? (isDark ? '#FFD9E7' : PINK)
          : (isDark ? 'rgba(255,255,255,0.85)' : '#111827'),
        border: `1.5px solid ${accent ? PINK : (isDark ? 'transparent' : '#D1D5DB')}`,
        boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)',
      }}
      aria-label={label}
    >
      <span style={{ color: accent ? PINK : (isDark ? '#fff' : '#111827') }}>{icon}</span>
      <span className="text-[12px] font-black">{label}</span>
    </button>
  );
}
