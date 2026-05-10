import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart2, CheckCircle2, ChevronRight, Users, X, UserPlus, UserCheck, Sparkles, Orbit } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';
import CountdownTimer from '../components/ui/CountdownTimer';
import Spinner from '../components/ui/Spinner';
import { useUserStore } from '../store/userStore';
import { useSocket } from '../hooks/useSocket';

interface Voter {
  user_id: string;
  name: string;
  username: string;
  avatar_url: string;
  is_following: boolean;
}

interface PollOption {
  option_id: string;
  option_text: string;
  vote_count: number;
  voters: Voter[];
}

interface PollDetailData {
  poll_id: string;
  question: string;
  creator_name?: string;
  username?: string;
  creator_avatar?: string;
  is_anonymous?: boolean;
  total_votes?: number;
  created_at: string;
  expires_at?: string;
  campus?: string;
  options?: PollOption[];
  user_voted_option?: string | null;
  is_expired?: boolean;
  is_ending_soon?: boolean;
  engagement_score?: number;
  allow_invites?: boolean;
}

const getSafeAvatarUrl = (url: string | undefined) => {
  if (!url) return '/uploads/avatars/default.png';
  if (url.startsWith('http')) return url;
  return url.startsWith('/') ? url : `/${url}`;
};


export default function PollDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useUserStore();
  const [poll, setPoll] = useState<PollDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [showVotersSheet, setShowVotersSheet] = useState(false);
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [invitedUsers, setInvitedUsers] = useState<string[]>([]);
  const [prediction, setPrediction] = useState<string | null>(null);
  const socket = useSocket();

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

  const fetchFollowers = useCallback(async () => {
    try {
      const res = await api.get('/users/followers');
      setFollowers(res.data);
    } catch (err) {
      console.error('Followers fetch error:', err);
    }
  }, []);

  useEffect(() => {
    if (id) fetchPoll();
  }, [id, fetchPoll]);

  useEffect(() => {
    if (!socket || !id) return;
    socket.on('poll_participation', (data: { poll_id: string, option_id: string, total_votes: number }) => {
      if (data.poll_id === id) {
        setPoll(prev => {
          if (!prev) return null;
          const updatedOptions = prev.options?.map(opt => {
            if (opt.option_id === data.option_id) {
              return { ...opt, vote_count: opt.vote_count + 1 };
            }
            return opt;
          });
          return { ...prev, total_votes: data.total_votes, options: updatedOptions };
        });
      }
    });
    return () => { socket.off('poll_participation'); };
  }, [socket, id]);

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

  const handleFollow = async (userId: string, isFollowing: boolean) => {
    try {
      if (isFollowing) await api.delete(`/users/${userId}/follow`);
      else await api.post(`/users/${userId}/follow`);
      if (poll) {
        const updatedOptions = poll.options?.map(opt => ({
          ...opt,
          voters: opt.voters.map(v => v.user_id === userId ? { ...v, is_following: !isFollowing } : v)
        }));
        setPoll({ ...poll, options: updatedOptions });
      }
    } catch (err) { console.error(err); }
  };

  if (loading) return (
    <div className="bg-[#fdf2f4] min-h-screen flex items-center justify-center">
       <Spinner size="large" color="text-primary" />
    </div>
  );

  if (!poll) return (
    <div className="bg-[#fdf2f4] min-h-screen flex items-center justify-center flex-col gap-4">
       <p className="text-gray-400 font-bold uppercase tracking-widest">Poll not found</p>
       <button onClick={() => navigate('/polls')} className="text-primary font-black uppercase text-xs">Return Home</button>
    </div>
  );

  const hasVoted = !!poll.user_voted_option;
  const isExpired = poll.is_expired;

  return (
    <div className="bg-transparent min-h-screen text-black overflow-x-hidden font-sans pb-20">
      <main className="relative z-10 max-w-xl mx-auto w-full p-4 md:p-8 pt-10">
        <button 
          onClick={() => navigate('/polls')}
          className="mb-8 w-12 h-12 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-gray-400 hover:text-primary transition-all hover:scale-105 active:scale-95"
        >
          <ArrowLeft size={24} strokeWidth={2.5} />
        </button>

        <div className="space-y-6 animate-fade-in">
           <div className="bg-white border border-gray-100 p-6 md:p-10 rounded-3xl shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start mb-8">
                 <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-primary bg-primary/5 px-2 py-1 rounded-md uppercase tracking-[0.2em]">{poll.campus || 'Global Spectrum'}</span>
                      {(poll.engagement_score ?? 0) > 10 ? (
                        <span className="bg-amber-400 text-white text-[9px] font-black px-2 py-1 rounded-md uppercase flex items-center gap-1">
                           <BarChart2 size={10} /> Trending
                        </span>
                      ) : null}
                    </div>
                    <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight leading-tight">{poll.question}</h1>
                 </div>
              </div>

              <div className="flex items-center gap-3 mb-8">
                 <img src={getSafeAvatarUrl(poll.creator_avatar)} className="w-8 h-8 rounded-full border-2 border-white shadow-sm" alt="" />
                 <div className="flex flex-col">
                    <span className="text-[11px] font-black text-gray-900 leading-none mb-1">{poll.is_anonymous ? 'Anonymous' : (poll.creator_name || `@${poll.username}`)}</span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{new Date(poll.created_at).toLocaleDateString()}</span>
                 </div>
                 <div className="ml-auto flex flex-col items-end gap-1">
                     {poll.expires_at && !isExpired ? <CountdownTimer expiresAt={poll.expires_at} onEnd={fetchPoll} /> : null}
                     {!!isExpired ? <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-1 rounded-md">Ended</span> : null}
                 </div>
              </div>

              {/* Predict the Winner */}
              {!hasVoted && !isExpired && (
                <div className="mb-8 p-6 bg-gray-900 rounded-3xl space-y-4">
                   <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-amber-400" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">Predict the Majority</span>
                   </div>
                   <div className="grid grid-cols-2 gap-2">
                      {poll.options?.map(opt => (
                        <button
                          key={opt.option_id}
                          onClick={async () => {
                            setPrediction(opt.option_id);
                            try {
                               await api.post(`/polls/${id}/predict`, { option_id: opt.option_id });
                            } catch (err) { console.error(err); }
                          }}
                          className={`py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest border-2 transition-all ${prediction === opt.option_id ? 'bg-primary border-primary text-white scale-105' : 'bg-white/5 border-white/10 text-white/40 hover:border-white/20'}`}
                        >
                          {prediction === opt.option_id ? 'Target Set' : 'Predict'}
                        </button>
                      ))}
                   </div>
                </div>
              )}

              <div className="space-y-4">
                {poll.options?.map((opt) => {
                  const pct = poll.total_votes ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;
                  const isSelected = selected === opt.option_id;
                  const showResults = hasVoted || isExpired;

                  if (showResults) {
                    return (
                      <div key={opt.option_id} className="space-y-3">
                         <div className="flex justify-between items-end px-1">
                            <div>
                               <p className={`text-sm font-bold mb-0.5 ${isSelected ? 'text-primary' : 'text-gray-900'}`}>{opt.option_text}</p>
                               <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{opt.vote_count} votes</p>
                            </div>
                            <span className={`text-lg font-bold tracking-tight ${isSelected ? 'text-primary' : 'text-gray-500'}`}>{pct}%</span>
                         </div>
                         <div className="h-2 bg-gray-50 rounded-full overflow-hidden border border-gray-100 p-0.5">
                            <div 
                              className={`h-full rounded-full transition-all duration-[1.5s] ease-out ${isSelected ? 'bg-primary shadow-sm' : 'bg-gray-200'}`}
                              style={{ width: `${pct}%` }}
                            />
                         </div>
                         {opt.voters && opt.voters.length > 0 ? (
                           <div className="flex items-center gap-2 px-1 cursor-pointer group" onClick={() => setShowVotersSheet(true)}>
                              <div className="flex -space-x-1.5">
                                 {opt.voters.slice(0, 5).map((v, i) => (
                                   <img key={v.user_id} src={getSafeAvatarUrl(v.avatar_url)} className="w-5 h-5 rounded-full border border-white shadow-sm transition-transform group-hover:scale-110" style={{ zIndex: 10-i }} alt="" />
                                 ))}
                                 {opt.voters.length > 5 && (
                                   <div className="w-5 h-5 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-[8px] font-bold text-gray-400 z-0">+{opt.voters.length - 5}</div>
                                 )}
                              </div>
                              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest group-hover:text-primary transition-colors">See participants</span>
                           </div>
                         ) : null}
                      </div>
                    );
                  }

                  return (
                    <button
                      key={opt.option_id}
                      onClick={() => handleVote(opt.option_id)}
                      disabled={voting}
                      className="w-full p-5 rounded-2xl bg-gray-50/50 border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all text-left flex justify-between items-center group/btn"
                    >
                       <span className="text-sm font-bold text-gray-700">{opt.option_text}</span>
                       <div className="w-5 h-5 rounded-full border-2 border-gray-200 group-hover/btn:border-primary transition-colors flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-primary scale-0 group-hover/btn:scale-100 transition-transform duration-300" />
                       </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-10 pt-8 border-t border-gray-50 flex items-center justify-center gap-4">
                 <button 
                  onClick={() => { fetchFollowers(); setShowInviteSheet(true); }}
                  className="flex-1 h-12 bg-primary/5 text-primary rounded-xl font-bold uppercase tracking-wider text-[10px] hover:bg-primary/10 active:scale-95 transition-all flex items-center justify-center gap-2"
                 >
                   <UserPlus size={14} /> Invite
                 </button>
                 <button 
                  onClick={() => { navigator.clipboard.writeText(window.location.href); alert('Link copied!'); }}
                  className="flex-1 h-12 bg-gray-50 text-gray-500 rounded-xl font-bold uppercase tracking-wider text-[10px] hover:bg-gray-100 active:scale-95 transition-all flex items-center justify-center gap-2"
                 >
                   <ArrowLeft size={14} className="rotate-180" /> Share
                 </button>
              </div>
           </div>
           
           <div className="bg-white/50 backdrop-blur-xl border border-white p-6 rounded-3xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-sm text-primary">
                    <Users size={20} />
                 </div>
                 <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Global Participation</p>
                    <p className="text-sm font-black text-gray-900 uppercase italic">{poll.total_votes && poll.total_votes > 0 ? `${poll.total_votes} nodes synchronized` : 'Awaiting synchronization'}</p>
                 </div>
              </div>
              <button onClick={() => setShowVotersSheet(true)} className="px-5 py-3 bg-white rounded-xl text-[10px] font-black uppercase tracking-widest border border-gray-100 shadow-sm hover:text-primary transition-colors">See Details</button>
           </div>
        </div>
      </main>

      {/* Participants Sheet */}
      {showVotersSheet && poll && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center animate-fade-in">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowVotersSheet(false)} />
          <div className="relative w-full max-w-xl bg-white rounded-t-[32px] max-h-[85vh] flex flex-col overflow-hidden animate-slide-up shadow-2xl">
             <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-gray-900 uppercase italic">Participants</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{poll.total_votes && poll.total_votes > 0 ? `${poll.total_votes} total votes` : 'No votes recorded'}</p>
                </div>
                <button onClick={() => setShowVotersSheet(false)} className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={24} strokeWidth={3} />
                </button>
             </div>
             <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar pb-20">
                {poll.options?.map(opt => (
                  <div key={opt.option_id} className="space-y-4">
                    <div className="flex items-center gap-3">
                       <div className="h-6 w-1 bg-primary rounded-full" />
                       <h4 className="text-[11px] font-black uppercase tracking-widest text-gray-500">{opt.option_text} {opt.voters.length > 0 ? `(${opt.voters.length})` : ''}</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                       {opt.voters.map(voter => (
                         <div key={voter.user_id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/50 hover:bg-gray-100/80 transition-colors group">
                            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(`/profile/${voter.username}`)}>
                               <img src={getSafeAvatarUrl(voter.avatar_url)} className="w-8 h-8 rounded-full object-cover border border-white shadow-sm" alt="" />
                               <div>
                                  <p className="text-[12px] font-bold text-gray-900 leading-none mb-0.5">{voter.name}</p>
                                  <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">@{voter.username}</p>
                               </div>
                            </div>
                            {currentUser?.user_id !== voter.user_id && (
                              <button 
                                onClick={() => handleFollow(voter.user_id, voter.is_following)}
                                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${voter.is_following ? 'bg-white border border-gray-200 text-gray-400' : 'bg-primary text-white shadow-md shadow-primary/10 hover:scale-105'}`}
                              >
                                {voter.is_following ? <UserCheck size={12} /> : 'Follow'}
                              </button>
                            )}
                         </div>
                       ))}
                    </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* Invite Sheet */}
      {showInviteSheet && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center animate-fade-in">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowInviteSheet(false)} />
          <div className="relative w-full max-w-xl bg-white rounded-t-[40px] max-h-[75vh] flex flex-col overflow-hidden animate-slide-up shadow-2xl">
             <div className="p-8 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-gray-900 uppercase italic">Invite Friends</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select nodes to notify</p>
                </div>
                <button onClick={() => setShowInviteSheet(false)} className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={24} strokeWidth={3} />
                </button>
             </div>
             <div className="flex-1 overflow-y-auto p-6 space-y-3 no-scrollbar pb-10">
                {followers.map(f => {
                  const isInvited = invitedUsers.includes(f.user_id);
                  return (
                    <div key={f.user_id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50/50 hover:bg-gray-100/80 transition-all group">
                       <div className="flex items-center gap-3">
                          <img src={getSafeAvatarUrl(f.avatar_url)} className="w-9 h-9 rounded-full object-cover border border-white shadow-sm" alt="" />
                          <div>
                             <p className="text-[13px] font-bold text-gray-900 leading-none mb-0.5">{f.name}</p>
                             <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">@{f.username}</p>
                          </div>
                       </div>
                       <button 
                         onClick={async () => {
                           if (isInvited) return;
                           try {
                             await api.post(`/polls/${id}/invite`, { user_ids: [f.user_id] });
                             setInvitedUsers(prev => [...prev, f.user_id]);
                           } catch (err) { console.error(err); }
                         }}
                         className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${isInvited ? 'bg-emerald-500 text-white cursor-default' : 'bg-primary text-white shadow-md shadow-primary/10 hover:scale-105'}`}
                       >
                         {isInvited ? <UserCheck size={12} /> : 'Invite'}
                       </button>
                    </div>
                  );
                })}
             </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
