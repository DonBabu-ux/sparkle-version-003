import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Orbit, Image as ImageIcon, Grid, Layers, PlayCircle, Eye, Heart } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';
import type { Post } from '../types/post';

export default function Gallery() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState<Post[]>([]);
  const [filter, setFilter] = useState<'all' | 'photos' | 'videos'>('all');

  useEffect(() => {
    const fetchMedia = async () => {
      setLoading(true);
      try {
        const res = await api.get('/posts/feed?limit=24');
        const items = res.data.posts || res.data || [];
        // Filter out posts without media
        setMedia(items.filter((i: Post) => i.media_url && i.media_url !== '/uploads/defaults/no-image.png'));
      } catch (err) {
        console.error('Failed to fetch gallery:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMedia();
  }, []);

  const filteredMedia = media.filter(m => {
    if (filter === 'all') return true;
    const isVideo = m.media_type === 'video' || (m.media_url && m.media_url.match(/\.(mp4|webm|ogg|mov)$/i));
    return filter === 'videos' ? isVideo : !isVideo;
  });

  return (
    <div className="flex bg-white min-h-screen text-black overflow-x-hidden">
      <Navbar />
      <div className="flex-1 px-8 py-24 md:px-20 md:py-40 max-w-[1400px] mx-auto w-full relative">
        {/* Subtle ambient glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/[0.04] blur-[120px] rounded-full pointer-events-none" />

        <header className="mb-24 flex flex-col md:flex-row md:items-end justify-between gap-12 animate-fade-in relative z-10">
          <div className="max-w-3xl space-y-8">
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-black/5 border border-black/5">
              <Layers size={18} className="text-primary" />
              <span className="text-[10px] font-black text-black/40 uppercase tracking-[0.4em]">Visual Archive</span>
            </div>
            <h1 className="font-heading font-black text-7xl md:text-9xl text-black tracking-tighter italic uppercase leading-[0.85]">
              Media <br /><span className="text-primary italic">Gallery.</span>
            </h1>
            <p className="text-lg font-semibold text-black/30 leading-relaxed border-l-4 border-primary/30 pl-8">
               A curated collection of your shared moments, stories, and visual contributions to the campus spirit.
            </p>
          </div>

          <div className="flex bg-black/[0.02] border border-black/5 p-2 rounded-[32px] shadow-sm">
            {( [
              { key: 'all', icon: Grid, label: 'Everything' },
              { key: 'photos', icon: ImageIcon, label: 'Photos' },
              { key: 'videos', icon: PlayCircle, label: 'Videos' }
            ] as const).map(tab => (
              <button 
                key={tab.key}
                className={`px-10 py-5 rounded-[28px] font-black text-[11px] uppercase tracking-[0.3em] transition-all duration-700 flex items-center gap-4 font-heading italic ${filter === tab.key ? 'bg-black text-white shadow-2xl scale-105' : 'text-black/30 hover:text-black hover:bg-black/5'}`}
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
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
              {[...Array(12)].map((_, i) => (
                <div key={i} className="aspect-square bg-black/[0.02] border border-black/5 rounded-[48px] animate-pulse" />
              ))}
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="py-64 flex flex-col items-center justify-center gap-12 text-center animate-fade-in bg-black/[0.01] border-[12px] border-dashed border-black/5 rounded-[96px] shadow-inner">
               <div className="relative">
                  <Orbit size={120} strokeWidth={1} className="text-black/[0.03] animate-spin-slow" />
                  <Layers size={60} strokeWidth={1} className="absolute inset-0 m-auto text-black/10" />
               </div>
               <div className="space-y-6">
                 <h3 className="font-heading font-black text-5xl text-black/10 italic uppercase tracking-tighter">Archive Empty.</h3>
                 <p className="text-sm font-medium text-black/20 uppercase tracking-[0.2em] max-w-xs mx-auto">You haven't shared any {filter !== 'all' ? filter : 'media'} yet.</p>
                 <button onClick={() => navigate('/dashboard')} className="mt-8 px-12 py-5 bg-black text-white rounded-full font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl hover:bg-primary transition-all active:scale-95">Start Sharing</button>
               </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
              {filteredMedia.map((m, idx) => {
                const isVideo = m.media_type === 'video' || (m.media_url && m.media_url.match(/\.(mp4|webm|ogg|mov)$/i));
                return (
                  <div 
                    key={m.post_id} 
                    className="aspect-square relative group cursor-pointer rounded-[48px] md:rounded-[64px] overflow-hidden border border-black/5 bg-white shadow-2xl shadow-black/5 transition-all duration-1000 hover:-translate-y-4 animate-scale-in" 
                    style={{ animationDelay: `${idx * 80}ms` }}
                    onClick={() => navigate(`/post/${m.post_id}`)}
                  >
                    {isVideo ? (
                      <div className="w-full h-full relative">
                        <video src={m.media_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1500ms]" />
                        <div className="absolute top-8 left-8 p-4 bg-white/20 backdrop-blur-xl border border-white/20 rounded-2xl text-white shadow-2xl z-10">
                          <PlayCircle size={24} fill="white" strokeWidth={0} />
                        </div>
                      </div>
                    ) : (
                      <img
                        src={m.media_url || 'https://placehold.co/600x600?text=Gallery'}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[1500ms]"
                        loading="lazy"
                      />
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-700 p-10 flex flex-col justify-end gap-6 backdrop-blur-[2px]">
                      <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3 text-white font-black text-[12px] uppercase tracking-widest font-heading italic">
                          <Heart size={20} strokeWidth={4} className="fill-primary text-primary" />
                          {m.sparks || 0}
                        </div>
                        <div className="flex items-center gap-3 text-white font-black text-[12px] uppercase tracking-widest font-heading italic">
                          <Eye size={20} strokeWidth={3} className="text-white/40" />
                          {m.comments || 0}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        .animate-fade-in { animation: fadeIn 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-scale-in { animation: scaleIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        .animate-spin-slow { animation: spin 40s linear infinite; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
