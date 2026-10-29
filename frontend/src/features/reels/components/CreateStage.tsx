import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Search, Music, ImageIcon, Camera as CameraIcon, ChevronDown, Check,
  Video, Plus, Play, Pause, AlertCircle, FolderOpen, ChevronRight,
} from 'lucide-react';
import { useReelCreatorStore } from '../reelCreatorStore';
import type { GalleryItem, MediaSourceItem, MusicTrack } from '../types';
import { fetchTrending, stopPreview, togglePreview, subscribePlayback } from '../services/musicService';
import {
  filesToGalleryItems, getMediaSources, openNativePicker, pickDirectory, listFolderMedia,
} from '../services/mediaLibraryService';
import { InlineSpinner, PINK } from './shell';
import { logger } from '../../../utils/logger';
import { showError, showSuccess } from '../../../utils/toast';

/**
 * Stage 1 — Create reel page:
 * "Use popular music" shelf (4 real chart tracks) + Gallery with real
 * source discovery and multi-selection (max 10).
 */
export default function CreateStage({
  onOpenMusic,
  onOpenCamera,
  onNext,
}: {
  onOpenMusic: () => void;
  onOpenCamera: () => void;
  onNext: () => void;
}) {
  const clips = useReelCreatorStore(s => s.clips);
  const selectedMusic = useReelCreatorStore(s => s.selectedMusic);
  const setMusic = useReelCreatorStore(s => s.setMusic);
  const addClips = useReelCreatorStore(s => s.addClips);
  const maxMedia = useReelCreatorStore(s => s.maxMedia);

  const [trending, setTrending] = useState<MusicTrack[]>([]);
  const [musicState, setMusicState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [playingId, setPlayingId] = useState<string | null>(null);

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [sources, setSources] = useState<MediaSourceItem[]>([]);
  const [activeSource, setActiveSource] = useState<string>('camera-roll');
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);

  const [selectMultiple, setSelectMultiple] = useState(false);
  const [selectionOrder, setSelectionOrder] = useState<string[]>([]);
  const objectUrlsRef = useRef<string[]>([]);

  // ── Trending music (real chart data via backend) ──
  useEffect(() => {
    let alive = true;
    setMusicState('loading');
    fetchTrending(4)
      .then((tracks) => {
        if (!alive) return;
        setTrending(tracks);
        setMusicState(tracks.length ? 'ready' : 'empty');
      })
      .catch(() => {
        if (!alive) return;
        setMusicState('error');
      });
    return () => {
      alive = false;
      stopPreview();
    };
  }, []);

  useEffect(() => subscribePlayback(setPlayingId), []);

  // ── Sources ──
  useEffect(() => {
    let alive = true;
    getMediaSources()
      .then((s) => { if (alive) setSources(s); })
      .catch(() => { if (alive) setSources([{ id: 'camera-roll', name: 'Camera roll', kind: 'camera-roll' }]); });
    return () => { alive = false; };
  }, []);

  const loadSource = useCallback(async (sourceId: string) => {
    setActiveSource(sourceId);
    setGalleryOpen(true);
    setGalleryError(null);
    setGalleryLoading(true);
    // Free previous thumbnails
    objectUrlsRef.current.forEach((u) => { try { URL.revokeObjectURL(u); } catch (_) { /* */ } });
    objectUrlsRef.current = [];
    try {
      let files: File[] = [];
      if (sourceId.startsWith('folder:')) {
        const folderName = sourceId.slice('folder:'.length);
        const folderItems = await listFolderMedia(folderName);
        setItems(folderItems);
        objectUrlsRef.current = folderItems
          .filter(i => i.thumbnailUrl.startsWith('blob:'))
          .map(i => i.thumbnailUrl);
        return;
      }
      // camera-roll / browse → native picker (SAF on Android shows every album)
      files = await openNativePicker({ multiple: true, accept: 'image/*,video/*' });
      const picked = await filesToGalleryItems(files);
      setItems(picked);
      objectUrlsRef.current = picked
        .filter(i => i.thumbnailUrl.startsWith('blob:'))
        .map(i => i.thumbnailUrl);
      if (!picked.length && !files.length) {
        setGalleryError(null); // user cancelled — silent
      } else if (files.length && !picked.length) {
        setGalleryError('Those files are not supported photos or videos. Try MP4, MOV, JPG or PNG.');
      }
    } catch (err) {
      const code = (err as Error).message;
      if (code === 'FOLDER_PERMISSION' || code === 'FOLDER_REVOKE') {
        setGalleryError('This folder access has expired. Re-select the folder to continue browsing.');
      } else {
        logger.warn('[CreateReel] gallery load failed:', err);
        setGalleryError('Could not open that source. Use the file browser instead — your device picker shows all albums.');
      }
    } finally {
      setGalleryLoading(false);
    }
  }, []);

  useEffect(() => () => {
    objectUrlsRef.current.forEach((u) => { try { URL.revokeObjectURL(u); } catch (_) { /* */ } });
    stopPreview();
  }, []);

  const selectionFull = selectionOrder.length >= maxMedia;

  const toggleSelect = (id: string) => {
    if (!selectMultiple) return;
    setSelectionOrder((prev) =>
      prev.includes(id) ? prev.filter(x => x !== id) : selectionFull ? prev : [...prev, id],
    );
  };

  const addSelected = () => {
    const ordered = selectionOrder
      .map(id => items.find(i => i.id === id))
      .filter(Boolean) as GalleryItem[];
    const toAdd = (ordered.length ? ordered : items.slice(0, 1));
    if (!toAdd.length) return;
    if (clips.length + toAdd.length > 10) {
      showError(`You can add up to 10 clips per reel (${clips.length} already added).`);
      return;
    }
    addClips(toAdd.map(g => ({
      id: g.id,
      kind: g.kind,
      previewUrl: g.thumbnailUrl.startsWith('data:') || g.thumbnailUrl.startsWith('blob:')
        ? (g.kind === 'video' ? createVideoObjectUrl(g) : g.thumbnailUrl)
        : g.thumbnailUrl,
      file: g.file,
      storageKey: null,
      durationSec: g.durationSec ?? (g.kind === 'image' ? 3 : 0),
      trimStart: 0,
      trimEnd: null,
      width: g.width,
      height: g.height,
      name: g.name,
    })));
    showSuccess(`${toAdd.length} item${toAdd.length > 1 ? 's' : ''} added`);
    setSelectionOrder([]);
    setSelectMultiple(false);
    setItems([]);
    setGalleryOpen(false);
    setActiveSource('camera-roll');
    onNext();
  };

  const browseFolders = async () => {
    const dir = await pickDirectory();
    if (!dir) return;
    const current = await getMediaSources();
    setSources(current);
    await loadSource(`folder:${dir.name}`);
  };

  return (
    <div className="pb-10">
      {/* ── Use popular music ── */}
      <section className="px-4 pt-4" aria-labelledby="popular-music-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="popular-music-heading" className="text-white font-extrabold text-[15px]" style={{ fontFamily: "'Varela Round', sans-serif" }}>
            Use popular music
          </h2>
          <button
            type="button"
            onClick={onOpenMusic}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}
            aria-label="Search music"
          >
            <Search size={17} />
          </button>
        </div>

        {musicState === 'loading' && (
          <div className="flex items-center gap-3 py-6 text-white/60 text-sm">
            <InlineSpinner /> Loading trending music…
          </div>
        )}
        {musicState === 'error' && (
          <div className="flex items-start gap-2 py-4 text-sm" style={{ color: '#FFB3C6' }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              Couldn't load trending music.
              <button type="button" onClick={onOpenMusic} className="underline ml-1" style={{ color: PINK }}>
                Try search
              </button>
            </div>
          </div>
        )}
        {musicState === 'empty' && (
          <p className="py-4 text-white/50 text-sm">No trending music available right now.</p>
        )}

        {musicState === 'ready' && (
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
            {trending.map((track) => {
              const isSelected = selectedMusic?.id === track.id;
              return (
                <div
                  key={track.id}
                  className="shrink-0 w-[160px] rounded-2xl p-3 flex flex-col gap-2"
                  style={{
                    background: isSelected ? 'rgba(255,0,110,0.16)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${isSelected ? PINK : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-10 h-10 rounded-full overflow-hidden shrink-0 flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.1)' }}
                    >
                      {track.thumbnailUrl ? (
                        <img src={track.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Music size={16} color="#FFB3C6" />
                      )}
                    </div>
                    <button
                      type="button"
                      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
                      onClick={() => togglePreview(track)}
                      aria-label={playingId === track.id ? `Pause ${track.title}` : `Play ${track.title} preview`}
                    >
                      {playingId === track.id ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                  </div>
                  <div className="min-w-0">
                    <p className="text-white text-[13px] font-bold truncate">{track.title}</p>
                    <p className="text-white/55 text-[11px] truncate">{track.artist}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMusic(isSelected ? null : { ...track, durationSec: track.duration });
                      stopPreview();
                    }}
                    className="py-1.5 rounded-full text-[12px] font-bold"
                    style={{
                      background: isSelected ? PINK : 'rgba(255,255,255,0.1)',
                      color: '#fff',
                    }}
                  >
                    {isSelected ? 'Selected ✓' : 'Use'}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {selectedMusic && (
          <div
            className="mt-3 flex items-center gap-3 rounded-2xl px-3 py-2.5"
            style={{ background: 'rgba(255,0,110,0.14)', border: `1px solid ${PINK}44` }}
          >
            {selectedMusic.thumbnailUrl ? (
              <img src={selectedMusic.thumbnailUrl} alt="" className="w-9 h-9 rounded-lg object-cover" />
            ) : (
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <Music size={15} color="#FFB3C6" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-[13px] font-bold truncate">{selectedMusic.title}</p>
              <p className="text-white/55 text-[11px] truncate">{selectedMusic.artist}</p>
            </div>
            <button
              type="button"
              onClick={onOpenMusic}
              className="text-[12px] font-bold px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => { setMusic(null); stopPreview(); }}
              className="text-[12px] font-bold px-3 py-1.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}
              aria-label="Remove music"
            >
              Remove
            </button>
          </div>
        )}
      </section>

      {/* ── Gallery ── */}
      <section className="px-4 pt-6" aria-labelledby="gallery-heading">
        <button
          type="button"
          onClick={() => setGalleryOpen(o => !o)}
          className="w-full flex items-center justify-between py-3"
          aria-expanded={galleryOpen}
          id="gallery-heading"
        >
          <span className="flex items-center gap-2 text-white font-extrabold text-[15px]" style={{ fontFamily: "'Varela Round', sans-serif" }}>
            <ImageIcon size={16} color={PINK} /> Gallery
          </span>
          <ChevronDown
            size={18}
            color="rgba(255,255,255,0.6)"
            style={{ transform: galleryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          />
        </button>

        {galleryOpen && (
          <div className="mt-1">
            {/* Source selector */}
            <div className="flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
              {sources.map((src) => (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => (src.kind === 'browse' ? browseFolders() : loadSource(src.id))}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-bold"
                  style={{
                    background: activeSource === src.id ? 'rgba(255,0,110,0.2)' : 'rgba(255,255,255,0.07)',
                    color: '#fff',
                    border: `1px solid ${activeSource === src.id ? PINK : 'transparent'}`,
                  }}
                >
                  {src.kind === 'camera-roll' ? <ImageIcon size={13} />
                    : src.kind === 'browse' ? <FolderOpen size={13} />
                    : <Video size={13} />}
                  {src.name}
                </button>
              ))}
            </div>

            {/* Gallery header row */}
            <div className="flex items-center justify-between py-2">
              <span className="text-white/50 text-xs">
                {items.length ? `${items.length} item${items.length > 1 ? 's' : ''} · newest first` : 'Select media from your device'}
              </span>
              <button
                type="button"
                onClick={() => { setSelectMultiple(v => !v); setSelectionOrder([]); }}
                className="text-[12px] font-bold px-3 py-1.5 rounded-full"
                style={{
                  background: selectMultiple ? PINK : 'rgba(255,255,255,0.08)',
                  color: '#fff',
                }}
                aria-pressed={selectMultiple}
              >
                Select multiple
              </button>
            </div>

            {selectMultiple && (
              <div className="flex items-center justify-between rounded-xl px-3 py-2 mb-2 text-[12px] font-bold"
                style={{ background: 'rgba(255,0,110,0.14)', color: '#FFD9E7' }}>
                <span>{selectionOrder.length} of {maxMedia} selected</span>
                {selectionFull && <span style={{ color: '#FFB3C6' }}>Limit reached — deselect to replace</span>}
              </div>
            )}

            {galleryLoading && (
              <div className="flex items-center gap-3 py-8 justify-center text-white/60 text-sm">
                <InlineSpinner /> Loading media…
              </div>
            )}

            {galleryError && (
              <div className="rounded-xl px-3 py-3 mb-2 text-[13px]" style={{ background: 'rgba(255,80,80,0.12)', color: '#FFC9C9' }}>
                {galleryError}
                <button
                  type="button"
                  className="block mt-2 underline font-bold"
                  onClick={() => loadSource('camera-roll')}
                  style={{ color: '#FFD9E7' }}
                >
                  Open the file picker instead
                </button>
              </div>
            )}

            {!galleryLoading && !galleryError && activeSource !== 'camera-roll' && items.length === 0 && (
              <p className="py-6 text-center text-white/45 text-sm">This folder has no photos or videos.</p>
            )}

            {/* Grid */}
            {!galleryLoading && (items.length > 0 || activeSource === 'camera-roll') && (
              <div className="grid grid-cols-3 gap-1.5">
                {/* Camera tile first in the grid */}
                <button
                  type="button"
                  onClick={onOpenCamera}
                  className="aspect-square rounded-xl flex flex-col items-center justify-center gap-1"
                  style={{ background: 'rgba(255,255,255,0.07)', color: '#fff', border: '1px dashed rgba(255,255,255,0.2)' }}
                  aria-label="Open camera"
                >
                  <CameraIcon size={22} color={PINK} />
                  <span className="text-[11px] font-bold">Camera</span>
                </button>

                {items.map((item) => {
                  const orderIdx = selectionOrder.indexOf(item.id);
                  const selected = orderIdx >= 0;
                  const disabled = selectMultiple && !selected && selectionFull;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => (selectMultiple ? toggleSelect(item.id) : addItemDirect(item))}
                      disabled={disabled && selectMultiple}
                      className="relative aspect-square rounded-xl overflow-hidden"
                      style={{ opacity: disabled ? 0.4 : 1 }}
                      aria-label={`${item.kind} ${item.name}${selected ? ', selected' : ''}`}
                      aria-pressed={selected}
                    >
                      <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                      {item.kind === 'video' && (
                        <span
                          className="absolute bottom-1 right-1 text-[10px] font-bold px-1 py-0.5 rounded"
                          style={{ background: 'rgba(0,0,0,0.65)', color: '#fff' }}
                        >
                          {formatDuration(item.durationSec || 0)}
                        </span>
                      )}
                      {selectMultiple && (
                        <span
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold"
                          style={{
                            background: selected ? PINK : 'rgba(0,0,0,0.45)',
                            border: selected ? 'none' : '2px solid rgba(255,255,255,0.8)',
                            color: '#fff',
                          }}
                        >
                          {selected ? <Check size={13} /> : ''}
                          {selected && orderIdx >= 0 ? '' : ''}
                        </span>
                      )}
                      {selectMultiple && selected && (
                        <span
                          className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black"
                          style={{ background: PINK, color: '#fff' }}
                        >
                          {orderIdx + 1}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {activeSource === 'camera-roll' && items.length === 0 && !galleryLoading && (
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => loadSource('camera-roll')}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm"
                  style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}
                >
                  <ImageIcon size={14} className="inline mr-1.5" /> Choose photos & videos
                </button>
                <button
                  type="button"
                  onClick={onOpenCamera}
                  className="flex-1 py-3 rounded-2xl font-bold text-sm text-white"
                  style={{ background: 'linear-gradient(135deg, #FF6B8B, #FF3D6D)' }}
                >
                  <CameraIcon size={14} className="inline mr-1.5" /> Camera
                </button>
              </div>
            )}

            {selectMultiple && selectionOrder.length > 0 && (
              <button
                type="button"
                onClick={addSelected}
                className="fixed left-4 right-4 bottom-6 py-3.5 rounded-2xl font-extrabold text-white z-10"
                style={{ background: 'linear-gradient(135deg, #FF6B8B, #FF3D6D)', boxShadow: '0 8px 24px rgba(255,61,109,0.4)' }}
              >
                Add {selectionOrder.length} to reel <Plus size={16} className="inline -mt-0.5" />
              </button>
            )}
          </div>
        )}
      </section>

      {/* Forward path once media exists — the flow's only way to preview */}
      {clips.length > 0 && !(selectMultiple && selectionOrder.length > 0) && (
        <button
          type="button"
          onClick={onNext}
          className="fixed left-4 right-4 bottom-24 py-3.5 rounded-2xl font-extrabold text-white z-10"
          style={{ background: 'linear-gradient(135deg, #FF6B8B, #FF3D6D)', boxShadow: '0 8px 24px rgba(255,61,109,0.4)' }}
        >
          Next · {clips.length} clip{clips.length > 1 ? 's' : ''} <ChevronRight size={16} className="inline -mt-0.5" />
        </button>
      )}
    </div>
  );

  function addItemDirect(item: GalleryItem) {
    if (clips.length >= 10) {
      showError('You can add up to 10 clips per reel.');
      return;
    }
    addClips([{
      id: item.id,
      kind: item.kind,
      previewUrl: item.kind === 'video' ? createVideoObjectUrl(item) : item.thumbnailUrl,
      file: item.file,
      storageKey: null,
      durationSec: item.durationSec ?? (item.kind === 'image' ? 3 : 0),
      trimStart: 0,
      trimEnd: null,
      width: item.width,
      height: item.height,
      name: item.name,
    }]);
    showSuccess('Added to reel');
    onNext();
  }
}

function createVideoObjectUrl(item: GalleryItem): string {
  if (item.file) return URL.createObjectURL(item.file);
  return item.thumbnailUrl;
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
