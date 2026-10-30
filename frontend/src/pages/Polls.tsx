import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, Plus, ChevronRight, Calendar, Sparkles, Zap, Users, Trash2, Pencil } from 'lucide-react';
import PollModal from '../components/modals/PollModal';
import api from '../api/api';
import CountdownTimer from '../components/ui/CountdownTimer';
import { useUserStore } from '../store/userStore';
import { useModalStore } from '../store/modalStore';
import ModernOfflineState from '../components/ui/ModernOfflineState';
import { logger } from '../utils/logger';
import { showSuccess, showError } from '../utils/toast';

interface PollOption {
  option_id: string;
  option_text: string;
  vote_count: number;
}

interface Poll {
  poll_id: string;
  creator_id?: string;
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
  const [myPolls, setMyPolls] = useState<Poll[]>([]);
  const [loadingMyPolls, setLoadingMyPolls] = useState(true);
  const [busyPollId, setBusyPollId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('for_you');
  const [hasMore, setHasMore] = useState(true);
  const [isInitialLoad, setIsInitialBurst] = useState(true);
  const offsetRef = useRef(0);
  const inFlightRef = useRef(false);

  // Own polls are fetched independently of the browse feed. Depending on the
  // feed to contain them means a creator's own polls can vanish from the
  // section entirely once they scroll past the page those polls landed on.
  const loadMyPolls = useCallback(async () => {
    try {
      setLoadingMyPolls(true);
      const { data } = await api.get('/polls', { params: { creator: 'me', limit: 50 } });
      setMyPolls(Array.isArray(data.polls) ? data.polls : []);
    } catch (err) {
      logger.error('Failed to load own polls:', err);
    } finally {
      setLoadingMyPolls(false);
    }
  }, []);

  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);

  const takeDownPoll = async (pollId: string) => {
    setBusyPollId(pollId);
    const previous = myPolls;
    // Optimistic: the row leaves immediately. A failed takedown puts it back,
    // because the poll is still live.
    setMyPolls(prev => prev.filter(p => p.poll_id !== pollId));
    try {
      await api.delete(`/polls/${pollId}`);
      showSuccess('Poll taken down.');
    } catch (err: any) {
      logger.error('Poll takedown failed:', err);
      setMyPolls(previous);
      showError(err?.response?.data?.error || 'Could not take that poll down. It is still live.');
    } finally {
      setBusyPollId(null);
    }
  };

