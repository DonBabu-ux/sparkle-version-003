import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, MessageSquare, Share2, Sparkles, Orbit, ChevronLeft } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';
import clsx from 'clsx';

interface MomentData {
  moment_id: string;
  username: string;
  avatar_url?: string;
  caption?: string;
  media_url?: string;
  thumbnail_url?: string;
  is_video?: boolean;
  like_count?: number;
  view_count?: number;
  comment_count?: number;
  created_at: string;
  is_liked?: boolean;
}

export default function MomentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [moment, setMoment] = useState<MomentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState(false);

  const fetchMoment = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/moments/${id}`);
      setMoment(res.data.moment || res.data);
    } catch (err) {
      console.error('Moment detail error:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) fetchMoment(); }, [id, fetchMoment]);

  const handleLike = async () => {
    if (!moment || liking) return;
    setLiking(true);
    const wasLiked = moment.is_liked;
    setMoment(prev => prev ? { ...prev, is_liked: !wasLiked, like_count: (prev.like_count || 0) + (wasLiked ? -1 : 1) } : prev);
    try {
      await api.post(`/moments/${id}/spark`);
    } catch {
      setMoment(prev => prev ? { ...prev, is_liked: wasLiked, like_count: (prev.like_count || 0) + (wasLiked ? 1 : -1) } : prev);
    } finally {
      setLiking(false);
    }
  };

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black font-sans overflow-x-hidden">
      <Navbar />
      
      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 md:p-12 relative z-10 flex flex-col items-center pt-16 md:pt-12">
        <div className="w-full max-w-[550px]">
          <button 
            onClick={() => navigate('/moments')} 
            className="mb-12 w-16 h-16 rounded-[24px] bg-white border border-white shadow-2xl flex items-center justify-center text-black hover:scale-110 active:scale-95 transition-all group"
          >
            <ArrowLeft size={28} strokeWidth={4} className="group-hover:-translate-x-1.5 transition-transform" /> 
          </button>

          {loading ? (
            <div className="w-full flex flex-col items-center justify-center py-48 bg-white/40 backdrop-blur-3xl border border-white rounded-[56px] shadow-2xl">
               <Orbit className="w-16 h-16 text-primary animate-spin-slow mb-8" strokeWidth={4} />
               <p className="text-[10px] font-black italic text-black/20 uppercase tracking-[0.4em] animate-pulse">Syncing Moment Pulse...</p>
            </div>
          ) : !moment ? (
            <div className="bg-white/40 backdrop-blur-3xl border-4 border-dashed border-white p-24 rounded-[80px] text-center shadow-2xl shadow-primary/5 animate-fade-in flex flex-col items-center gap-10">
              <div className="w-24 h-24 bg-black/5 rounded-[32px] flex items-center justify-center text-black opacity-10">
                 <Orbit size={64} strokeWidth={1.5} className="animate-spin-slow" />
              </div>
              <div className="space-y-4">
                 <h2 className="text-5xl font-black italic tracking-tighter uppercase leading-none">Frequency <span className="text-primary">Faded.</span></h2>
                 <p className="text-base font-bold text-black opacity-30 italic leading-relaxed">This moment harmonic is no longer broadcasting in the village network.</p>
              </div>
              <button 
                onClick={() => navigate('/moments')}
                className="px-12 h-18 bg-primary text-white rounded-[24px] font-black uppercase tracking-widest italic text-sm shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
              >
                Scan Sectors
              </button>
            </div>
          ) : (
            <div className="relative group animate-fade-in shadow-[0_48px_120px_rgba(225,29,72,0.15)] rounded-[56px] overflow-hidden bg-black border-[10px] border-white ring-1 ring-black/5">
              {/* Media Container */}
              <div className="relative w-full aspect-[9/16] max-h-[85vh] bg-black">
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none z-10" />
                
                {moment.media_url?.includes('tiktok.com') ? (
                  <iframe 
                    src={`https://www.tiktok.com/embed/v2/${moment.media_url.split('/video/')[1]?.split('?')[0]}`} 
                    className="w-full h-full border-none"
                    allow="autoplay; encrypted-media"
                    title="TikTok Video"
                  />
                ) : moment.is_video ? (
                  <video 
                    src={moment.media_url} 
                    className="w-full h-full object-cover" 
                    controls 
                    autoPlay 
                    loop
                    poster={moment.thumbnail_url} 
                  />
                ) : (
                  <img 
                    src={moment.media_url || moment.thumbnail_url} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[2000ms]" 
                    alt="Moment" 
                  />
                )}

                {/* Glass Side Actions Overlay */}
                <div className="absolute right-6 bottom-40 flex flex-col items-center gap-8 z-30">
                  <button className="flex flex-col items-center gap-3 group/btn" onClick={handleLike}>
                    <div className={clsx("w-16 min-w-16 h-16 rounded-[24px] backdrop-blur-3xl flex items-center justify-center transition-all group-hover/btn:scale-110 shadow-2xl border-2", moment.is_liked ? "bg-primary border-primary text-white" : "bg-white/10 border-white/20 text-white hover:bg-white hover:text-primary")}>
                      <Heart size={32} fill={moment.is_liked ? "currentColor" : "none"} strokeWidth={3} />
                    </div>
                    <span className="text-[11px] font-black text-white uppercase tracking-[0.2em] italic drop-shadow-2xl">{moment.like_count || 0}</span>
                  </button>

                  <button className="flex flex-col items-center gap-3 group/btn">
                    <div className="w-16 min-w-16 h-16 rounded-[24px] bg-white/10 backdrop-blur-3xl border-2 border-white/20 flex items-center justify-center text-white transition-all group-hover/btn:scale-110 hover:bg-white hover:text-primary shadow-2xl">
                      <MessageSquare size={32} strokeWidth={3} />
                    </div>
                    <span className="text-[11px] font-black text-white uppercase tracking-[0.2em] italic drop-shadow-2xl">{moment.comment_count || 0}</span>
                  </button>

                  <button className="w-16 min-w-16 h-16 rounded-[24px] bg-white/10 backdrop-blur-3xl border-2 border-white/20 flex items-center justify-center text-white transition-all hover:bg-white hover:text-primary group-hover:scale-110 shadow-2xl">
                    <Share2 size={28} strokeWidth={3} />
                  </button>
                </div>

                {/* Editorial Bottom Info Overlay */}
                <div className="absolute inset-x-0 bottom-0 p-10 pb-12 z-20 flex flex-col gap-5 pointer-events-none bg-gradient-to-t from-black via-black/40 to-transparent">
                  <div className="flex items-center gap-4">
                    <h3 className="text-2xl font-black text-white italic tracking-tighter pointer-events-auto cursor-pointer flex items-center gap-3 transition-colors hover:text-primary leading-none uppercase" onClick={() => navigate(`/profile/${moment.username}`)}>
                      @{moment.username}
                      <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-2xl shadow-primary/50 border border-white/20">
                         <Sparkles size={10} className="text-white fill-white" />
                      </div>
                    </h3>
                  </div>
                  
                  {moment.caption && (
                    <p className="text-lg font-black text-white leading-tight drop-shadow-2xl pr-20 line-clamp-3 italic uppercase tracking-tighter opacity-80">
                      {moment.caption}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 mt-2 px-1">
                     <Orbit size={16} strokeWidth={3} className="animate-spin-slow text-primary" />
                     <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] italic">{moment.view_count || 0} Village Nodes Synced</span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-16 text-center">
             <button onClick={() => navigate('/moments')} className="flex items-center justify-center gap-4 text-black opacity-20 hover:opacity-100 hover:text-primary text-[10px] font-black uppercase tracking-[0.5em] transition-all italic mx-auto">
                <ChevronLeft size={20} strokeWidth={4} /> Back to Signal Sector
             </button>
          </div>
        </div>
      </main>

      <style>{`
         @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-spin-slow { animation: spin 15s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
