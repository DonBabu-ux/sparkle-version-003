import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon, Grid, Layers, PlayCircle, Eye, Heart } from 'lucide-react';
import ErrorRetry from '../components/ui/ErrorRetry';
import api from '../api/api';
import type { Post } from '../types/post';
import { logger } from '../utils/logger';

function LazyMediaCard({ m, onClick }: { m: Post; idx: number; onClick: () => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  const isVideo = m.media_type === 'video' || (m.media_url && m.media_url.match(/\.(mp4|webm|ogg|mov)$/i));

  return (
    <div
      ref={cardRef}
      className={`aspect-square relative group cursor-pointer rounded-2xl overflow-hidden border border-[#e6d8e1] dark:border-zinc-700 bg-[#fdf8fa] dark:bg-zinc-800 shadow-sm transition-all duration-300 ${isVisible ? 'animate-scale-in opacity-100' : 'opacity-0'}`}
      onClick={onClick}
    >
      {isVisible ? (
        isVideo ? (
          <div className="w-full h-full relative">
            <video src={m.media_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1500ms]" preload="metadata" />
            <div className="absolute top-3 left-3 p-2 rounded-full bg-black/60 text-white z-10">
              <PlayCircle size={16} fill="white" strokeWidth={0} />
            </div>
          </div>
        ) : (
          <img
            src={m.media_url || 'https://placehold.co/600x600?text=Gallery'}
            alt=""
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1500ms]"
            loading="lazy"
          />
        )
      ) : (
        <div className="w-full h-full bg-[#f6eef3] dark:bg-zinc-900" />
      )}

      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-4 flex items-end gap-4">
        <div className="flex items-center gap-1.5 text-white text-xs font-semibold">
          <Heart size={14} strokeWidth={2.5} className="fill-[#ff1493] text-[#ff1493]" />
          {m.sparks || 0}
        </div>
        <div className="flex items-center gap-1.5 text-white text-xs font-semibold">
          <Eye size={14} strokeWidth={2.5} />
          {m.comments || 0}
        </div>
      </div>
    </div>
  );
}

export default function Gallery() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [media, setMedia] = useState<Post[]>([]);
  const [filter, setFilter] = useState<'all' | 'photos' | 'videos'>('all');

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get('/posts/feed?limit=40');
      const items = res.data.posts || res.data || [];
      // Filter out posts without media
      setMedia(items.filter((i: Post) => i.media_url && i.media_url !== '/uploads/defaults/no-image.png'));
    } catch (err) {
      logger.error('Failed to fetch gallery:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const filteredMedia = media.filter(m => {
    if (filter === 'all') return true;
    const isVideo = m.media_type === 'video' || 
                    m.type === 'video' ||
                    (m.media_url && m.media_url.match(/\.(mp4|webm|ogg|mov|m4v|3gp)$/i));
    return filter === 'videos' ? isVideo : !isVideo;
  });

  return (
    <div className="flex bg-[#f8e7ed] dark:bg-zinc-900 min-h-dvh text-[#18181b] dark:text-zinc-100 overflow-x-hidden">
      <div className="flex-1 px-4 py-8 md:px-8 md:py-12 max-w-[1400px] mx-auto w-full">

        <header className="mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-5 animate-fade-in">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f0e5ec] dark:bg-zinc-700 border border-[#e6d8e1] dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-semibold">
              <Layers size={14} className="text-primary" />
              <span>Gallery</span>
            </div>
            <div>
              <h1 className="text-3xl font-black text-[#18181b] dark:text-zinc-100 tracking-tight">
                Media Gallery
              </h1>
              <p className="text-[13px] text-slate-600 dark:text-zinc-400 leading-relaxed mt-2 max-w-xl">
                Photos and videos shared across campus.
              </p>
            </div>
          </div>

          <div className="flex w-full lg:w-auto items-center gap-2 overflow-x-auto p-1.5 bg-[#f0e5ec] dark:bg-zinc-700 rounded-[1.5rem] border border-[#e6d8e1] dark:border-zinc-700 no-scrollbar">
            {( [
              { key: 'all', icon: Grid, label: 'Everything' },
              { key: 'photos', icon: ImageIcon, label: 'Photos' },
              { key: 'videos', icon: PlayCircle, label: 'Videos' }
            ] as const).map(tab => (
              <button
                key={tab.key}
                className={`flex min-w-0 flex-1 items-center justify-center gap-2 h-11 px-4 rounded-2xl text-[12px] font-bold transition-colors whitespace-nowrap ${
                  filter === tab.key
                    ? 'bg-[#fdf8fa] dark:bg-zinc-800 text-[#18181b] dark:text-zinc-100 border border-[#e6d8e1] dark:border-zinc-700 shadow-sm'
                    : 'text-slate-600 dark:text-zinc-400 hover:text-[#18181b] dark:hover:text-zinc-100'
                }`}
                onClick={() => setFilter(tab.key)}
              >
                <tab.icon size={16} />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </header>

        <div className="relative z-10 pb-40">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="aspect-square bg-[#f6eef3] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <ErrorRetry onRetry={fetchMedia} />
          ) : filteredMedia.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-6 text-center animate-fade-in bg-[#f6eef3] dark:bg-zinc-900 border-2 border-dashed border-[#e6d8e1] dark:border-zinc-700 rounded-3xl px-4">
               <Layers size={32} strokeWidth={1.5} className="text-slate-600 dark:text-zinc-400" />
               <div className="space-y-4">
                 <h3 className="text-lg font-bold text-[#18181b] dark:text-zinc-100">Nothing here yet</h3>
                 <p className="text-[13px] text-slate-600 dark:text-zinc-400 max-w-sm mx-auto">You haven't shared any {filter !== 'all' ? filter : 'media'} yet.</p>
                 <button onClick={() => navigate('/dashboard')} className="mt-2 px-5 h-11 bg-primary text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors">Start sharing</button>
               </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredMedia.map((m, idx) => (
                <LazyMediaCard key={m.post_id} m={m} idx={idx} onClick={() => navigate(`/post/${m.post_id}`)} />
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .animate-scale-in { animation: scaleIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }

        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}



