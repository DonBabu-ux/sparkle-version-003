import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart2, Orbit, CheckCircle2, ChevronLeft } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';

interface PollOption {
  option_id: string;
  option_text: string;
  vote_count: number;
}

interface PollDetail {
  poll_id: string;
  question: string;
  creator_name?: string;
  username?: string;
  is_anonymous?: boolean;
  total_votes?: number;
  created_at: string;
  campus?: string;
  options?: PollOption[];
  user_voted_option?: string;
}

export default function PollDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [poll, setPoll] = useState<PollDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const fetchPoll = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/polls/${id}/results`);
      const data = res.data.poll || res.data;
      setPoll(data);
      if (data.user_voted_option) setSelected(data.user_voted_option);
    } catch (err) {
      console.error('Poll detail fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) fetchPoll();
  }, [id, fetchPoll]);

  const handleVote = async (optionId: string) => {
    if (poll?.user_voted_option || voting) return;
    setVoting(true);
    setSelected(optionId);
    try {
      await api.post(`/polls/${id}/vote`, { option_id: optionId });
      fetchPoll();
    } catch (err) {
      console.error('Vote error:', err);
      setSelected(poll?.user_voted_option || null);
    } finally {
      setVoting(false);
    }
  };

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
      <Navbar />

      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-4xl mx-auto w-full pt-16 md:pt-12">
        <button 
          onClick={() => navigate('/polls')}
          className="mb-12 w-16 h-16 rounded-[24px] bg-white border border-white shadow-2xl flex items-center justify-center text-black hover:scale-110 active:scale-95 transition-all group"
        >
          <ArrowLeft size={28} strokeWidth={4} className="group-hover:-translate-x-1.5 transition-transform" />
        </button>

        {loading ? (
          <div className="p-12 bg-white/80 backdrop-blur-3xl rounded-[56px] border border-white shadow-2xl space-y-10">
             <div className="flex items-center gap-6 animate-pulse">
                <div className="w-16 h-16 bg-black/5 rounded-[22px]" />
                <div className="space-y-3 flex-1">
                   <div className="w-32 h-3 bg-black/5 rounded-full" />
                   <div className="w-1/2 h-4 bg-black/5 rounded-full" />
                </div>
             </div>
             <div className="space-y-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-20 bg-black/5 rounded-[28px]" />
                ))}
             </div>
          </div>
        ) : !poll ? (
          <div className="py-48 flex flex-col items-center justify-center text-center gap-10 bg-white/60 backdrop-blur-3xl border-4 border-dashed border-white rounded-[80px] shadow-2xl shadow-primary/5 animate-fade-in">
             <Orbit size={140} strokeWidth={2} className="text-primary/10 animate-spin-slow" />
             <div className="space-y-4">
                <h3 className="text-5xl font-black text-black opacity-5 italic uppercase tracking-tighter">Transmission Lost.</h3>
                <p className="text-[10px] font-black text-black opacity-20 uppercase tracking-[0.4em] max-w-xs mx-auto italic">This poll harmonic has faded from the village network.</p>
                <button onClick={() => navigate('/polls')} className="mt-8 px-12 h-18 bg-primary text-white rounded-[24px] font-black uppercase tracking-widest italic hover:scale-105 transition-all shadow-xl shadow-primary/30">Sector Scan</button>
             </div>
          </div>
        ) : (
          <div className="bg-white/80 backdrop-blur-3xl border border-white/65 p-12 md:p-20 rounded-[56px] shadow-2xl shadow-primary/5 animate-fade-in relative group overflow-hidden">
             {/* Background Accent */}
             <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 blur-[100px] pointer-events-none group-hover:opacity-100 transition-opacity opacity-60"></div>
             
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-12 mb-16 relative z-10">
                <div className="flex items-center gap-8">
                   <div className="w-20 h-20 bg-primary text-white rounded-[32px] flex items-center justify-center shadow-2xl shadow-primary/30 animate-scale-in">
                      <BarChart2 size={36} strokeWidth={4} />
                   </div>
                   <div>
                      <div className="flex items-center gap-3 text-[10px] font-black text-black opacity-20 uppercase tracking-[0.4em] mb-3 italic">
                         Node: <span className="text-primary opacity-100">{poll.is_anonymous ? 'Classified' : (poll.creator_name || `@${poll.username}`)}</span>
                         <span className="w-1 h-1 bg-black/10 rounded-full mx-2" />
                         {new Date(poll.created_at).toLocaleDateString()}
                      </div>
                      <div className="text-[11px] font-black text-black uppercase tracking-[0.2em] italic">
                         {poll.total_votes || 0} Harmonics Synchronized
                      </div>
                   </div>
                </div>
                {poll.campus && (
                  <div className="px-8 py-3 bg-primary/5 border border-primary/20 text-primary rounded-full text-[10px] font-black uppercase tracking-widest italic animate-pulse">
                     {poll.campus} Sector
                  </div>
                )}
             </div>

             <h2 className="text-4xl md:text-6xl font-black text-black tracking-tighter uppercase italic leading-none mb-16 relative z-10">
                {poll.question}
             </h2>

             {poll.user_voted_option && (
               <div className="mb-12 flex items-center gap-5 px-8 py-5 bg-emerald-500/5 border-2 border-emerald-500/10 rounded-[28px] animate-fade-in">
                  <CheckCircle2 size={24} strokeWidth={4} className="text-emerald-500" />
                  <p className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.2em] italic">Consensus Locked: Your harmonic is synced.</p>
               </div>
             )}

             <div className="space-y-6 relative z-10">
                {poll.options?.map(opt => {
                  const pct = poll.total_votes && poll.total_votes > 0
                    ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;
                  const isSelected = selected === opt.option_id;
                  const hasVoted = !!poll.user_voted_option;

                  return (
                    <button
                      key={opt.option_id}
                      className={`w-full text-left p-10 md:p-12 rounded-[40px] border-2 transition-all duration-700 relative overflow-hidden group/opt ${hasVoted ? 'cursor-default transition-all duration-1000' : 'cursor-pointer hover:border-primary hover:bg-white hover:scale-[1.02] active:scale-95'} ${isSelected ? 'border-primary bg-white shadow-2xl shadow-primary/10' : 'border-transparent bg-black/5 shadow-inner'}`}
                      onClick={() => handleVote(opt.option_id)}
                      disabled={hasVoted || voting}
                    >
                      <div className="flex justify-between items-center mb-6 relative z-10">
                        <span className={`text-xl font-black uppercase tracking-tighter italic transition-all duration-500 leading-none ${isSelected ? 'text-primary' : hasVoted ? 'text-black opacity-30' : 'text-black opacity-40'}`}>{opt.option_text}</span>
                        {hasVoted && (
                          <span className={`text-2xl font-black italic tracking-tighter ${isSelected ? 'text-primary scale-110' : 'text-black opacity-20'}`}>{pct}%</span>
                        )}
                      </div>
                      
                      {hasVoted && (
                        <div className="relative z-10 space-y-4">
                          <div className="h-4 bg-black/5 rounded-full overflow-hidden p-1 shadow-inner">
                            <div className="h-full bg-primary rounded-full transition-all duration-[2s] ease-out shadow-2xl" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex justify-end pr-2 font-black text-[9px] text-black opacity-20 uppercase tracking-widest italic">{opt.vote_count} Nodes Linked</div>
                        </div>
                      )}
                      
                      {/* Interaction Shine */}
                      {!hasVoted && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-100%] group-hover/opt:translate-x-[100%] transition-transform duration-1000 pointer-events-none"></div>
                      )}
                    </button>
                  );
                })}
             </div>
             
             <div className="mt-20 pt-12 border-t border-black/5 flex items-center justify-center">
                <button onClick={() => navigate('/polls')} className="flex items-center gap-4 text-[10px] font-black text-black opacity-20 uppercase tracking-[0.4em] italic hover:opacity-100 hover:text-primary transition-all">
                   <ChevronLeft size={20} strokeWidth={4} /> Back to Consensus Hub
                </button>
             </div>
          </div>
        )}
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-spin-slow { animation: spin 20s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scaleIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) backwards; }
      `}</style>
    </div>
  );
}
