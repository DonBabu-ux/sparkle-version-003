import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X, Play, Pause, AlertCircle } from 'lucide-react';
import { StageShell, InlineSpinner, PINK } from './shell';
import { useCreateMomentsTheme } from '../useCreateMomentsTheme';
import { useReelCreatorStore } from '../reelCreatorStore';
import {
  fetchCategories, searchTracks, stopPreview, togglePreview, subscribePlayback, fetchTrending,
} from '../services/musicService';
import type { MusicCategory } from '../services/musicService';
import type { MusicTrack } from '../types';

/**
 * Full-screen Music discovery: debounced search, scrollable categories,
 * "For you" results, preview play/pause, and explicit soundtrack selection
 * (playing ≠ selecting). Audio stops when the page closes.
 */
export default function MusicDiscoveryStage({ onBack }: { onBack: () => void }) {
  const selectedMusic = useReelCreatorStore(s => s.selectedMusic);
  const setMusic = useReelCreatorStore(s => s.setMusic);
  const setStage = useReelCreatorStore(s => s.setStage);
  const { isDark } = useCreateMomentsTheme();

  const [query, setQuery] = useState('');
  const [categories, setCategories] = useState<MusicCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(selectedMusic?.id ?? null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);

  useEffect(() => subscribePlayback(setPlayingId), []);

  // Categories once
  useEffect(() => {
    let alive = true;
    fetchCategories().then(c => { if (alive) setCategories(c); });
    return () => { alive = false; };
  }, []);

  const load = useCallback((q: string, category: string | null) => {
    const seq = ++requestSeq.current;
    setStatus('loading');
    const effectiveQuery = q.trim() || (category ? category : '');
    const promise = effectiveQuery
      ? searchTracks(effectiveQuery, 1, 25)
      : fetchTrending(25);
    promise
      .then((result) => {
        if (seq !== requestSeq.current) return;
        setTracks(result);
        setStatus(result.length ? 'ready' : 'empty');
      })
      .catch(() => {
        if (seq !== requestSeq.current) return;
        setTracks([]);
        setStatus('error');
      });
  }, []);

  // Initial + category/search reloads with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = query.trim() ? 400 : 0;
    debounceRef.current = setTimeout(() => load(query, activeCategory), delay);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, activeCategory, load]);

  // Stop audio whenever this stage unmounts
  useEffect(() => () => stopPreview(), []);

  const handleBack = () => {
    stopPreview();
    onBack();
  };

  const handleSelect = (track: MusicTrack) => {
    stopPreview();
    setMusic({ ...track, durationSec: track.duration });
    setSelectedId(track.id);
    const prev = useReelCreatorStore.getState().previousStage;
    setStage(prev === 'camera' ? 'camera' : 'create');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (debounceRef.current) clearTimeout(debounceRef.current);
      load(query, activeCategory);
    }
  };

  return (
    <StageShell title="Music" leftIcon="back" onLeft={handleBack}>
      {/* Search input */}
      <div className="px-4 pt-3 pb-2">
        <div
          className="flex items-center gap-2.5 rounded-2xl px-3.5 h-11"
          style={{
            background: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E5E7EB'}`,
          }}
        >
          <Search size={17} color={isDark ? 'rgba(255,255,255,0.5)' : '#4B5563'} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search songs, artists…"
            className={`flex-1 bg-transparent outline-none text-[14px] font-medium ${
              isDark ? 'text-white placeholder:text-white/40' : 'text-gray-900 placeholder:text-gray-500'
            }`}
            aria-label="Search music"
            enterKeyHint="search"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="w-6 h-6 rounded-full flex items-center justify-center transition-opacity"
              style={{
                background: isDark ? 'rgba(255,255,255,0.15)' : '#E5E7EB',
                color: isDark ? '#fff' : '#111827',
              }}
            >
              <X size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={() => { if (debounceRef.current) clearTimeout(debounceRef.current); load(query, activeCategory); }}
            aria-label="Search"
            className={isDark ? 'text-white/60 hover:text-white' : 'text-gray-600 hover:text-gray-900'}
          >
            <Search size={17} />
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="px-4 py-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="flex gap-2 w-max">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className="shrink-0 px-4 py-1.5 rounded-full text-[13px] font-bold transition-all"
            style={{
              background: activeCategory === null ? PINK : (isDark ? 'rgba(255,255,255,0.07)' : '#FFFFFF'),
              color: activeCategory === null ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937'),
              border: activeCategory === null ? 'none' : `1px solid ${isDark ? 'transparent' : '#D1D5DB'}`,
              boxShadow: activeCategory === null || isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
            }}
            aria-pressed={activeCategory === null}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(prev => (prev === cat.id ? null : cat.id))}
              className="shrink-0 px-4 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap transition-all"
              style={{
                background: activeCategory === cat.id ? PINK : (isDark ? 'rgba(255,255,255,0.07)' : '#FFFFFF'),
                color: activeCategory === cat.id ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937'),
                border: activeCategory === cat.id ? 'none' : `1px solid ${isDark ? 'transparent' : '#D1D5DB'}`,
                boxShadow: activeCategory === cat.id || isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
              }}
              aria-pressed={activeCategory === cat.id}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* For you list */}
      <section className="px-4 pt-2 pb-8" aria-label="For you">
        <h2 className={`font-black text-[16px] mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`} style={{ fontFamily: "'Varela Round', sans-serif" }}>
          For you
        </h2>

        {status === 'loading' && (
          <div className={`flex items-center gap-3 py-8 text-sm justify-center ${isDark ? 'text-white/60' : 'text-gray-600 font-medium'}`}>
            <InlineSpinner /> Searching…
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-start gap-2 py-6 text-sm" style={{ color: '#FFB3C6' }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              Music search failed. Check your connection.
              <button type="button" className="underline ml-1 font-bold" onClick={() => load(query, activeCategory)} style={{ color: PINK }}>
                Retry
              </button>
            </div>
          </div>
        )}

        {status === 'empty' && (
          <p className={`py-6 text-sm text-center ${isDark ? 'text-white/50' : 'text-gray-600 font-medium'}`}>
            No results{query ? ` for “${query}”` : ''}. Try a different search.
          </p>
        )}

        {status === 'ready' && (
          <ul className="flex flex-col gap-1.5">
            {tracks.map((track) => {
              const isPlaying = playingId === track.id;
              const isSelected = selectedId === track.id;
              return (
                <li key={track.id}>
                  <div
                    className="flex items-center gap-3 rounded-2xl px-2.5 py-2 transition-colors"
                    style={{
                      background: isSelected ? 'rgba(255,0,110,0.14)' : 'transparent',
                      border: `1px solid ${isSelected ? `${PINK}66` : 'transparent'}`,
                    }}
                  >
                    <div
                      className="w-11 h-11 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
                      style={{
                        background: isDark ? 'rgba(255,255,255,0.08)' : '#F3F4F6',
                        border: `1px solid ${isDark ? 'transparent' : '#E5E7EB'}`,
                      }}
                    >
                      {track.thumbnailUrl ? (
                        <img src={track.thumbnailUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <span className={isDark ? 'text-white/40 text-lg' : 'text-gray-500 text-lg'}>♪</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[14px] font-extrabold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {track.title}
                      </p>
                      <p className={`text-[12px] truncate font-medium ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                        {track.artist}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePreview(track)}
                      aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title} preview`}
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95"
                      style={{
                        background: isPlaying ? PINK : (isDark ? 'rgba(255,255,255,0.1)' : '#F3F4F6'),
                        color: isPlaying ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937'),
                        border: isPlaying ? 'none' : `1px solid ${isDark ? 'transparent' : '#D1D5DB'}`,
                      }}
                    >
                      {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelect(track)}
                      className="px-4 h-9 rounded-full text-[13px] font-extrabold shrink-0 transition-transform active:scale-95"
                      style={{
                        background: isSelected ? PINK : (isDark ? 'rgba(255,255,255,0.12)' : '#FFFFFF'),
                        color: isSelected ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#111827'),
                        border: isSelected ? 'none' : `1.5px solid ${isDark ? 'transparent' : '#D1D5DB'}`,
                        boxShadow: isSelected || isDark ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                      }}
                    >
                      {isSelected ? 'Selected' : 'Use'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </StageShell>
  );
}
