import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Heart, MessageCircle, Share2, BookmarkCheck, 
  Play, Send, X,
  Volume2, VolumeX, Loader2, Sparkles, Orbit
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import api from '../api/api';
import clsx from 'clsx';

interface Comment {
  comment_id: string;
  username: string;
  avatar_url?: string;
  content: string;
  created_at: string;
  is_liked?: boolean;
  replies?: Comment[];
}

interface Moment {
  moment_id: string;
  username: string;
  user_name?: string;
  caption?: string;
  avatar_url?: string;
  thumbnail_url?: string;
  media_url?: string;
  video_url?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
  created_at: string;
  is_video?: boolean;
  media_type?: string;
  is_liked?: boolean;
  is_saved?: boolean;
  is_following?: boolean;
}

const CommentItem = ({ comment, onLike }: { comment: Comment; onLike: (id: string) => void }) => {
  return (
    <div className="flex gap-4 mb-6 group animate-fade-in">
      <img 
        src={comment.avatar_url || '/uploads/avatars/default.png'} 
        className="w-10 h-10 rounded-2xl object-cover border border-white shadow-sm" 
        alt={comment.username}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-black italic">@{comment.username}</span>
            <span className="text-[10px] font-bold text-black/20 uppercase tracking-widest">
              {new Date(comment.created_at).toLocaleDateString()}
            </span>
          </div>
          <button className="text-black/10 hover:text-primary transition-colors" onClick={() => onLike(comment.comment_id)}>
            <Heart size={14} className={comment.is_liked ? "fill-primary stroke-primary" : ""} />
          </button>
        </div>
        <p className="text-sm text-black font-medium leading-relaxed">{comment.content}</p>
        <div className="flex items-center gap-4 mt-2">
          <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">Reply</button>
        </div>
      </div>
    </div>
  );
};