  const fetchPolls = useCallback(async (isLoadMore = false) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const currentOffset = isLoadMore ? offsetRef.current : 0;
      const currentLimit = (isLoadMore || !isInitialLoad) ? 10 : 2;

      const res = await api.get('/polls', {
        params: {
          filter,
          offset: currentOffset,
          limit: currentLimit
        }
      });

      const incomingPolls = res.data.polls || [];
      offsetRef.current = currentOffset + incomingPolls.length;

      setPolls(prev => {
        if (!isLoadMore) return incomingPolls;

        // Prevent duplicates
        const existingIds = new Set(prev.map(p => p.poll_id));
        const filtered = incomingPolls.filter((p: Poll) => !existingIds.has(p.poll_id));
        return [...prev, ...filtered];
      });

      setHasMore(res.data.hasMore);

      // Handle the initial burst transition
      if (isInitialLoad && !isLoadMore && res.data.hasMore && incomingPolls.length === 2) {
         setIsInitialBurst(false);
         // Small delay before fetching the rest to keep UI smooth
         setTimeout(() => fetchPolls(true), 400);
      }
    } catch (err) {
      logger.error('Fetch polls error:', err);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter, isInitialLoad]);

  useEffect(() => {
    setPolls([]);
    offsetRef.current = 0;
    setHasMore(true);
    setIsInitialBurst(true);
    fetchPolls(false);
  }, [filter]); // Clear list and re-fetch when filter changes

  useEffect(() => {
    loadMyPolls();
  }, [loadMyPolls]);

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
    <div className="flex bg-[#f8e7ed] dark:bg-zinc-900 min-h-dvh text-[#18181b] dark:text-zinc-100 overflow-x-hidden font-sans">

      <main className="flex-1 p-6 lg:p-12 relative z-10 max-w-[1400px] mx-auto w-full pb-[calc(6rem+env(safe-area-inset-bottom))]">

        {/* ── Header ── */}
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-5 mb-6 animate-fade-in">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f0e5ec] dark:bg-zinc-700 border border-[#e6d8e1] dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-semibold">
              <BarChart2 size={14} strokeWidth={2.5} className="text-primary" />
              <span>Polls</span>
            </div>
            <h1 className="text-3xl font-black text-[#18181b] dark:text-zinc-100 tracking-tight leading-none">
              Sparkle <span className="text-primary">Polls</span>
            </h1>
            <p className="text-[13px] text-slate-600 dark:text-zinc-400 leading-relaxed max-w-xl">
              Cast your vote and see what your campus thinks.
            </p>
          </div>

          <button
            onClick={() => setActiveModal('poll', fetchPolls)}
            className="w-full xl:w-auto h-11 px-5 bg-primary text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} strokeWidth={2.5} /> Create poll
          </button>
        </header>

        {/* Discovery Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mb-6 animate-fade-in pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-2 px-5 h-11 rounded-full text-[12px] font-bold transition-colors whitespace-nowrap border ${filter === tab.id ? 'bg-primary text-white border-primary' : 'bg-[#f0e5ec] dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 border-[#e6d8e1] dark:border-zinc-700 hover:text-[#18181b] dark:hover:text-zinc-100'}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div className="relative z-10">
          {loading && polls.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-64 bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-3xl p-8 space-y-6 relative overflow-hidden">
                  <div className="absolute inset-0 animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                   <div className="flex justify-between items-center">
                      <div className="w-24 h-4 bg-[#f6eef3] dark:bg-zinc-700 rounded-lg animate-pulse" />
                      <div className="w-16 h-4 bg-[#f6eef3] dark:bg-zinc-700 rounded-lg animate-pulse" />
                   </div>
                   <div className="w-full h-8 bg-[#f6eef3] dark:bg-zinc-700 rounded-xl animate-pulse" />
                   <div className="space-y-3">
                      <div className="w-full h-12 bg-[#f6eef3] dark:bg-zinc-700 rounded-2xl animate-pulse" />
                      <div className="w-full h-12 bg-[#f6eef3] dark:bg-zinc-700 rounded-2xl animate-pulse" />
                   </div>
                </div>
              ))}
            </div>
          ) : polls.length === 0 ? (
            <div className="py-20">
               <ModernOfflineState
                 type="empty"
                 title="No polls yet"
                 message="No active polls right now. Be the first to start one and see what your campus thinks!"
                 onRetry={() => fetchPolls(false)}
               />
            </div>
          ) : (
            <div className="pb-24">
              {/* My Polls — creator surface, takedown only */}
              {!loadingMyPolls && (() => {
                const mine = myPolls;
                if (mine.length === 0) return null;
                return (
                  <section className="mb-12">
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <BarChart2 size={14} strokeWidth={2.5} className="text-primary" />
                      <h3 className="text-sm font-bold text-[#18181b] dark:text-zinc-100">Your polls</h3>
                      <span className="text-xs text-slate-600 dark:text-zinc-400">{mine.length}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {mine.map((poll, idx) => {
                        const busy = busyPollId === poll.poll_id;
                        return (
                          <div
                            key={poll.poll_id}
                            onClick={() => navigate(`/polls/${poll.poll_id}`)}
                            className="group flex items-center gap-4 p-4 rounded-2xl bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 hover:border-primary transition-colors cursor-pointer shadow-sm animate-scale-in"
                            style={{ animationDelay: `${idx * 50}ms` }}
                          >
                            <BarChart2 size={16} strokeWidth={2.5} className="text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-[#18181b] dark:text-zinc-100 truncate">{poll.question}</p>
                              <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-0.5">
                                {poll.total_votes || 0} votes · {poll.is_expired ? 'Closed' : 'Open'}
                              </p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingPoll(poll); }}
                              aria-label={`Edit ${poll.question}`}
                              className="w-9 h-9 flex items-center justify-center rounded-full text-slate-600 dark:text-zinc-400 hover:text-primary hover:bg-[#f6eef3] dark:hover:bg-zinc-700 transition-colors shrink-0"
                            >
                              <Pencil size={16} strokeWidth={2.5} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); takeDownPoll(poll.poll_id); }}
                              disabled={busy}
                              aria-label={`Take down ${poll.question}`}
                              className="w-9 h-9 flex items-center justify-center rounded-full text-slate-600 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 transition-colors disabled:opacity-40 shrink-0"
                            >
                              <Trash2 size={16} strokeWidth={2.5} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })()}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {polls.map((poll, idx) => (
                <div
                  key={poll.poll_id}
                  onClick={() => navigate(`/polls/${poll.poll_id}`)}
                  className="group relative bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 p-6 rounded-2xl hover:border-primary transition-colors cursor-pointer shadow-sm animate-scale-in flex flex-col overflow-hidden"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                     <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f6eef3] dark:bg-zinc-900 rounded-full text-xs font-medium text-slate-600 dark:text-zinc-400">
                          <Calendar size={12} strokeWidth={2.5} className="text-primary" /> {new Date(poll.created_at).toLocaleDateString()}
                       </div>
                       {(poll.engagement_score ?? 0) > 10 ? (
                         <span className="bg-amber-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                            <BarChart2 size={10} /> Trending
                         </span>
                       ) : null}
                       {!!poll.is_ending_soon && !poll.is_expired ? (
                          <div className="px-2.5 py-1 bg-rose-500 text-white rounded-full text-[11px] font-bold flex items-center gap-1 animate-pulse">
                           Ending soon
                         </div>
                       ) : null}
                       {poll.expires_at && !poll.is_expired && (
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#f6eef3] dark:bg-zinc-900 rounded-full border border-[#e6d8e1] dark:border-zinc-700">
                            <CountdownTimer expiresAt={poll.expires_at} onEnd={() => fetchPolls(false)} className="!bg-transparent !border-none !p-0 text-rose-500 font-semibold text-xs" />
                          </div>
                        )}
                     </div>
                     <div className="px-3 py-1.5 bg-[#f0e5ec] dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-full text-xs font-semibold">
                        {poll.total_votes && poll.total_votes > 0 ? `${poll.total_votes} votes` : 'No votes yet'}
                     </div>
                  </div>

                  <h3 className="text-base font-bold text-[#18181b] dark:text-zinc-100 mb-4 group-hover:text-primary transition-colors leading-snug">
                     {poll.question}
                  </h3>

                  <div className="flex items-center gap-2 mb-6 text-xs text-slate-600 dark:text-zinc-400">
                     {!poll.is_anonymous && (
                       <img src={poll.creator_avatar || '/uploads/avatars/no-profile.png'} className="w-4 h-4 rounded-full" alt="" />
                     )}
                     {poll.is_anonymous && (
                       <div className="w-4 h-4 rounded-full bg-[#f6eef3] dark:bg-zinc-900 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-zinc-400">?</div>
                     )}
                     <span>By <span className="text-[#18181b] dark:text-zinc-100">{poll.is_anonymous ? 'Anonymous' : (poll.creator_name || `@${poll.username}`)}</span></span>
                     <span className="w-1 h-1 rounded-full bg-[#e6d8e1] dark:bg-zinc-600" />
                     <span className="text-primary">{poll.campus || 'All campuses'}</span>
                  </div>

                  {poll.friends_participating && poll.friends_participating.length > 0 ? (
                    <div className="mb-6 flex items-center gap-2 animate-fade-in">
                       <div className="flex -space-x-2">
                          {poll.friends_participating.map((f: any, i: number) => (
                            <img key={i} src={f.avatar_url} className="w-6 h-6 rounded-full border-2 border-[#fdf8fa] dark:border-zinc-800" alt="" />
                          ))}
                       </div>
                       <p className="text-xs text-slate-600 dark:text-zinc-400">
                         {poll.friends_participating.length === 1
                           ? `@${poll.friends_participating[0].username} voted`
                           : `Friends are voting`}
                       </p>
                     </div>
                  ) : null}

                  <div className="space-y-4 flex-1">
                  {poll.options && poll.options.slice(0, 2).map(opt => {
                    const pct = poll.total_votes && poll.total_votes > 0 ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;
                    return (
                      <div key={opt.option_id} className="space-y-2">
                        <div className="flex justify-between font-bold text-[13px] text-[#18181b] dark:text-zinc-300">
                           <span className="truncate pr-2">{opt.option_text}</span>
                           <span className={pct > 0 ? 'text-[#ff1493]' : 'text-slate-600 dark:text-zinc-400'}>{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-[#f6eef3] dark:bg-zinc-900 rounded-full overflow-hidden">
                           <div className="h-full bg-[#ff1493] rounded-full transition-all duration-500 ease-out" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#ede3e9] dark:border-zinc-900 flex items-center justify-between text-slate-600 dark:text-zinc-400 group-hover:text-primary transition-colors">
                     <p className="text-xs font-bold">{poll.is_expired ? 'View results' : 'Join the conversation'}</p>
                     <ChevronRight size={18} strokeWidth={2.5} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}

              {loadingMore && (
                <div className="col-span-full grid grid-cols-1 md:grid-cols-2 gap-4 pb-10">
                   {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-48 bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-3xl p-6 relative overflow-hidden">
                       <div className="absolute inset-0 animate-shimmer" />
                       <div className="w-1/3 h-4 bg-[#f6eef3] dark:bg-zinc-700 rounded-full animate-pulse mb-4" />
                       <div className="w-full h-8 bg-[#f6eef3] dark:bg-zinc-700 rounded-xl animate-pulse" />
                       <div className="w-2/3 h-4 bg-[#f6eef3] dark:bg-zinc-700 rounded-full animate-pulse mt-4" />
                    </div>
                  ))}
                </div>
              )}

              {/* End of Feed Indicator */}
              {!hasMore && polls.length > 0 ? (
                <div className="col-span-full py-10 flex flex-col items-center gap-3">
                  <div className="w-12 h-1 bg-[#f0e5ec] dark:bg-zinc-700 rounded-full" />
                  <p className="text-xs font-semibold text-slate-600 dark:text-zinc-400">You've seen it all</p>
                </div>
              ) : null}
            </div>
            </div>
          )}
        </div>
      </main>

      {editingPoll && (
        <PollModal
          poll={editingPoll}
          onClose={() => setEditingPoll(null)}
          onSuccess={() => { setEditingPoll(null); loadMyPolls(); }}
        />
      )}
    </div>
  );
}



