import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, X, Play, Pause, AlertCircle } from 'lucide-react';
import { StageShell, InlineSpinner, PINK } from './shell';
import { useReelCreatorStore } from '../reelCreatorStore';
import {
  fetchCategories, searchTracks, stopPreview, togglePreview, subscribePlayback, fetchTrending,
} from '../services/musicService';
import type { MusicCategory, } from '../services/musicService';
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
        if (seq !== requestSeq.current) return; // stale response guard
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

  // Stop audio whenever this stage unmounts (navigating away/closing)
  useEffect(() => () => stopPreview(), []);

  const handleBack = () => {
    stopPreview();
    onBack();
  };

  const handleSelect = (track: MusicTrack) => {
    stopPreview();
    setMusic({ ...track, durationSec: track.duration });
    setSelectedId(track.id);
    // Return to the preceding creation page (camera if that's where we came from)
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
          className="flex items-center gap-2 rounded-2xl px-3.5 h-11"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <Search size={16} color="rgba(255,255,255,0.5)" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search songs, artists…"
            className="flex-1 bg-transparent outline-none text-white text-[14px] placeholder:text-white/40"
            aria-label="Search music"
            enterKeyHint="search"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}
            >
              <X size={12} />
            </button>
          )}
          <button
            type="button"
            onClick={() => { if (debounceRef.current) clearTimeout(debounceRef.current); load(query, activeCategory); }}
            aria-label="Search"
            className="text-white/60 hover:text-white"
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
            className="shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-bold"
            style={{
              background: activeCategory === null ? PINK : 'rgba(255,255,255,0.07)',
              color: '#fff',
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
              className="shrink-0 px-3.5 py-1.5 rounded-full text-[12px] font-bold whitespace-nowrap"
              style={{
                background: activeCategory === cat.id ? PINK : 'rgba(255,255,255,0.07)',
                color: '#fff',
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
        <h2 className="text-white font-extrabold text-[15px] mb-2" style={{ fontFamily: "'Varela Round', sans-serif" }}>
          For you
        </h2>

        {status === 'loading' && (
          <div className="flex items-center gap-3 py-8 text-white/60 text-sm justify-center">
            <InlineSpinner /> Searching…
          </div>
        )}

        {status === 'error' && (
          <div className="flex items-start gap-2 py-6 text-sm" style={{ color: '#FFB3C6' }}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              Music search failed. Check your connection.
              <button type="button" className="underline ml-1" onClick={() => load(query, activeCategory)} style={{ color: PINK }}>
                Retry
              </button>
            </div>
          </div>
        )}

        {status === 'empty' && (
          <p className="py-6 text-white/50 text-sm">
            No results{query ? ` for “${query}”` : ''}. Try a different search.
          </p>
        )}

        {status === 'ready' && (
          <ul className="flex flex-col gap-1">
            {tracks.map((track) => {
              const isPlaying = playingId === track.id;
              const isSelected = selectedId === track.id;
              return (
                <li key={track.id}>
                  <div
                    className="flex items-center gap-3 rounded-2xl px-2 py-2"
                    style={{
                      background: isSelected ? 'rgba(255,0,110,0.14)' : 'transparent',
                      border: `1px solid ${isSelected ? `${PINK}66` : 'transparent'}`,
                    }}
                  >
                    <div
                      className="w-11 h-11 rounded-lg overflow-hidden shrink-0 flex items-center justify-center"
                      style={{ background: 'rgba(255,255,255,0.08)' }}
                    >
                      {track.thumbnailUrl ? (
                        <img src={track.thumbnailUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <span className="text-white/40 text-lg">♪</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-[14px] font-bold truncate">{track.title}</p>
                      <p className="text-white/55 text-[12px] truncate">{track.artist}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => togglePreview(track)}
                      aria-label={isPlaying ? `Pause ${track.title}` : `Play ${track.title} preview`}
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: isPlaying ? PINK : 'rgba(255,255,255,0.1)', color: '#fff' }}
                    >
                      {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelect(track)}
                      className="px-3.5 h-9 rounded-full text-[12px] font-bold shrink-0"
                      style={{
                        background: isSelected ? PINK : 'rgba(255,255,255,0.12)',
                        color: '#fff',
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
