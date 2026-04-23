import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, Plus, ChevronRight, Hash, Calendar, MapPin, Orbit } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import { useModalStore } from '../store/modalStore';

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
  campus?: string;
  options?: PollOption[];
  user_voted?: boolean;
}

export default function Polls() {
  const { user } = useUserStore();
  const { setActiveModal } = useModalStore();
  const navigate = useNavigate();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [campusFilter, setCampusFilter] = useState<'all' | 'campus'>('all');

  const fetchPolls = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (campusFilter === 'campus' && user?.campus) params.campus = user.campus;
      const res = await api.get('/polls', { params });
      setPolls(res.data.polls || res.data || []);
    } catch (err) {
      console.error('Polls fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [campusFilter, user?.campus]);

  useEffect(() => { fetchPolls(); }, [fetchPolls]);

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
      <Navbar />

      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-[1400px] mx-auto w-full pt-20 md:pt-32">
        
        {/* ── Header ── */}
        <header className="flex flex-col xl:flex-row items-center justify-between gap-16 mb-24 animate-fade-in px-4">
          <div className="max-w-3xl space-y-8">
            <div className="inline-flex items-center gap-4 px-6 py-2.5 rounded-full bg-white/80 border border-white backdrop-blur-3xl shadow-xl shadow-primary/5">
              <BarChart2 size={18} strokeWidth={3} className="text-primary" />
              <span className="text-[10px] font-black text-black uppercase tracking-[0.4em] italic">Village Pulse</span>
            </div>
            <h1 className="text-6xl md:text-9xl font-black text-black tracking-tighter leading-none italic uppercase">
              Campus <span className="text-primary italic">Consensus.</span>
            </h1>
            <p className="text-xl font-bold text-black opacity-60 leading-relaxed max-w-xl italic border-l-8 border-primary/20 pl-8">
              Cast your vote and synchronize your node with the collective village harmonic.
            </p>
          </div>

          <button 
            onClick={() => setActiveModal('poll', fetchPolls)}
            className="group w-full xl:w-auto h-24 px-12 bg-primary text-white rounded-[32px] font-black text-sm uppercase tracking-[0.3em] italic shadow-2xl shadow-primary/40 hover:scale-[1.05] hover:shadow-primary/60 transition-all active:scale-95 flex items-center justify-center gap-6"
          >
            <Plus size={32} strokeWidth={4} /> Initialize Poll
          </button>
        </header>

        {/* Filter Section */}
        <div className="flex items-center gap-6 mb-20 animate-fade-in px-4">
          {[
            { id: 'all', label: 'Universal', icon: Hash },
            { id: 'campus', label: 'Local Sector', icon: MapPin }
          ].map(filter => (
            <button 
              key={filter.id}
              onClick={() => setCampusFilter(filter.id as 'all' | 'campus')}
              className={`h-16 px-10 rounded-[24px] font-black text-[11px] uppercase tracking-[0.3em] transition-all flex items-center gap-4 border shadow-sm italic ${campusFilter === filter.id ? 'bg-white border-white text-primary shadow-2xl shadow-primary/10' : 'bg-white/40 border-white/60 text-black opacity-30 hover:opacity-100 hover:bg-white'}`}
            >
              <filter.icon size={16} strokeWidth={3} /> {filter.label}
            </button>
          ))}
        </div>

        <div className="relative z-10 px-4">
          {loading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pb-40">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-72 bg-white/40 backdrop-blur-3xl border border-white rounded-[56px] animate-pulse shadow-sm p-12 space-y-6">
                   <div className="w-1/3 h-4 bg-black/5 rounded-full" />
                   <div className="w-full h-8 bg-black/5 rounded-full" />
                   <div className="w-1/2 h-4 bg-black/5 rounded-full" />
                </div>
              ))}
            </div>
          ) : polls.length === 0 ? (
            <div className="py-64 flex flex-col items-center justify-center text-center gap-8 bg-white/40 backdrop-blur-3xl border-4 border-dashed border-white rounded-[80px] shadow-2xl shadow-primary/5 animate-fade-in">
               <Orbit size={140} strokeWidth={2} className="text-primary/10 animate-spin-slow" />
               <div className="space-y-6 px-8">
                  <h3 className="text-5xl font-black text-black opacity-5 italic uppercase tracking-tighter">Silent Frequency.</h3>
                  <p className="text-[10px] font-black text-black opacity-20 uppercase tracking-[0.4em] max-w-xs mx-auto italic">No active polls found. Be the first to initiate a consensus harmonic in your sector.</p>
                  <button onClick={() => setActiveModal('poll', fetchPolls)} className="mt-8 px-12 h-18 bg-primary/10 border-2 border-primary/20 text-primary rounded-[24px] font-black uppercase tracking-widest italic hover:bg-primary hover:text-white transition-all">Start Broadcast</button>
               </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pb-64">
              {polls.map((poll, idx) => (
                <div 
                  key={poll.poll_id} 
                  onClick={() => navigate(`/polls/${poll.poll_id}`)}
                  className="group relative bg-white/80 backdrop-blur-3xl border border-white/65 p-12 rounded-[56px] hover:scale-[1.02] transition-all duration-700 cursor-pointer shadow-2xl shadow-primary/5 animate-scale-in"
                  style={{ animationDelay: `${idx * 100}ms` }}
                >
                  {/* Glass Card Gradient Shine */}
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none rounded-[56px]" />

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12 relative z-10">
                     <div className="flex items-center gap-4 px-6 py-3 bg-black/5 rounded-full text-[9px] font-black text-black opacity-30 uppercase tracking-[0.2em] italic">
                        <Calendar size={14} strokeWidth={3} /> {new Date(poll.created_at).toLocaleDateString()}
                     </div>
                     <div className="px-8 py-3 bg-primary text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-primary/20 italic">
                        {poll.total_votes || 0} Harmonics Syncing
                     </div>
                  </div>

                  <h3 className="text-3xl font-black text-black mb-6 group-hover:text-primary transition-all duration-500 leading-none tracking-tighter uppercase italic">
                     {poll.question}
                  </h3>

                  <div className="flex items-center gap-4 mb-12 px-2 relative z-10">
                     <span className="text-[10px] font-black text-black opacity-20 uppercase tracking-[0.2em] italic">Node</span>
                     <span className="text-[11px] font-black text-black italic uppercase tracking-widest">{poll.is_anonymous ? 'Classified' : (poll.creator_name || `@${poll.username}`)}</span>
                     <span className="w-1.5 h-1.5 rounded-full bg-primary/20" />
                     <span className="text-[11px] font-black text-primary italic uppercase tracking-widest">{poll.campus || 'Global Spectrum'}</span>
                  </div>

                  <div className="space-y-8 relative z-10">
                  {poll.options && poll.options.slice(0, 2).map(opt => {
                    const pct = poll.total_votes && poll.total_votes > 0 ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;
                    return (
                      <div key={opt.option_id} className="space-y-4">
                        <div className="flex justify-between font-black text-[11px] text-black uppercase tracking-tighter italic">
                           <span className="truncate pr-4">{opt.option_text}</span>
                           <span className={pct > 0 ? 'text-primary scale-110' : 'opacity-20'}>{pct}%</span>
                        </div>
                        <div className="h-3 bg-black/5 rounded-full overflow-hidden shadow-inner p-0.5">
                           <div className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  </div>

                  <div className="mt-16 pt-10 border-t border-black/5 flex items-center justify-between text-black opacity-10 group-hover:opacity-100 group-hover:text-primary transition-all duration-700 relative z-10">
                     <p className="text-[11px] font-black italic uppercase tracking-[0.3em]">Join Conversation</p>
                     <ChevronRight size={28} strokeWidth={4} className="group-hover:translate-x-4 transition-transform duration-500" />
                  </div>
                </div>
              ))}
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
