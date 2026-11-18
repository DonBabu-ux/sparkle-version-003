import { showError, showSuccess } from '../utils/toast';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, Video, ArrowLeft, Radio, Award, AlertCircle } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import LockedLivePage from './LockedLivePage';
import Spinner from '../components/ui/Spinner';

export default function Streams() {
  const navigate = useNavigate();
  const user = useUserStore(state => state.user);
  const [followers, setFollowers] = useState(() => user?.followers_count ?? 0);
  // followers_count is not part of the login payload and nothing hydrates it
  // into the store, so reading it straight off the user always gave 0 and every
  // user was shown the locked view. Fetch the authoritative record once.
  useEffect(() => {
    let cancelled = false;
    if (user?.followers_count !== undefined) { setFollowers(user.followers_count); return; }
    api.get('/users/me')
      .then(res => { if (!cancelled && res.data?.followers_count !== undefined) setFollowers(res.data.followers_count); })
      .catch(() => { /* leave the fallback in place; the locked view still explains the requirement */ });
    return () => { cancelled = true; };
  }, [user?.followers_count]);
  const [loading, setLoading] = useState(true);
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [liveTitle, setLiveTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [streams, setStreams] = useState<any[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [myStream, setMyStream] = useState<{ id: string; title: string } | null>(null);
  const [updateText, setUpdateText] = useState('');
  const [viewingStream, setViewingStream] = useState<any | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const loadStreams = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const { data } = await api.get('/streams');
      setStreams(Array.isArray(data) ? data : (data.streams || []));
    } catch (err) {
      // The catch only toasted and left streams as [], so a failed load rendered
      // the same "No active streams" empty state as a genuinely empty platform.
      setLoadError(true);
      showError('Could not load live streams.');
    } finally {
      setLoading(false);
    }
  };

  const goLive = async () => {
    const title = liveTitle.trim();
    if (!title) { showError('Give your live a title first.'); return; }
    setCreating(true);
    try {
      // Sparkle lives are text-update sessions (see /streams/:id/updates +
      // /streams/:id/end), not video capture: the backend owns the lifecycle
      // (create -> updates -> end) and the console below drives it.
      const { data } = await api.post('/streams', { title, description: title, category: 'live' });
      setMyStream({ id: data.stream_id, title });
      setGoLiveOpen(false);
      setLiveTitle('');
      showSuccess('You are live! Post updates from your console.');
      loadStreams();
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Could not start your live stream.');
    } finally {
      setCreating(false);
    }
  };

  const postUpdate = async () => {
    const content = updateText.trim();
    if (!content || !myStream) return;
    try {
      await api.post(`/streams/${myStream.id}/updates`, { content });
      setUpdateText('');
      showSuccess('Update posted');
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Could not post that update.');
    }
  };

  const endStream = async () => {
    if (!myStream) return;
    try {
      await api.post(`/streams/${myStream.id}/end`);
      showSuccess('Stream ended');
      setMyStream(null);
      loadStreams();
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Could not end the stream.');
    }
  };

  const openStream = async (stream: any) => {
    const id = stream.id || stream.stream_id;
    setViewingStream({ ...stream });
    setViewLoading(true);
    try {
      const { data } = await api.get(`/streams/${id}`);
      setViewingStream((prev: any) => (prev ? { ...prev, ...data } : data));
    } catch (err) {
      showError('Could not open this stream.');
      setViewingStream(null);
    } finally {
      setViewLoading(false);
    }
  };

  const toggleFollowStream = async () => {
    if (!viewingStream) return;
    try {
      await api.post(`/streams/${viewingStream.id}/follow`);
      setViewingStream((prev: any) => (prev ? { ...prev, is_following: true } : prev));
      showSuccess('Following this stream');
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Could not follow this stream.');
    }
  };


  // The artificial 800ms "premium transition" timer is gone. It cleared the
  // spinner on a fixed schedule regardless of the fetch, so a request slower
  // than 800ms (or a failed one) rendered the "No active streams" empty state
  // while data was still in flight. loading is now owned entirely by
  // loadStreams.
  useEffect(() => {
    loadStreams();
  }, []);

  // Poll the open stream so its update feed stays live.
  useEffect(() => {
    if (!viewingStream) return;
    const id = viewingStream.id;
    const timer = setInterval(async () => {
      try {
        const { data } = await api.get(`/streams/${id}`);
        setViewingStream((prev: any) => (prev && prev.id === id ? { ...prev, ...data } : prev));
      } catch {
        /* keep showing the last good snapshot */
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [viewingStream?.id]);

  // Background particles ambiance
  const particles = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 6 + 6,
    delay: Math.random() * 3
  }));

  if (loading) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-[#090514] via-[#0e0720] to-[#04020a] flex flex-col items-center justify-center text-white">
        <Spinner size="large" color="text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-[#ff4db8] mt-4 animate-pulse">
          Loading streams...
        </p>
      </div>
    );
  }

  // The follower threshold is the gate; the hardcoded email bypass is gone. It
  // let one personal address skip a check that applied to everyone else, which
  // also hid the fact that the gate was reading a permanently-zero count.
  const hasLiveAccess = followers >= 1000;

  // Render locked view if user does not meet the live access requirement
  if (!hasLiveAccess) {
    return <LockedLivePage />;
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#090514] via-[#0e0720] to-[#04020a] text-white overflow-hidden relative pb-24 font-sans selection:bg-[#ff008a]/20">
      
      {/* Background Ambient Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[350px] h-[350px] rounded-full bg-[#ff008a] opacity-15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-[#ff4db8] opacity-10 blur-[130px] pointer-events-none" />

      {/* Floating Particles */}
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-[#ff008a] opacity-35 pointer-events-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
          }}
          animate={{
            y: [0, -120],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#090514]/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')} 
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 hover:scale-[1.03] active:scale-95 transition-all"
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
          </button>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight" style={{ fontFamily: 'Outfit' }}>
              Live <span className="bg-gradient-to-r from-[#ff008a] via-[#ff4db8] to-[#ff66c4] bg-clip-text text-transparent">Streams</span>
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1 text-[10px] font-black text-[#ff4db8] uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff008a] animate-pulse" />
                On Air
              </span>
              <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-[9px] font-bold text-white/50">
                {streams.length} live now
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setGoLiveOpen(true)}
          className="bg-gradient-to-r from-[#ff008a] to-[#ff4db8] hover:from-[#ff4db8] hover:to-[#ff66c4] text-white px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-[#ff008a]/20 hover:shadow-[#ff008a]/40 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Video size={14} />
          <span>Go Live</span>
        </button>

        {/* Go Live composer — a live is a session, not a post */}
        {goLiveOpen && (
          <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
            <input
              autoFocus
              value={liveTitle}
              onChange={(e) => setLiveTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && goLive()}
              placeholder="What are you live about?"
              className="flex-1 bg-black/30 border border-white/10 rounded-xl py-2.5 px-4 text-sm font-medium text-white placeholder-white/40 outline-none focus:border-[#ff4db8]/50 transition-colors"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setGoLiveOpen(false); setLiveTitle(''); }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={goLive}
                disabled={creating}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ff008a] to-[#ff4db8] text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50 flex items-center gap-2 active:scale-95 transition-all"
              >
                {creating ? 'Starting...' : 'Go Live'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stream viewer */}
      {viewingStream && (
        <div className="fixed inset-0 z-[100] bg-[#04020a]/95 backdrop-blur-xl flex flex-col">
          <div className="max-w-2xl w-full mx-auto flex flex-col h-full">
            <div className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4 border-b border-white/10">
              <button
                onClick={() => setViewingStream(null)}
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-all"
                aria-label="Close stream"
              >
                <ArrowLeft size={16} strokeWidth={2.5} />
              </button>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-black text-white truncate">{viewingStream.title}</h2>
                <div className="flex items-center gap-2 text-[11px] text-white/50 font-bold">
                  <span>{viewingStream.username}</span>
                  <span className="flex items-center gap-1"><Eye size={11} /> {viewingStream.viewer_count || 0}</span>
                </div>
              </div>
              <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${viewingStream.status === 'live' ? 'bg-[#ff008a] text-white' : 'bg-white/10 text-white/50'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                {viewingStream.status === 'live' ? 'Live' : viewingStream.status || 'ended'}
              </span>
            </div>

            {viewingStream.description && (
              <p className="px-5 py-3 text-xs text-white/60 font-medium border-b border-white/5">{viewingStream.description}</p>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {viewLoading && (
                <div className="py-10 text-center text-xs font-bold text-white/40">Loading updates...</div>
              )}
              {!viewLoading && (viewingStream.updates || []).length === 0 && (
                <div className="py-10 text-center text-xs font-bold text-white/40">No updates yet. Follow to get the next ones.</div>
              )}
              {(viewingStream.updates || []).map((u: any) => (
                <div key={u.update_id} className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <p className="text-sm text-white/90 font-medium leading-relaxed">{u.content}</p>
                  <div className="mt-2 text-[10px] font-bold text-white/40">
                    {new Date(u.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t border-white/10">
              <button
                onClick={toggleFollowStream}
                disabled={viewingStream.is_following}
                className={`w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 ${viewingStream.is_following ? 'bg-white/5 border border-white/10 text-white/60' : 'bg-gradient-to-r from-[#ff008a] to-[#ff4db8] text-white'}`}
              >
                {viewingStream.is_following ? 'Following' : 'Follow stream'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-8 space-y-6 relative z-10">
        
        {/* Sparkle Live Welcome Hero Banner for Creators */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-[#ff008a]/10 to-[#ff4db8]/5 border border-white/10 rounded-[24px] p-6 flex items-center justify-between gap-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#ff4db8]">
              <Radio size={22} className="animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                Creator Console Unlocked
                <Award size={14} className="text-amber-400" />
              </h4>
              <p className="text-xs text-white/40 mt-1">
                You've successfully reached the 1,000 follower milestone! Share your live broadcast with the community now.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Your live console — shown once you are live */}
        {myStream && (
          <div className="bg-gradient-to-r from-[#ff008a]/15 to-[#ff4db8]/5 border border-[#ff008a]/30 rounded-[24px] p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex items-center gap-1.5 bg-[#ff008a] text-white px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Live
                </span>
                <h4 className="text-sm font-bold text-white truncate">{myStream.title}</h4>
              </div>
              <button
                onClick={endStream}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 text-xs font-bold uppercase tracking-wider hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-white transition-all shrink-0"
              >
                End stream
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                value={updateText}
                onChange={(e) => setUpdateText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && postUpdate()}
                placeholder="Post an update to your viewers..."
                className="flex-1 bg-black/30 border border-white/10 rounded-xl py-2.5 px-4 text-sm font-medium text-white placeholder-white/40 outline-none focus:border-[#ff4db8]/50 transition-colors"
              />
              <button
                onClick={postUpdate}
                disabled={!updateText.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#ff008a] to-[#ff4db8] text-white text-xs font-bold uppercase tracking-wider disabled:opacity-50 active:scale-95 transition-all"
              >
                Post update
              </button>
            </div>
          </div>
        )}

        {streams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {streams.map(stream => (
              <motion.div 
                key={stream.id} 
                whileHover={{ y: -4 }}
                className="bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-[24px] overflow-hidden flex flex-col hover:border-[#ff008a]/20 transition-all duration-300 cursor-pointer"
                onClick={() => openStream(stream)}
              >
                
                {/* Thumbnail Area */}
                <div className="relative h-48 overflow-hidden bg-slate-900 group">
                  <img src={stream.thumbnail_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={stream.title} />
                  
                  {/* Floating Tags */}
                  <div className="absolute top-3 left-3 bg-[#ff008a] text-white px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase shadow-md flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white dark:bg-zinc-800 animate-pulse" />
                    LIVE
                  </div>
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded text-[9px] font-bold tracking-wider flex items-center gap-1">
                    <Eye size={10} className="text-[#ff4db8]" /> 
                    {(stream.viewer_count ?? 0).toLocaleString()}
                  </div>
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-80" />
                </div>

                {/* Content Area */}
                <div className="p-5 flex-1 flex flex-col pt-0 transform -translate-y-5">
                  <div className="flex items-end gap-3 mb-4">
                    <img src={stream.avatar_url} className="w-12 h-12 rounded-xl border-4 border-[#120b22] shadow-lg object-cover bg-white dark:bg-zinc-800" alt="streamer" />
                    <div className="pb-1 min-w-0 flex-1">
                      <h3 className="font-bold text-white text-sm leading-tight truncate">{stream.title}</h3>
                      <div className="text-[10px] font-bold text-white/40 uppercase tracking-tight mt-0.5">@{stream.username}</div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                    <div className="text-[9px] font-black text-[#ff4db8] bg-[#ff008a]/10 border border-[#ff008a]/20 px-2 py-0.5 rounded uppercase tracking-wider">
                      {stream.category}
                    </div>
                    <div className="text-[9px] font-bold text-white/40 uppercase flex items-center gap-1">
                      Tune In <Video size={10} className="text-[#ff4db8]" />
                    </div>
                  </div>
                </div>

              </motion.div>
            ))}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-red-500/5 border border-red-500/10 rounded-3xl">
            <AlertCircle size={48} className="text-red-400 mb-4" />
            <h4 className="text-lg font-bold text-white mb-1">Couldn't load live streams</h4>
            <p className="text-white/45 text-xs max-w-sm leading-relaxed mb-4">
              This isn't the same as no one streaming — the request failed.
            </p>
            <button
              onClick={() => loadStreams()}
              className="px-4 py-2 rounded-full bg-[#ff008a] text-white text-xs font-bold"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white/[0.01] border border-white/5 border-dashed rounded-3xl">
             <Radio size={48} className="text-white/20 mb-4 animate-pulse" />
             <h4 className="text-lg font-bold text-white mb-1">No active streams</h4>
             <p className="text-white/45 text-xs max-w-sm leading-relaxed">
               No one is broadcasting right now. Be the first to start a stream and share your campus moments!
             </p>
          </div>
        )}
      </div>

    </div>
  );
}



