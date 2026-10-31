import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Search, X } from 'lucide-react';
import api from '../../api/api';
import Spinner from '../ui/Spinner';

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lon: number | null;
}

interface LocationPickerProps {
  onSelect: (place: { name: string; address: string }) => void;
  onClose: () => void;
}

const isAbortError = (err: unknown): boolean => {
  if (typeof err === 'object' && err !== null) {
    const e = err as { name?: string; code?: string };
    return e.name === 'AbortError' || e.name === 'CanceledError' || e.code === 'ERR_CANCELED';
  }
  return false;
};

const LocationPicker: React.FC<LocationPickerProps> = ({ onSelect, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/location/search', { params: { q, limit: 8 }, signal: controller.signal });
      if (controller.signal.aborted) return;
      const rows: PlaceResult[] = Array.isArray(data?.results) ? data.results : [];
      setResults(rows);
      setHasSearched(true);
    } catch (err) {
      if (controller.signal.aborted || isAbortError(err)) return;
      setError('Search failed. Check your connection and try again.');
      setResults([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  // Debounced search (~300ms) — stale in-flight requests are aborted in runSearch.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setError(null);
      setHasSearched(false);
      setLoading(false);
      return;
    }
    const timer = setTimeout(() => { void runSearch(q); }, 300);
    return () => clearTimeout(timer);
  }, [query, runSearch]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const activeQuery = query.trim();

  return (
    <motion.div
      initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      className="absolute inset-x-0 bottom-0 z-[600] bg-white dark:bg-[#1b1b24] rounded-t-[40px] px-8 pt-6 pb-10 max-h-[80%] overflow-y-auto no-scrollbar"
      role="dialog" aria-label="Add location"
    >
      <div className="mx-auto mb-6 h-1.5 w-12 rounded-full bg-black/10 dark:bg-white/10" />
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-[16px] font-black italic uppercase tracking-tight text-[#18181b] dark:text-white">Add location</h2>
        <button onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-[#18181b] dark:text-white active:scale-90 transition-all"><X size={20} /></button>
      </div>

      <div className="flex items-center gap-3 h-14 px-5 bg-black/5 dark:bg-white/5 rounded-[24px] mb-6">
        <Search size={18} className="text-black/40 dark:text-white/40 shrink-0" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && activeQuery) void runSearch(activeQuery); }}
          placeholder="Search places..."
          className="flex-1 bg-transparent border-none outline-none text-[14px] font-bold text-[#18181b] dark:text-white placeholder-black/30 dark:placeholder-white/30"
        />
        {loading && <Spinner size="small" />}
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-4 py-10">
          <p className="text-[12px] font-bold text-slate-600 dark:text-zinc-400 text-center">{error}</p>
          <button
            onClick={() => { if (activeQuery) void runSearch(activeQuery); }}
            className="h-12 px-8 bg-primary text-white rounded-full font-black italic uppercase tracking-tight active:scale-95 transition-all"
          >
            Retry
          </button>
        </div>
      ) : !activeQuery ? (
        <div className="flex flex-col items-center gap-3 py-10 text-black/30 dark:text-white/30">
          <MapPin size={32} />
          <p className="text-[12px] font-black italic uppercase tracking-tight">Search for a place</p>
        </div>
      ) : loading && results.length === 0 && !hasSearched ? (
        <div className="flex items-center justify-center py-10"><Spinner size="large" /></div>
      ) : results.length === 0 ? (
        <p className="text-[12px] font-bold text-slate-600 dark:text-zinc-400 text-center py-10">No places found for "{activeQuery}"</p>
      ) : (
        <div className="flex flex-col gap-2">
          {results.map((place) => (
            <button
              key={place.id}
              onClick={() => onSelect({ name: place.name, address: place.address })}
              className="flex items-center gap-4 p-4 rounded-[24px] bg-black/5 dark:bg-white/5 active:scale-[0.98] transition-all text-left"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <MapPin size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-black italic uppercase tracking-tight text-[#18181b] dark:text-white truncate">{place.name}</p>
                <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-tight truncate">{place.address}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default LocationPicker;
