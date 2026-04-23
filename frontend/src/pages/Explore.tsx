import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Eye, Heart, Compass, TrendingUp, Orbit } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';

interface ExploreMedia {
  post_id: string;
  content?: string;
  username: string;
  avatar_url?: string;
  media_url?: string;
  media_type?: string;
  sparks?: number;
  comments?: number;
  created_at: string;
}

export default function Explore() {
  const navigate = useNavigate();
  const [mediaItems, setMediaItems] = useState<ExploreMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Trending');

  useEffect(() => { fetchExploreMedia(); }, []);

  const fetchExploreMedia = async () => {
    setLoading(true);
    try {
      const res = await api.get('/posts/feed?limit=50&tab=trending');
      const data = Array.isArray(res.data) ? res.data : (res.data.posts || []);
      const itemsWithMedia = data.filter((item: ExploreMedia) => item.media_url && item.media_url !== '/uploads/defaults/no-image.png');
      setMediaItems(itemsWithMedia);
    } catch (err) {
      console.error('Explore fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black font-sans overflow-x-hidden">
      <Navbar />

      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <div className="flex-1 px-6 py-20 lg:ml-72 lg:px-12 lg:py-24 max-w-7xl mx-auto w-full relative z-10 pt-20 md:pt-12">
        <header className="flex flex-col items-center text-center mb-32 animate-fade-in px-4">
          <div className="inline-flex items-center gap-4 px-8 py-3 bg-white/80 backdrop-blur-3xl border border-white rounded-full mb-12 shadow-xl shadow-primary/5">
            <Compass size={20} strokeWidth={3} className="text-primary" />
            <span className="text-[10px] font-black text-black uppercase tracking-[0.4em] italic">The Discovery Hub</span>
          </div>
          
          <h1 className="text-5xl md:text-9xl font-black text-black tracking-tighter leading-none mb-10 italic uppercase">
            Campus <span className="text-primary">Pulse</span>
          </h1>
          
          <p className="text-xl font-bold text-black opacity-60 max-w-2xl leading-relaxed italic">
            Discover high-frequency signals and visual chronicles from across the village.
          </p>

          <div className="flex items-center gap-4 mt-20 p-3 bg-white/60 backdrop-blur-3xl rounded-[40px] border border-white/65 shadow-2xl shadow-primary/5 overflow-x-auto no-scrollbar max-w-full">
            {['Trending', 'Stories', 'Moments', 'Live'].map((tab) => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-12 py-5 rounded-[30px] font-black text-[11px] uppercase tracking-widest transition-all duration-500 italic ${activeTab === tab ? 'bg-primary text-white shadow-2xl shadow-primary/30 scale-105' : 'text-black/20 hover:bg-white hover:text-black'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </header>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-10 px-2">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-[3/5] bg-white/40 border-4 border-dashed border-white rounded-[56px] animate-pulse" />
            ))}
          </div>
        ) : mediaItems.length === 0 ? (
          <div className="py-48 flex flex-col items-center justify-center text-center gap-12 bg-white/20 border-4 border-dashed border-white rounded-[64px] shadow-inner animate-fade-in mx-4">
            <div className="relative">
                <Orbit size={140} strokeWidth={1} className="text-black/5 animate-spin-slow" />
                <Compass size={60} strokeWidth={1} className="absolute inset-0 m-auto text-black/10" />
            </div>
            <div className="space-y-6">
              <h3 className="text-5xl font-black text-black/10 italic uppercase tracking-tighter">Quiet Frequency.</h3>
              <p className="text-[11px] font-black text-black/30 uppercase tracking-[0.4em] max-w-xs mx-auto leading-loose italic">No commercial signals detected in this spectrum. Check back soon.</p>
              <button onClick={fetchExploreMedia} className="mt-8 px-12 py-6 bg-primary text-white rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 hover:scale-[1.05] active:scale-95 transition-all italic">Recalibrate Hub</button>
            </div>
          </div>
        ) : (
          <div className="columns-2 lg:columns-3 xl:columns-4 gap-10 space-y-10 pb-48 animate-fade-in px-2">
            {mediaItems.map((m) => (
              <div 
                key={m.post_id} 
                className="break-inside-avoid relative group cursor-pointer rounded-[48px] overflow-hidden border border-white bg-white/80 backdrop-blur-3xl shadow-xl hover:shadow-2xl hover:shadow-primary/5 transition-all duration-700 hover:scale-[1.03] active:scale-95" 
                onClick={() => navigate(`/post/${m.post_id}`)}
              >
                <div className="relative overflow-hidden m-2 rounded-[40px] border border-black/5">
                  <img
                    src={m.media_url || 'https://placehold.co/400x600?text=Scan+Error'}
                    alt={m.content || m.username}
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                    loading="lazy"
                  />
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 p-10 flex flex-col justify-end gap-8 backdrop-blur-[4px]">
                    <div className="flex items-center gap-4 translate-y-8 group-hover:translate-y-0 transition-transform duration-500">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden border-4 border-white shadow-2xl">
                        <img src={m.avatar_url || '/uploads/avatars/default.png'} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black text-sm text-white italic uppercase tracking-tighter">@{m.username}</span>
                        <span className="text-[9px] font-black text-white/50 uppercase tracking-widest italic leading-none">Signal Creator</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between border-t border-white/20 pt-6 translate-y-8 group-hover:translate-y-0 transition-transform duration-700 delay-100">
                        <div className="flex items-center gap-8">
                          <div className="flex items-center gap-3 text-white font-black text-[11px] uppercase tracking-widest italic">
                            <Heart size={20} fill={m.sparks !== undefined && m.sparks > 0 ? "#e11d48" : "none"} strokeWidth={3} className={m.sparks !== undefined && m.sparks > 0 ? "text-primary" : ""} />
                            {formatCount(m.sparks || 0)}
                          </div>
                          <div className="flex items-center gap-3 text-white font-black text-[11px] uppercase tracking-widest italic">
                            <Eye size={20} strokeWidth={3} />
                            {formatCount(m.comments || 0)}
                          </div>
                        </div>
                        <TrendingUp size={20} strokeWidth={4} className="text-primary animate-pulse" />
                    </div>
                  </div>

                  {m.media_type === 'video' && (
                    <div className="absolute top-6 right-6 p-4 bg-black/40 backdrop-blur-3xl border border-white/20 rounded-2xl text-white shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-500 rotate-12 group-hover:rotate-0">
                      <Play size={20} fill="currentColor" strokeWidth={0} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .columns-2 { column-count: 2; }
        @media (min-width: 1024px) { .columns-3 { column-count: 3; } }
        @media (min-width: 1280px) { .columns-4 { column-count: 4; } }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .animate-spin-slow { animation: spin 15s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function formatCount(count: number): string {
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
  return count.toString();
}
