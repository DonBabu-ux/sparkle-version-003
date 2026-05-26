import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, Plus, ChevronRight, Hash, Calendar, MapPin, Orbit, Sparkles, Zap, Users } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';
import CountdownTimer from '../components/ui/CountdownTimer';
import { useUserStore } from '../store/userStore';
import { useModalStore } from '../store/modalStore';
import ModernOfflineState from '../components/ui/ModernOfflineState';

interface PollOption {
  option_id: string;
  option_text: string;
  vote_count: number;
}

interface Poll {
  poll_id: string;
  question: string;
  creator_name?: string;
  username?: string;
  is_anonymous?: boolean;
  total_votes?: number;
  created_at: string;
  expires_at?: string;
  campus?: string;
  options?: PollOption[];
  user_voted?: boolean;
  engagement_score?: number;
  is_ending_soon?: boolean;
  is_expired?: boolean;
  creator_avatar?: string;
  friends_participating?: any[];
}

export default function Polls() {
  const { user } = useUserStore();
  const { setActiveModal } = useModalStore();
  const navigate = useNavigate();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('for_you');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isInitialLoad, setIsInitialBurst] = useState(true);

  const fetchPolls = useCallback(async (isLoadMore = false) => {
    if (loadingMore || (loading && isLoadMore)) return;
    
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const currentOffset = isLoadMore ? offset : 0;
      const currentLimit = (isLoadMore || !isInitialLoad) ? 10 : 2; 

      const res = await api.get('/polls', { 
        params: { 
          filter, 
          offset: currentOffset,
          limit: currentLimit
        } 
      });
      
      const incomingPolls = res.data.polls || [];
      
      setPolls(prev => {
        if (!isLoadMore) return incomingPolls;
        
        // Prevent duplicates
        const existingIds = new Set(prev.map(p => p.poll_id));
        const filtered = incomingPolls.filter((p: Poll) => !existingIds.has(p.poll_id));
        return [...prev, ...filtered];
      });

      setHasMore(res.data.hasMore);
      setOffset(prev => prev + incomingPolls.length);

      // Handle the initial burst transition
      if (isInitialLoad && !isLoadMore && res.data.hasMore && incomingPolls.length === 2) {
         setIsInitialBurst(false);
         // Small delay before fetching the rest to keep UI smooth
         setTimeout(() => fetchPolls(true), 400);
      }
    } catch (err) {
      console.error('Fetch polls error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter, offset, loading, loadingMore, isInitialLoad]);

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    fetchPolls(false);
  }, [filter]); // Only re-fetch when filter changes

  // Infinite Scroll Observer
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 500) {
        if (!loading && !loadingMore && hasMore) {
          fetchPolls(true);
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, loadingMore, hasMore, fetchPolls]);

  const tabs = [
    { id: 'for_you', label: 'For You', icon: <Sparkles size={14} /> },
    { id: 'trending', label: 'Trending', icon: <BarChart2 size={14} /> },
    { id: 'friends', label: 'Friends', icon: <Users size={14} /> },
    { id: 'ending_soon', label: 'Ending Soon', icon: <Zap size={14} /> },
    { id: 'new', label: 'Recent', icon: <Calendar size={14} /> }
  ];

  return (
    <div className="flex bg-transparent min-h-screen text-black overflow-x-hidden font-sans">
      <Navbar />

      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-[1400px] mx-auto w-full pt-[calc(5rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))] md:pt-32">
        
        {/* ── Header ── */}
        <header className="flex flex-col xl:flex-row items-center justify-between gap-6 mb-8 animate-fade-in px-4">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full bg-white/80 border border-white backdrop-blur-3xl shadow-md shadow-primary/5">
              <BarChart2 size={14} strokeWidth={3} className="text-primary" />
              <span className="text-[10px] font-bold text-black uppercase tracking-wider">Polls</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight leading-none">
              Sparkle <span className="text-primary">Consensus</span>
            </h1>
            <p className="text-sm md:text-base font-medium text-black/60 leading-relaxed max-w-xl border-l-4 border-primary/20 pl-4">
              Cast your vote and synchronize your node with the collective harmonic.
            </p>
          </div>

          <button 
            onClick={() => setActiveModal('poll', fetchPolls)}
            className="group w-full xl:w-auto h-12 px-6 bg-primary text-white rounded-full font-bold text-sm uppercase tracking-wide shadow-lg shadow-primary/30 hover:scale-105 hover:shadow-primary/50 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Plus size={20} strokeWidth={3} /> Create Poll
          </button>
        </header>

        {/* Discovery Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mb-8 animate-fade-in px-4 pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-2 px-6 h-11 rounded-full text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap shadow-sm border ${filter === tab.id ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105' : 'bg-white text-gray-400 border-white/60 hover:text-primary hover:bg-primary/5'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div className="relative z-10 px-4">
          {loading && polls.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-64 bg-white/60 backdrop-blur-3xl border border-white rounded-3xl p-8 space-y-6 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                   <div className="flex justify-between items-center">
                      <div className="w-24 h-4 bg-gray-100 rounded-lg animate-pulse" />
                      <div className="w-16 h-4 bg-primary/5 rounded-lg animate-pulse" />
                   </div>
                   <div className="w-full h-8 bg-gray-100 rounded-xl animate-pulse" />
                   <div className="space-y-3">
                      <div className="w-full h-12 bg-gray-50 rounded-2xl animate-pulse" />
                      <div className="w-full h-12 bg-gray-50 rounded-2xl animate-pulse" />
                   </div>
                </div>
              ))}
            </div>
          ) : polls.length === 0 ? (
            <div className="py-20">
               <ModernOfflineState 
                 type="empty"
                 title="Consensus Needed"
                 message="No active polls found in this frequency. Be the first to spark a conversation and gather the village's opinion!"
                 onRetry={() => fetchPolls(false)}
               />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-24">
              {polls.map((poll, idx) => (
                <div 
                  key={poll.poll_id} 
                  onClick={() => navigate(`/polls/${poll.poll_id}`)}
                  className="group relative bg-white border border-white/60 p-6 md:p-8 rounded-xl hover:scale-[1.01] transition-all duration-300 cursor-pointer shadow-sm hover:shadow-xl hover:shadow-primary/5 animate-scale-in flex flex-col overflow-hidden"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="absolute -right-5 -bottom-5 text-black/[0.03] -rotate-12 z-0 pointer-events-none" aria-hidden>
                    <BarChart2 size={140} strokeWidth={0.75} />
                  </div>
                  
                  <div className="flex justify-between items-center gap-4 mb-4 relative z-10">
                     <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-xl text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                          <Calendar size={12} strokeWidth={2.5} /> {new Date(poll.created_at).toLocaleDateString()}
                       </div>
                       {(poll.engagement_score ?? 0) > 10 ? (
                         <span className="bg-amber-400 text-white text-[9px] font-black px-2 py-1 rounded-xl uppercase flex items-center gap-1">
                            <BarChart2 size={10} /> Trending
                         </span>
                       ) : null}
                       {!!poll.is_ending_soon && !poll.is_expired ? (
                          <div className="px-2 py-1.5 bg-rose-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm shadow-rose-200 animate-pulse">
                           Ending Soon
                         </div>
                       ) : null}
                       {poll.expires_at && !poll.is_expired && (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 rounded-xl border border-rose-100">
                            <CountdownTimer expiresAt={poll.expires_at} onEnd={() => fetchPolls(false)} className="!bg-transparent !border-none !p-0 !text-rose-500 font-black text-[9px]" />
                          </div>
                        )}
                     </div>
                     <div className="px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-[10px] font-bold uppercase tracking-wider">
                        {poll.total_votes && poll.total_votes > 0 ? `${poll.total_votes} Votes` : 'Initial Node'}
                     </div>
                  </div>

                  <h3 className="text-[17px] font-black text-gray-900 mb-4 group-hover:text-primary transition-colors leading-snug uppercase tracking-tight">
                     {poll.question}
                  </h3>

                  <div className="flex items-center gap-2 mb-6 relative z-10 text-[11px] font-semibold text-gray-500">
                     <img src={poll.creator_avatar || '/uploads/avatars/default.png'} className="w-4 h-4 rounded-full" alt="" />
                     <span>By <span className="text-gray-800">{poll.is_anonymous ? 'Classified' : (poll.creator_name || `@${poll.username}`)}</span></span>
                     <span className="w-1 h-1 rounded-full bg-gray-300" />
                     <span className="text-primary">{poll.campus || 'Global Spectrum'}</span>
                  </div>

                  {poll.friends_participating && poll.friends_participating.length > 0 ? (
                    <div className="mb-6 flex items-center gap-2 animate-fade-in">
                       <div className="flex -space-x-2">
                          {poll.friends_participating.map((f: any, i: number) => (
                            <img key={i} src={f.avatar_url} className="w-6 h-6 rounded-full border-2 border-white shadow-sm" alt="" />
                          ))}
                       </div>
                       <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                         {poll.friends_participating.length === 1 
                           ? `@${poll.friends_participating[0].username} voted` 
                           : `Friends are voting`}
                       </p>
                    </div>
                  ) : null}

                  <div className="space-y-4 relative z-10 flex-1">
                  {poll.options && poll.options.slice(0, 2).map(opt => {
                    const pct = poll.total_votes && poll.total_votes > 0 ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;
                    return (
                      <div key={opt.option_id} className="space-y-2">
                        <div className="flex justify-between font-bold text-[12px] text-gray-700">
                           <span className="truncate pr-2">{opt.option_text}</span>
                           <span className={pct > 0 ? 'text-primary' : 'text-gray-400'}>{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                           <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-gray-400 group-hover:text-primary transition-all relative z-10">
                     <p className="text-[11px] font-black uppercase tracking-widest">{poll.is_expired ? 'View Results' : 'Join Conversation'}</p>
                     <ChevronRight size={18} strokeWidth={3} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}

              {loadingMore && (
                <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-4 pb-10">
                   {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-48 bg-white/40 backdrop-blur-3xl border border-white rounded-3xl p-6 relative overflow-hidden">
                       <div className="absolute inset-0 animate-shimmer" />
                       <div className="w-1/3 h-4 bg-gray-100 rounded-full animate-pulse mb-4" />
                       <div className="w-full h-8 bg-gray-100 rounded-xl animate-pulse" />
                       <div className="w-2/3 h-4 bg-gray-50 rounded-full animate-pulse mt-4" />
                    </div>
                  ))}
                </div>
              )}

              {/* End of Feed Indicator */}
              {!hasMore && polls.length > 0 ? (
                <div className="col-span-full py-10 flex flex-col items-center gap-4">
                  <div className="w-12 h-1 bg-gray-200 rounded-full" />
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-[0.3em]">End of Spectrum</p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-spin-slow { animation: spin 20s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scaleIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) backwards; }
      `}</style>
    </div>
  );
}
