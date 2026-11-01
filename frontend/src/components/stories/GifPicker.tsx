import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { fetchGiphyItems } from '../../utils/giphyClient';
import { logger } from '../../utils/logger';
import Spinner from '../ui/Spinner';

/**
 * One Giphy result reduced to what the sticker layer needs: the animated url
 * (played by the viewer) plus the still frame (cheap first paint + the poster
 * image browsers show before the gif decodes).
 */
export interface GifItem {
  id: string;
  url: string;
  still: string;
  width?: number;
  height?: number;
  title?: string;
}

interface GifPickerProps {
  onSelect: (gif: GifItem) => void;
  onClose: () => void;
}

/** Shape of a raw Giphy response item we actually read. */
interface RawGiphyItem {
  id?: string | number;
  title?: string;
  images?: Record<string, { url?: string; width?: string | number; height?: string | number } | undefined>;
}

/** Pull the still + animated urls out of a raw Giphy images object. */
function toGifItem(raw: RawGiphyItem): GifItem | null {
  const images = raw?.images;
  if (!images) return null;
  const url = images.fixed_height?.url || images.original?.url || images.downsized?.url;
  const still =
    images.fixed_height_still?.url ||
    images.original_still?.url ||
    images.downsized_still?.url ||
    url;
  if (!url) return null;
  return {
    id: String(raw.id ?? url),
    url,
    still,
    width: Number(images.fixed_height?.width) || undefined,
    height: Number(images.fixed_height?.height) || undefined,
    title: raw.title || undefined,
  };
}

/**
 * Giphy picker for story stickers: trending feed + debounced search against the
 * server-side proxy (`/api/giphy/*`) — the API key stays server-side.
 */
const GifPicker: React.FC<GifPickerProps> = ({ onSelect, onClose }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const items = await fetchGiphyItems({
        type: 'gifs',
        endpoint: q.trim() ? 'search' : 'trending',
        q: q.trim() || undefined,
        limit: 24,
      });
      setResults(items.map(toGifItem).filter((g): g is GifItem => g !== null));
    } catch (err) {
      logger.error('[GifPicker] Failed to load gifs', err);
      setError('Could not load GIFs');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial trending load, then debounce every query change.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(query), query ? 350 : 0);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, load]);

  return (
    <div className="fixed inset-0 z-(--z-toast) flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        role="presentation"
      />

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative bg-white dark:bg-[#1b1b24] w-full sm:max-w-[440px] rounded-t-[40px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-label="GIFs"
      >
        <div className="p-4 flex flex-col items-center border-b border-gray-50 dark:border-white/5 bg-white dark:bg-[#1b1b24] sticky top-0 z-10">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-4 dark:bg-white/10" />
          <div className="flex items-center justify-between w-full px-4">
            <h3 className="text-[16px] font-black italic uppercase tracking-tighter">GIFs</h3>
            <button
              onClick={onClose}
              aria-label="Close GIF picker"
              className="w-8 h-8 bg-gray-100 dark:bg-[#101217] rounded-full flex items-center justify-center text-[#18181b] dark:text-white active:scale-90"
            >
              <X size={16} strokeWidth={3} />
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-gray-50 dark:border-white/5 shrink-0">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-black/20 dark:text-white/20" size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search GIFs..."
              aria-label="Search GIFs"
              className="w-full bg-black/5 dark:bg-white/5 border border-transparent focus:border-primary/50 rounded-full py-3.5 pl-12 pr-6 text-[13px] font-bold text-[#18181b] dark:text-white outline-none transition-all placeholder:text-black/30 dark:placeholder:text-white/20"
            />
            {loading && <Spinner size="small" className="absolute right-5 top-1/2 -translate-y-1/2 text-primary" />}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-4">
          {error ? (
            <div className="py-20 text-center">
              <p className="text-[12px] font-black italic uppercase tracking-widest text-black/30 dark:text-white/30">{error}</p>
            </div>
          ) : loading && results.length === 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="aspect-square bg-black/5 dark:bg-white/5 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : results.length === 0 ? (
            <div className="py-20 text-center opacity-30">
              <p className="text-[12px] font-black italic uppercase tracking-widest">No GIFs found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {results.map((gif) => (
                <motion.button
                  key={gif.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSelect(gif)}
                  className="relative aspect-square bg-black/5 dark:bg-white/5 rounded-2xl overflow-hidden border-2 border-transparent hover:border-primary/30 active:border-primary transition-all"
                >
                  <img
                    src={gif.still}
                    alt={gif.title || 'GIF'}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default GifPicker;
