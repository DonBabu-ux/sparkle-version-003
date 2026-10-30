import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, Music, ImageIcon, ChevronDown, Check,
  Play, Pause, AlertCircle, MoreVertical, LayoutGrid, FolderOpen, ChevronRight, Plus
} from 'lucide-react';
import { useReelCreatorStore } from '../reelCreatorStore';
import type { GalleryItem, MediaSourceItem, MusicTrack } from '../types';
import { fetchTrending, stopPreview, togglePreview, subscribePlayback } from '../services/musicService';
import {
  loadDeviceMedia, filesToGalleryItems, openNativePicker, pickDirectory,
  listFolderMedia, getMediaSources, resolveItemFile, formatDuration
} from '../services/mediaLibraryService';
import { InlineSpinner, PINK } from './shell';
import { useCreateMomentsTheme } from '../useCreateMomentsTheme';
import { logger } from '../../../utils/logger';
import { showError, showSuccess } from '../../../utils/toast';

/**
 * Stage 1 — Create Reel page:
 * - Premium TikTok dark aesthetic (#0D080E) with subtle burgundy ambient light.
 * - Horizontal Popular Music carousel with album art, play/pause, options, and Use button.
 * - Auto-loaded 3-column native & device media gallery with portrait thumbnails,
 *   video duration pills, photo badges, and circular selection indicators.
 * - Client-side filter tabs: All | Videos | Photos + Grid density toggle.
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
  const { isDark } = useCreateMomentsTheme();
  const clips = useReelCreatorStore(s => s.clips);
  const selectedMusic = useReelCreatorStore(s => s.selectedMusic);
  const setMusic = useReelCreatorStore(s => s.setMusic);
  const addClips = useReelCreatorStore(s => s.addClips);
  const maxMedia = useReelCreatorStore(s => s.maxMedia);

  // ── Music state ──
  const [trending, setTrending] = useState<MusicTrack[]>([]);
  const [musicState, setMusicState] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [playingId, setPlayingId] = useState<string | null>(null);

  // ── Gallery state ──
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [galleryLoading, setGalleryLoading] = useState(true);
  const [galleryError, setGalleryError] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'videos' | 'photos'>('all');
  const [gridColumns, setGridColumns] = useState<3 | 4>(3);

  // ── Sources & Selection ──
  const [sources, setSources] = useState<MediaSourceItem[]>([]);
  const [activeSource, setActiveSource] = useState<string>('camera-roll');
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [selectionOrder, setSelectionOrder] = useState<string[]>([]);
  const [addingClips, setAddingClips] = useState(false);

  const objectUrlsRef = useRef<string[]>([]);

  // ── 1. Fetch Trending Music on Mount ──
  useEffect(() => {
    let alive = true;
    setMusicState('loading');
    fetchTrending(10)
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

  // ── 2. Automatic Media Loading on Mount ──
  const initGallery = useCallback(async () => {
    setGalleryLoading(true);
    setGalleryError(null);
    try {
      const media = await loadDeviceMedia();
      setItems(media);
    } catch (err) {
      logger.warn('[CreateStage] Gallery auto-load failed:', err);
      setGalleryError('Could not load device gallery automatically. Tap below to pick files.');
    } finally {
      setGalleryLoading(false);
    }
  }, []);

  useEffect(() => {
    void initGallery();
  }, [initGallery]);

  // ── 3. Load Available Media Sources ──
  useEffect(() => {
    let alive = true;
    getMediaSources()
      .then((s) => { if (alive) setSources(s); })
      .catch(() => { if (alive) setSources([{ id: 'camera-roll', name: 'Camera roll', kind: 'camera-roll' }]); });
    return () => { alive = false; };
  }, []);

  // ── Cleanup temporary object URLs on unmount ──
  useEffect(() => () => {
    objectUrlsRef.current.forEach((u) => { try { URL.revokeObjectURL(u); } catch (_) { /* noop */ } });
    stopPreview();
  }, []);

  // ── Source Selection Handlers ──
  const handleSelectSource = async (sourceId: string) => {
    setActiveSource(sourceId);
    setSourceMenuOpen(false);

    if (sourceId === 'browse-file') {
      await handlePickFiles();
      return;
    }

    if (sourceId === 'browse-folder') {
      const dir = await pickDirectory();
      if (!dir) return;
      const current = await getMediaSources();
      setSources(current);
      await loadFolderMedia(dir.name);
      return;
    }

    if (sourceId.startsWith('folder:')) {
      const folderName = sourceId.slice('folder:'.length);
      await loadFolderMedia(folderName);
      return;
    }

    if (sourceId === 'camera-roll') {
      setFilterTab('all');
      await initGallery();
    } else if (sourceId === 'videos') {
      setFilterTab('videos');
    } else if (sourceId === 'photos') {
      setFilterTab('photos');
    }
  };

  const loadFolderMedia = async (folderName: string) => {
    setGalleryLoading(true);
    setGalleryError(null);
    try {
      const folderItems = await listFolderMedia(folderName);
      setItems(folderItems);
      objectUrlsRef.current = folderItems
        .filter(i => i.thumbnailUrl.startsWith('blob:'))
        .map(i => i.thumbnailUrl);
    } catch (err) {
      logger.warn('[CreateStage] Folder load failed:', err);
      setGalleryError('Could not read folder. Re-select the folder or choose files directly.');
    } finally {
      setGalleryLoading(false);
    }
  };

  const handlePickFiles = async () => {
    try {
      const files = await openNativePicker({ multiple: true, accept: 'image/*,video/*' });
      if (!files.length) return;
      setGalleryLoading(true);
      const picked = await filesToGalleryItems(files);
      setItems(prev => [...picked, ...prev]);
      objectUrlsRef.current = [
        ...objectUrlsRef.current,
        ...picked.filter(i => i.thumbnailUrl.startsWith('blob:')).map(i => i.thumbnailUrl),
      ];
    } catch (err) {
      logger.warn('[CreateStage] Native picker failed:', err);
      showError('Could not open file picker.');
    } finally {
      setGalleryLoading(false);
    }
  };

  // ── Filter items based on active tab ──
  const filteredItems = useMemo(() => {
    if (filterTab === 'videos') return items.filter(i => i.kind === 'video');
    if (filterTab === 'photos') return items.filter(i => i.kind === 'image');
    return items;
  }, [items, filterTab]);

  // ── Selection Toggle ──
  const toggleSelect = (id: string) => {
    setSelectionOrder(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      if (prev.length >= maxMedia) {
        showError(`You can select up to ${maxMedia} items.`);
        return prev;
      }
      return [...prev, id];
    });
  };

  // ── Add Selected Items to Reel ──
  const addSelected = async () => {
    if (!selectionOrder.length) return;
    if (clips.length + selectionOrder.length > 10) {
      showError(`You can add up to 10 clips per reel (${clips.length} already added).`);
      return;
    }

    setAddingClips(true);
    try {
      const ordered = selectionOrder
        .map(id => items.find(i => i.id === id))
        .filter(Boolean) as GalleryItem[];

      const additions = await Promise.all(ordered.map(async g => {
        const file = await resolveItemFile(g);
        const previewUrl = g.thumbnailUrl.startsWith('blob:') || g.thumbnailUrl.startsWith('data:')
          ? (g.kind === 'video' ? URL.createObjectURL(file) : g.thumbnailUrl)
          : (g.thumbnailUrl || URL.createObjectURL(file));

        return {
          id: g.id,
          kind: g.kind,
          previewUrl,
          file,
          storageKey: null,
          durationSec: g.durationSec ?? (g.kind === 'image' ? 3 : 0),
          trimStart: 0,
          trimEnd: null,
          width: g.width,
          height: g.height,
          name: g.name,
        };
      }));

      addClips(additions);
      showSuccess(`${additions.length} item${additions.length > 1 ? 's' : ''} added`);
      setSelectionOrder([]);
      onNext();
    } catch (err) {
      logger.warn('[CreateStage] Failed to add clips:', err);
      showError('Failed to add selected media. Please try again.');
    } finally {
      setAddingClips(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)] pb-32 select-none" style={{ background: isDark ? '#0D080E' : '#FFFFFF' }}>
      {/* Subtle top ambient lighting */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-48 -z-0"
        style={{
          background: isDark
            ? 'radial-gradient(ellipse at 50% -20%, rgba(236,17,100,0.15), transparent 70%)'
            : 'radial-gradient(ellipse at 50% -20%, rgba(236,17,100,0.08), transparent 70%)',
        }}
      />

      {/* ── 1. POPULAR MUSIC SECTION ── */}
      <section className="px-4 pt-3 pb-2 relative z-10" aria-labelledby="popular-music-heading">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Music size={17} color="#EC1164" />
            <h2 id="popular-music-heading" className={`${isDark ? 'text-white' : 'text-gray-900'} font-bold text-[15px] tracking-tight`}>
              Use popular music
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenMusic}
            className={`w-8 h-8 rounded-full flex items-center justify-center ${
              isDark ? 'bg-[#1F1722] hover:bg-[#2A2030] text-white/80' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            } transition-colors`}
            aria-label="Search music"
          >
            <Search size={15} />
          </button>
        </div>

        {musicState === 'loading' && (
          <div className={`flex items-center gap-3 py-6 ${isDark ? 'text-white/60' : 'text-gray-500'} text-sm`}>
            <InlineSpinner size={16} /> Loading trending music…
          </div>
        )}

        {musicState === 'error' && (
          <div className="flex items-center gap-2 py-3 text-sm text-[#FFB3C6]">
            <AlertCircle size={15} className="shrink-0" />
            <span>Couldn't load trending music.</span>
            <button type="button" onClick={onOpenMusic} className="underline ml-1 font-bold" style={{ color: '#EC1164' }}>
              Search
            </button>
          </div>
        )}

        {musicState === 'ready' && (
          <div
            className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 scroll-smooth"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {trending.map((track) => {
              const isSelected = selectedMusic?.id === track.id;
              const isPlaying = playingId === track.id;

              return (
                <div
                  key={track.id}
                  className="shrink-0 w-[155px] rounded-[18px] p-3 flex flex-col justify-between transition-all"
                  style={{
                    background: isSelected
                      ? (isDark ? '#1E1422' : '#FFF0F5')
                      : (isDark ? '#18121B' : '#F9FAFB'),
                    border: `1px solid ${isSelected ? '#EC1164' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
                    boxShadow: isSelected ? '0 0 14px rgba(236,17,100,0.25)' : 'none',
                  }}
                >
                  {/* Top row: Artwork + Play/Pause + Options */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-10 h-10 rounded-full overflow-hidden shrink-0 ${isDark ? 'bg-white/10' : 'bg-gray-200'} flex items-center justify-center`}>
                        {track.thumbnailUrl ? (
                          <img src={track.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Music size={16} color="#EC1164" />
                        )}
                      </div>
                      <button
                        type="button"
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                          isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                        } transition-colors`}
                        onClick={() => togglePreview(track)}
                        aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                      >
                        {isPlaying ? <Pause size={12} fill={isDark ? 'white' : '#111827'} /> : <Play size={12} fill={isDark ? 'white' : '#111827'} className="ml-0.5" />}
                      </button>
                    </div>
                    <button
                      type="button"
                      className={`p-1 ${isDark ? 'text-white/40 hover:text-white/80' : 'text-gray-400 hover:text-gray-700'} transition-colors`}
                      aria-label="Options"
                      onClick={() => showSuccess(`${track.title} by ${track.artist}`)}
                    >
                      <MoreVertical size={15} />
                    </button>
                  </div>

                  {/* Title & Artist */}
                  <div className="min-w-0 mb-3">
                    <p className={`${isDark ? 'text-white' : 'text-gray-900'} text-[13px] font-bold truncate leading-tight`}>{track.title}</p>
                    <p className={`${isDark ? 'text-white/50' : 'text-gray-500'} text-[11px] truncate mt-0.5`}>{track.artist}</p>
                  </div>

                  {/* Use button */}
                  <button
                    type="button"
                    onClick={() => {
                      setMusic(isSelected ? null : { ...track, durationSec: track.duration });
                      stopPreview();
                    }}
                    className="w-full py-2 rounded-full text-[12px] font-bold transition-all active:scale-95"
                    style={{
                      background: isSelected ? '#EC1164' : (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)'),
                      color: isSelected ? '#fff' : (isDark ? '#fff' : '#111827'),
                    }}
                  >
                    {isSelected ? 'Use' : 'Use'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 2. GALLERY SECTION ── */}
      <section className="px-4 pt-4 relative z-10" aria-labelledby="gallery-heading">
        {/* Gallery Header with Album Dropdown */}
        <div className="relative mb-3">
          <button
            type="button"
            onClick={() => setSourceMenuOpen(v => !v)}
            className={`flex items-center gap-2 ${isDark ? 'text-white' : 'text-gray-900'} font-bold text-[17px] tracking-tight group`}
            id="gallery-heading"
            aria-expanded={sourceMenuOpen}
          >
            <ImageIcon size={18} color="#EC1164" />
            <span>Gallery</span>
            <ChevronDown
              size={16}
              className={`${isDark ? 'text-white/70' : 'text-gray-500'} transition-transform duration-200 ${sourceMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Sources Dropdown Menu */}
          {sourceMenuOpen && (
            <div
              className={`absolute left-0 top-8 z-30 w-56 rounded-2xl p-2 ${
                isDark ? 'bg-[#1C1420] border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900 shadow-xl'
              } border backdrop-blur-md`}
            >
              <div className={`${isDark ? 'text-white/40' : 'text-gray-400'} text-[11px] font-bold uppercase tracking-wider px-3 py-1.5`}>
                Media Albums
              </div>
              {sources.map(src => (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => handleSelectSource(src.id)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors ${
                    activeSource === src.id ? 'bg-[#EC1164] text-white' : (isDark ? 'text-white/80 hover:bg-white/10' : 'text-gray-700 hover:bg-gray-100')
                  }`}
                >
                  {src.kind === 'camera-roll' && <ImageIcon size={14} />}
                  {src.kind === 'videos' && <Play size={14} />}
                  {src.kind === 'photos' && <ImageIcon size={14} />}
                  {src.kind === 'browse' && <FolderOpen size={14} />}
                  <span>{src.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Media filter tabs: All | Videos | Photos + Grid Layout Toggle */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                filterTab === 'all'
                  ? 'bg-[#EC1164] text-white shadow-sm'
                  : (isDark ? 'bg-[#1F1722] text-white/90 hover:bg-[#281F2B]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('videos')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                filterTab === 'videos'
                  ? 'bg-[#EC1164] text-white shadow-sm'
                  : (isDark ? 'bg-[#1F1722] text-white/90 hover:bg-[#281F2B]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
              }`}
            >
              Videos
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('photos')}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                filterTab === 'photos'
                  ? 'bg-[#EC1164] text-white shadow-sm'
                  : (isDark ? 'bg-[#1F1722] text-white/90 hover:bg-[#281F2B]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
              }`}
            >
              Photos
            </button>
          </div>

          <button
            type="button"
            onClick={() => setGridColumns(c => (c === 3 ? 4 : 3))}
            className={`w-9 h-9 rounded-full flex items-center justify-center ${
              isDark ? 'bg-[#1F1722] hover:bg-[#281F2B] text-white/80' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            } transition-colors`}
            aria-label="Toggle grid layout"
          >
            <LayoutGrid size={16} />
          </button>
        </div>

        {/* Gallery Error Message */}
        {galleryError && (
          <div className="rounded-xl px-3 py-2.5 mb-3 text-xs bg-red-500/10 border border-red-500/20 text-[#FFC9C9]">
            {galleryError}
          </div>
        )}

        {/* Loading Skeletons */}
        {galleryLoading && items.length === 0 && (
          <div className={`grid ${gridColumns === 3 ? 'grid-cols-3 gap-2' : 'grid-cols-4 gap-1.5'}`}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className={`aspect-[3/4] rounded-xl ${isDark ? 'bg-white/[0.05]' : 'bg-gray-200'} animate-pulse`}
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!galleryLoading && filteredItems.length === 0 && (
          <div className={`py-12 flex flex-col items-center justify-center text-center px-4 rounded-2xl ${
            isDark ? 'bg-white/[0.03] border-white/10' : 'bg-gray-50 border-gray-200'
          } border border-dashed`}>
            <div className="w-12 h-12 rounded-full bg-[#EC1164]/10 flex items-center justify-center mb-3">
              <ImageIcon size={22} color="#EC1164" />
            </div>
            <p className={`${isDark ? 'text-white' : 'text-gray-900'} font-bold text-sm mb-1`}>
              {filterTab === 'videos' ? 'No videos found' : filterTab === 'photos' ? 'No photos found' : 'No media found'}
            </p>
            <p className={`${isDark ? 'text-white/50' : 'text-gray-500'} text-xs max-w-xs mb-4`}>
              Select photos and videos from your device to begin creating your reel.
            </p>
            <button
              type="button"
              onClick={handlePickFiles}
              className="px-5 py-2.5 rounded-full font-bold text-xs text-white transition-transform active:scale-95"
              style={{ background: '#EC1164', boxShadow: '0 4px 16px rgba(236,17,100,0.35)' }}
            >
              Choose photos & videos
            </button>
          </div>
        )}

        {/* Media Grid */}
        {filteredItems.length > 0 && (
          <div className={`grid ${gridColumns === 3 ? 'grid-cols-3 gap-2' : 'grid-cols-4 gap-1.5'}`}>
            {filteredItems.map((item) => {
              const orderIdx = selectionOrder.indexOf(item.id);
              const isSelected = orderIdx >= 0;

              return (
                <div
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className="relative aspect-[3/4] rounded-xl overflow-hidden bg-[#18121B] select-none cursor-pointer group active:scale-[0.98] transition-transform"
                  style={{
                    border: isSelected ? '2px solid #EC1164' : '1px solid rgba(255,255,255,0.06)',
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSelected}
                  aria-label={`${item.kind} ${item.name}`}
                >
                  {/* Thumbnail Image */}
                  <img
                    src={item.thumbnailUrl}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />

                  {/* Top-Right Circular Selection Indicator */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(item.id);
                    }}
                    className="absolute top-2 right-2 z-10"
                  >
                    {isSelected ? (
                      <div className="w-6 h-6 rounded-full bg-[#EC1164] border-2 border-white flex items-center justify-center text-white text-[11px] font-black shadow-md">
                        {orderIdx + 1}
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-white/85 bg-black/35 backdrop-blur-xs flex items-center justify-center transition-transform group-hover:scale-105" />
                    )}
                  </div>

                  {/* Bottom-Left Type Badge */}
                  {item.kind === 'video' ? (
                    <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/65 backdrop-blur-xs text-white text-[10px] font-bold pointer-events-none">
                      <Play size={9} fill="white" className="text-white" />
                      <span>{formatDuration(item.durationSec || 0)}</span>
                    </div>
                  ) : (
                    <div className="absolute bottom-1.5 left-1.5 flex items-center justify-center w-5 h-5 rounded bg-black/65 backdrop-blur-xs text-white pointer-events-none">
                      <ImageIcon size={11} className="text-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 3. FLOATING ACTION BAR ── */}
      {selectionOrder.length > 0 && (
        <div className="fixed left-4 right-4 bottom-6 z-30">
          <button
            type="button"
            disabled={addingClips}
            onClick={addSelected}
            className="w-full py-3.5 rounded-2xl font-extrabold text-white flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
            style={{
              background: '#EC1164',
              boxShadow: '0 8px 24px rgba(236,17,100,0.45)',
            }}
          >
            {addingClips ? (
              <>
                <InlineSpinner size={16} /> Adding to reel…
              </>
            ) : (
              <>
                Add {selectionOrder.length} to reel <Plus size={16} strokeWidth={2.5} />
              </>
            )}
          </button>
        </div>
      )}

      {/* Advance to preview if clips already added and no current selection */}
      {clips.length > 0 && selectionOrder.length === 0 && (
        <div className="fixed left-4 right-4 bottom-6 z-30">
          <button
            type="button"
            onClick={onNext}
            className="w-full py-3.5 rounded-2xl font-extrabold text-white flex items-center justify-center gap-2 transition-transform active:scale-[0.98]"
            style={{
              background: '#EC1164',
              boxShadow: '0 8px 24px rgba(236,17,100,0.45)',
            }}
          >
            Next · {clips.length} clip{clips.length > 1 ? 's' : ''} <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}
