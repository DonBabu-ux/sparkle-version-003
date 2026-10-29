import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Trash2, ChevronUp, ChevronDown, Check, Film,
} from 'lucide-react';
import { useReelCreatorStore } from '../reelCreatorStore';
import { StageShell, PINK, InlineSpinner } from './shell';
import { openNativePicker, filesToGalleryItems, probeVideo } from '../services/mediaLibraryService';
import type { GalleryItem } from '../types';
import { showError, showSuccess } from '../../../utils/toast';
import { logger } from '../../../utils/logger';

/**
 * Clip editor: per-clip trim timeline (min 0.5s), clip ordering via
 * accessible up/down controls + drag handle, delete, and "Add more" that
 * appends new media. Total reel duration stays ≤ 60s.
 */
export default function ClipEditorStage({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const clips = useReelCreatorStore(s => s.clips);
  const updateClip = useReelCreatorStore(s => s.updateClip);
  const removeClip = useReelCreatorStore(s => s.removeClip);
  const reorderClips = useReelCreatorStore(s => s.reorderClips);
  const addClips = useReelCreatorStore(s => s.addClips);
  const totalDurationSec = useReelCreatorStore(s => s.totalDurationSec);

  const [selectedId, setSelectedId] = useState<string | null>(clips[0]?.id ?? null);
  const [adding, setAdding] = useState(false);
  const dragIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!clips.find(c => c.id === selectedId)) setSelectedId(clips[0]?.id ?? null);
  }, [clips, selectedId]);

  const selected = useMemo(() => clips.find(c => c.id === selectedId) ?? clips[0] ?? null, [clips, selectedId]);
  const total = totalDurationSec();

  const sourceDuration = selected ? selected.durationSec : 0;
  const trimStart = selected?.trimStart ?? 0;
  const trimEnd = selected ? (selected.trimEnd ?? selected.durationSec) : 0;

  const onTrim = (patch: { trimStart?: number; trimEnd?: number | null }) => {
    if (!selected) return;
    const start = Math.max(0, Math.min(patch.trimStart ?? trimStart, trimEnd - 0.5));
    const end = Math.max(start + 0.5, Math.min(sourceDuration, patch.trimEnd ?? trimEnd));
    updateClip(selected.id, { trimStart: start, trimEnd: end >= sourceDuration - 0.05 ? null : end });
  };

  const move = (id: string, dir: -1 | 1) => {
    const idx = clips.findIndex(c => c.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= clips.length) return;
    const ids = clips.map(c => c.id);
    [ids[idx], ids[target]] = [ids[target], ids[idx]];
    reorderClips(ids);
  };

  const dropAt = (overId: string) => {
    const from = dragIdRef.current;
    dragIdRef.current = null;
    if (!from || from === overId) return;
    const ids = clips.map(c => c.id);
    const fromIdx = ids.indexOf(from);
    const overIdx = ids.indexOf(overId);
    if (fromIdx < 0 || overIdx < 0) return;
    ids.splice(fromIdx, 1);
    ids.splice(overIdx, 0, from);
    reorderClips(ids);
  };

  const addMore = async () => {
    if (clips.length >= 10) {
      showError('You can add up to 10 clips per reel.');
      return;
    }
    setAdding(true);
    try {
      const files = await openNativePicker({ multiple: true, accept: 'image/*,video/*' });
      const room = 10 - clips.length;
      const picked = (await filesToGalleryItems(files)).slice(0, room);
      if (!picked.length) return;
      const additions = await Promise.all(picked.map(async (g: GalleryItem) => {
        let durationSec = g.durationSec ?? (g.kind === 'image' ? 3 : 0);
        if (g.kind === 'video' && (!durationSec || durationSec <= 0) && g.file) {
          const meta = await probeVideo(URL.createObjectURL(g.file));
          durationSec = meta.durationSec;
        }
        return {
          id: g.id,
          kind: g.kind,
          previewUrl: g.file ? URL.createObjectURL(g.file) : g.thumbnailUrl,
          file: g.file,
          storageKey: null,
          durationSec,
          trimStart: 0,
          trimEnd: null as number | null,
          width: g.width,
          height: g.height,
          name: g.name,
        };
      }));
      // Enforce 60s total
      let budget = 60 - totalDurationSec();
      const within = additions.filter(a => {
        const d = Math.min(a.durationSec || 3, a.durationSec);
        if (d <= budget) { budget -= d; return true; }
        return false;
      });
      if (!within.length) {
        showError('That would exceed the 60 second reel limit.');
        return;
      }
      addClips(within);
      showSuccess(`${within.length} clip${within.length > 1 ? 's' : ''} added`);
    } catch (err) {
      logger.warn('[ClipEditor] add more failed:', err);
      showError('Could not add those files. Try MP4, MOV, JPG or PNG.');
    } finally {
      setAdding(false);
    }
  };

  if (!clips.length) {
    return (
      <StageShell title="Edit clips" leftIcon="back" onLeft={onBack}>
        <div className="h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
          <Film size={30} color={PINK} />
          <p className="text-white/70 text-sm">No clips yet. Add a photo or video first.</p>
          <button
            type="button"
            onClick={onBack}
            className="px-6 py-3 rounded-2xl font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #FF6B8B, #FF3D6D)' }}
          >
            Back to creation
          </button>
        </div>
      </StageShell>
    );
  }

  return (
    <StageShell
      title="Edit clips"
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
      {/* Selected clip preview */}
      <div className="relative w-full bg-black flex items-center justify-center" style={{ minHeight: '34dvh' }}>
        {selected?.kind === 'video' ? (
          <video
            key={selected.id}
            src={selected.previewUrl}
            className="w-full max-h-[42dvh] object-contain"
            controls={false}
            muted
            playsInline
            autoPlay
            loop
            aria-label={`Clip preview, trimmed to ${Math.max(0, trimEnd - trimStart).toFixed(1)}s`}
          />
        ) : selected ? (
          <img src={selected.previewUrl} alt="" className="w-full max-h-[42dvh] object-contain" />
        ) : null}

        <span
          className="absolute top-2 right-2 text-[11px] font-bold px-2 py-1 rounded-full"
          style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
        >
          {Math.max(0, trimEnd - trimStart).toFixed(1)}s / {total.toFixed(1)}s total
        </span>
      </div>

      {/* Trim timeline */}
      {selected && (
        <section className="px-4 pt-4" aria-label="Trim clip">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-white font-extrabold text-[14px]" style={{ fontFamily: "'Varela Round', sans-serif" }}>
              Trim — {selected.name || `Clip ${clips.findIndex(c => c.id === selected.id) + 1}`}
            </h2>
            <span className="text-white/50 text-xs">min 0.5s</span>
          </div>

          {/* Timeline bar */}
          <div className="relative h-14 rounded-xl overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.06)' }}>
            {/* Filmstrip thumbnails */}
            <div className="absolute inset-0 flex">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex-1 border-r" style={{ borderColor: 'rgba(0,0,0,0.3)', background: 'rgba(255,255,255,0.04)' }}>
                  <img
                    src={selected.previewUrl}
                    alt=""
                    className="w-full h-full object-cover"
                    style={{
                      objectPosition: `${(i + 0.5) * 12.5}% center`,
                      opacity: 0.55,
                    }}
                  />
                </div>
              ))}
            </div>
            {/* Selected window */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none"
              style={{
                left: `${sourceDuration ? (trimStart / sourceDuration) * 100 : 0}%`,
                width: `${sourceDuration ? ((trimEnd - trimStart) / sourceDuration) * 100 : 100}%`,
                border: `2px solid ${PINK}`,
                background: 'rgba(255,0,110,0.14)',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
              }}
              aria-hidden
            />
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="text-white/60 text-xs">Start — {trimStart.toFixed(1)}s</span>
              <input
                type="range"
                min={0}
                max={Math.max(0, sourceDuration - 0.5)}
                step={0.1}
                value={trimStart}
                onChange={(e) => onTrim({ trimStart: Number(e.target.value) })}
                className="w-full accent-pink-500"
                aria-label="Trim start seconds"
              />
            </label>
            <label className="block">
              <span className="text-white/60 text-xs">End — {trimEnd.toFixed(1)}s</span>
              <input
                type="range"
                min={Math.min(0.5, sourceDuration)}
                max={sourceDuration}
                step={0.1}
                value={trimEnd}
                onChange={(e) => onTrim({ trimEnd: Number(e.target.value) })}
                className="w-full accent-pink-500"
                aria-label="Trim end seconds"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onTrim({ trimStart: 0, trimEnd: null })}
                className="flex-1 py-2 rounded-xl text-[12px] font-bold"
                style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.8)' }}
              >
                Reset trim
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selected.previewUrl.startsWith('blob:')) {
                    try { URL.revokeObjectURL(selected.previewUrl); } catch (_) { /* already gone */ }
                  }
                  removeClip(selected.id);
                  showSuccess('Clip removed');
                }}
                className="flex-1 py-2 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5"
                style={{ background: 'rgba(255,60,60,0.16)', color: '#FF9C9C' }}
              >
                <Trash2 size={13} /> Delete clip
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Clip order list */}
      <section className="px-4 pt-5 pb-6" aria-label="Clip order">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-white font-extrabold text-[14px]" style={{ fontFamily: "'Varela Round', sans-serif" }}>
            Order ({clips.length}/10)
          </h2>
          <span className="text-white/50 text-xs">{total.toFixed(1)}s of 60s</span>
        </div>

        <ul className="flex flex-col gap-2">
          {clips.map((c, i) => (
            <li
              key={c.id}
              draggable
              onDragStart={() => { dragIdRef.current = c.id; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropAt(c.id)}
              className="flex items-center gap-3 rounded-2xl px-2.5 py-2"
              style={{
                background: c.id === selected?.id ? 'rgba(255,0,110,0.14)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${c.id === selected?.id ? `${PINK}55` : 'transparent'}`,
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedId(c.id)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
                aria-label={`Select clip ${i + 1}`}
              >
                <span className="w-6 text-white/45 text-xs font-bold text-center shrink-0">{i + 1}</span>
                <img src={c.previewUrl} alt="" className="w-11 h-11 rounded-lg object-cover shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-white text-[13px] font-bold truncate">{c.name || `Clip ${i + 1}`}</span>
                  <span className="block text-white/50 text-[11px]">
                    {Math.max(0, (c.trimEnd ?? c.durationSec) - c.trimStart).toFixed(1)}s · {c.kind}
                  </span>
                </span>
              </button>
              <span className="flex flex-col" role="group" aria-label={`Reorder clip ${i + 1}`}>
                <button
                  type="button"
                  onClick={() => move(c.id, -1)}
                  disabled={i === 0}
                  aria-label={`Move clip ${i + 1} up`}
                  className="w-8 h-7 flex items-center justify-center"
                  style={{ color: i === 0 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.75)' }}
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => move(c.id, 1)}
                  disabled={i === clips.length - 1}
                  aria-label={`Move clip ${i + 1} down`}
                  className="w-8 h-7 flex items-center justify-center"
                  style={{ color: i === clips.length - 1 ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.75)' }}
                >
                  <ChevronDown size={16} />
                </button>
              </span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={addMore}
          disabled={adding || clips.length >= 10}
          className="w-full mt-3 py-3 rounded-2xl font-bold text-white flex items-center justify-center gap-2"
          style={{
            background: 'rgba(255,255,255,0.08)',
            opacity: adding || clips.length >= 10 ? 0.5 : 1,
          }}
        >
          {adding ? <><InlineSpinner size={15} /> Opening picker…</> : <><Plus size={16} /> Add more</>}
        </button>

        <button
          type="button"
          onClick={onNext}
          className="w-full mt-4 py-3.5 rounded-2xl font-extrabold text-white flex items-center justify-center gap-2"
          style={{ background: 'linear-gradient(135deg, #FF6B8B, #FF3D6D)' }}
        >
          <Check size={17} /> Done editing
        </button>
      </section>
    </StageShell>
  );
}