const ReelItem = ({ 
  moment, 
  onLike, 
  onSave,
  onOpenComments,
  active
}: { 
  moment: Moment; 
  onLike: (id: string) => void; 
  onSave: (id: string) => void;
  onOpenComments: (id: string) => void;
  active: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showHeart, setShowHeart] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (active && videoRef.current) {
      videoRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else if (videoRef.current) {
      videoRef.current.pause();
      setPlaying(false);
    }
  }, [active]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
        setPlaying(false);
      } else {
        videoRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      }
    }
  };

  const handleDoubleTap = () => {
    if (!moment.is_liked) onLike(moment.moment_id);
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
  };

  const mediaSrc = moment.video_url || moment.media_url;
  const isVideo = moment.is_video || moment.media_type === 'video' || !!moment.video_url || !!mediaSrc?.match(/\.(mp4|webm|ogg|quicktime|mov)$/i);

  return (
    <div className="relative w-full h-full max-w-[480px] mx-auto bg-black rounded-none md:rounded-[48px] overflow-hidden shadow-2xl transition-all duration-700 active:scale-95 group" onDoubleClick={handleDoubleTap}>
      <div className="absolute inset-0 cursor-pointer" onClick={togglePlay}>
        {/* Background Blur Layer */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {isVideo ? (
            <video 
              src={mediaSrc} 
              loop
              muted
              playsInline
              className="w-full h-full object-cover scale-150 blur-3xl opacity-40"
            />
          ) : (
            <img 
              src={mediaSrc || moment.thumbnail_url} 
              className="w-full h-full object-cover scale-150 blur-3xl opacity-40"
              alt=""
            />
          )}
        </div>

        {/* Primary Content Layer */}
        <div className="relative w-full h-full flex items-center justify-center z-10">
          {isVideo ? (
            <video 
              ref={videoRef}
              src={mediaSrc} 
              poster={moment.thumbnail_url}
              loop
              muted={muted}
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <img 
              src={mediaSrc || moment.thumbnail_url} 
              alt="Moment" 
              className="w-full h-full object-contain"
            />
          )}
        </div>
        
        {/* Overlays */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

        <AnimatePresence>
          {showHeart && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.5, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 text-white"
            >
              <Heart size={100} fill="currentColor" strokeWidth={0} />
            </motion.div>
          )}
        </AnimatePresence>

        {!playing && isVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
            <Play size={64} fill="white" className="opacity-60 drop-shadow-2xl" />
          </div>
        )}
      </div>

      {/* Side Actions (Pink Soft Styling) */}
      <div className="absolute right-4 bottom-32 flex flex-col items-center gap-6 z-20">
        <div className="relative mb-4 group/avatar">
          <img 
            src={moment.avatar_url || '/uploads/avatars/default.png'} 
            className="w-14 h-14 rounded-[22px] border-2 border-white object-cover cursor-pointer shadow-xl transition-all group-hover/avatar:scale-110" 
            alt=""
            onClick={() => navigate(`/profile/${moment.username}`)}
          />
          {!moment.is_following && (
            <button className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs border-2 border-black font-black shadow-lg shadow-primary/20 hover:scale-125 transition-transform">+</button>
          )}
        </div>

        <button className="flex flex-col items-center gap-1 group/btn" onClick={() => onLike(moment.moment_id)}>
          <div className={clsx("w-14 h-14 rounded-[18px] backdrop-blur-xl flex items-center justify-center transition-all group-hover/btn:scale-110 shadow-lg border", moment.is_liked ? "bg-primary border-primary text-white" : "bg-white/20 border-white/20 text-white hover:bg-white/40")}>
            <Heart size={28} fill={moment.is_liked ? "currentColor" : "none"} strokeWidth={3} />
          </div>
          <span className="text-[10px] font-black text-white uppercase tracking-widest drop-shadow-md">{moment.like_count || 0}</span>
        </button>

        <button className="flex flex-col items-center gap-1 group/btn" onClick={() => onOpenComments(moment.moment_id)}>
          <div className="w-14 h-14 rounded-[18px] bg-white/20 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white transition-all group-hover/btn:scale-110 shadow-lg hover:bg-white/40">
            <MessageCircle size={28} strokeWidth={3} />
          </div>
          <span className="text-[10px] font-black text-white uppercase tracking-widest drop-shadow-md">{moment.comment_count || 0}</span>
        </button>

        <button className="flex flex-col items-center gap-1 group/btn" onClick={() => onSave(moment.moment_id)}>
          <div className={clsx("w-14 h-14 rounded-[18px] backdrop-blur-xl flex items-center justify-center transition-all group-hover/btn:scale-110 shadow-lg border", moment.is_saved ? "bg-amber-400 border-amber-400 text-white" : "bg-white/20 border-white/20 text-white hover:bg-white/40")}>
            <BookmarkCheck size={28} fill={moment.is_saved ? "currentColor" : "none"} strokeWidth={3} />
          </div>
          <span className="text-[10px] font-black text-white uppercase tracking-widest drop-shadow-md">{moment.is_saved ? 'Saved' : 'Save'}</span>
        </button>

        <button className="w-14 h-14 rounded-[18px] bg-white/20 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white transition-all hover:bg-white/40 mb-4 shadow-lg group-hover:scale-110">
          <Share2 size={24} strokeWidth={3} />
        </button>

        <button className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white transition-all" onClick={() => setMuted(!muted)}>
          {muted ? <VolumeX size={18} strokeWidth={3} /> : <Volume2 size={18} strokeWidth={3} />}
        </button>
      </div>

      {/* Info Overlay */}
      <div className="absolute inset-x-0 bottom-0 p-8 pb-10 z-10 flex flex-col gap-3 pointer-events-none">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-black text-white italic tracking-tight pointer-events-auto cursor-pointer flex items-center gap-2" onClick={() => navigate(`/profile/${moment.username}`)}>
            @{moment.username}
            <Sparkles size={16} className="text-primary fill-primary" />
          </h3>
          <span className="text-[9px] font-black uppercase tracking-widest bg-white/20 backdrop-blur-md text-white px-3 py-1 rounded-full border border-white/20">Original Energy</span>
        </div>
        {moment.caption && (
          <p className="text-base font-bold text-white/90 leading-tight drop-shadow-lg pr-20 line-clamp-3 italic">
            {moment.caption}
          </p>
        )}
        <div className="flex items-center gap-2 mt-2 opacity-50 px-1">
           <Orbit size={14} className="animate-spin-slow text-white" />
           <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{moment.view_count || 0} signals in orbit</span>
        </div>
      </div>
    </div>
  );
};

export default function Moments() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [activeMomentId, setActiveMomentId] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMoments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/moments/stream');
      let data = res.data.moments || res.data || [];
      
      if (id && !data.find((m: Moment) => m.moment_id === id)) {
        try {
          const detailRes = await api.get(`/moments/${id}`);
          const single = detailRes.data.moment || detailRes.data;
          if (single) data = [single, ...data];
        } catch (e) { console.error('Error fetching moment', e); }
      }

      setMoments(data);
    } catch (err) {
      console.error('Moments fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchMoments(); }, [fetchMoments]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    const height = e.currentTarget.clientHeight;
    const index = Math.round(scrollTop / height);
    if (index !== activeIndex && index >= 0 && index < moments.length) {
      setActiveIndex(index);
      const currentId = moments[index].moment_id;
      window.history.replaceState(null, '', `/moments/${currentId}`);
    }
  };

  const handleLike = async (momentId: string) => {
    const idx = moments.findIndex(m => m.moment_id === momentId);
    if (idx === -1) return;
    const m = moments[idx];
    const wasLiked = m.is_liked;
    
    setMoments(prev => prev.map(item => item.moment_id === momentId ? {
      ...item, is_liked: !wasLiked, like_count: (item.like_count || 0) + (wasLiked ? -1 : 1)
    } : item));
    
    try {
      await api.post(`/moments/${momentId}/spark`);
    } catch {
      setMoments(prev => prev.map(item => item.moment_id === momentId ? {
        ...item, is_liked: wasLiked, like_count: (item.like_count || 0) + (wasLiked ? 1 : -1)
      } : item));
    }
  };

  const handleSave = async (momentId: string) => {
    const idx = moments.findIndex(m => m.moment_id === momentId);
    if (idx === -1) return;
    const m = moments[idx];
    const wasSaved = m.is_saved;
    
    setMoments(prev => prev.map(item => item.moment_id === momentId ? {
      ...item, is_saved: !wasSaved
    } : item));
    
    try {
      await api.post(`/moments/${momentId}/save`);
    } catch (err) {
       console.error('Save error', err);
    }
  };

  const openComments = async (momentId: string) => {
    setActiveMomentId(momentId);
    setShowComments(true);
    setComments([]);
    try {
      const res = await api.get(`/moments/${momentId}/comments`);
      setComments(res.data.comments || res.data || []);
    } catch (err) {
      console.error('Fetch comments error', err);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !activeMomentId || submittingComment) return;
    
    setSubmittingComment(true);
    try {
      const res = await api.post(`/moments/${activeMomentId}/comments`, { comment: newComment });
      const added = res.data.comment || res.data;
      setComments(prev => [added, ...prev]);
      setNewComment('');
      
      setMoments(prev => prev.map(m => m.moment_id === activeMomentId ? {
        ...m, comment_count: (m.comment_count || 0) + 1
      } : m));
    } catch (err) {
      console.error('Post comment error', err);
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#fdf2f4] flex flex-col font-sans overflow-hidden">
      <Navbar />
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar"
        onScroll={handleScroll}
      >
        {loading ? (
             <div className="h-screen flex flex-col items-center justify-center">
                <Orbit className="w-16 h-16 text-primary animate-spin-slow mb-6" />
                <p className="text-[11px] font-black text-black/20 uppercase tracking-[0.4em] italic animate-pulse">Synchronizing Stream</p>
             </div>
        ) : moments.length === 0 ? (
            <div className="h-screen flex flex-col items-center justify-center p-10 text-center animate-fade-in">
                <div className="w-32 h-32 bg-white/40 border-4 border-dashed border-white rounded-[48px] flex items-center justify-center mb-10 text-black/5 rotate-12">
                   <Play size={64} fill="currentColor" stroke="none" />
                </div>
                <h2 className="text-4xl font-black text-black mb-4 italic uppercase tracking-tighter">Quiet Frequency.</h2>
                <p className="text-[11px] font-bold text-black/20 uppercase tracking-widest max-w-[240px] mb-12">No signals captured on campus yet.</p>
                <button 
                  onClick={() => navigate('/dashboard')} 
                  className="px-10 py-5 bg-primary text-white font-black rounded-[20px] uppercase tracking-widest italic shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all text-sm"
                >
                  Return to Pulse
                </button>
            </div>
        ) : (
            moments.map((m, idx) => (
              <div key={m.moment_id} className="h-screen w-full snap-start flex items-center justify-center px-0 md:px-10 py-0 md:py-20 lg:ml-72 transition-all">
                <ReelItem 
                   active={idx === activeIndex}
                   moment={m} 
                   onLike={handleLike} 
                   onSave={handleSave}
                   onOpenComments={openComments}
                />
              </div>
            ))
        )}
      </div>

      {/* Comments Drawer (Pink Soft) */}
      <AnimatePresence>
        {showComments && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] bg-black/40 backdrop-blur-md"
              onClick={() => setShowComments(false)}
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 lg:left-72 right-0 h-[65vh] bg-white/95 backdrop-blur-3xl border-t border-white rounded-t-[48px] z-[1001] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-8 flex justify-between items-center bg-white/60 border-b border-black/5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black text-black italic">Channel Signals</span>
                  <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">{comments.length}</div>
                </div>
                <button onClick={() => setShowComments(false)} className="p-2 bg-black/5 rounded-2xl text-black/20 hover:text-black transition-all">
                  <X size={20} strokeWidth={4} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
                {comments.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                    <MessageCircle size={64} strokeWidth={1} className="mb-6" />
                    <p className="text-[12px] font-black uppercase tracking-widest italic">Signal is quiet...</p>
                  </div>
                ) : (
                  comments.map(c => <CommentItem key={c.comment_id} comment={c} onLike={() => {}} />)
                )}
              </div>

              <form className="p-8 bg-white/90 border-t border-black/5 flex gap-4 items-center" onSubmit={handleAddComment}>
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    placeholder="Transmit a signal..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="w-full h-14 bg-black/5 border border-transparent rounded-[20px] px-8 text-base font-bold placeholder:text-black/10 focus:bg-white focus:border-primary transition-all outline-none italic"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={!newComment.trim() || submittingComment}
                  className="w-14 h-14 bg-primary text-white rounded-[22px] flex items-center justify-center shadow-xl shadow-primary/20 active:scale-95 transition-all disabled:opacity-20"
                >
                  {submittingComment ? <Loader2 className="animate-spin" /> : <Send size={20} strokeWidth={3} />}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .animate-spin-slow { animation: spin 12s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
}
