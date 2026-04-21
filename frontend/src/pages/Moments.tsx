import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Heart, MessageCircle, Share2, Bookmark, BookmarkCheck, 
  MoreHorizontal, Play, Send, X, ArrowLeft,
  Volume2, VolumeX, Loader2
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
  is_liked?: boolean;
  is_saved?: boolean;
  is_following?: boolean;
}

const CommentItem = ({ comment, onLike }: { comment: Comment; onLike: (id: string) => void }) => {
  return (
    <div className="flex gap-3 mb-4 last:mb-0 group">
      <img 
        src={comment.avatar_url || '/uploads/avatars/default.png'} 
        className="w-8 h-8 rounded-full object-cover border border-white/10" 
        alt={comment.username}
      />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-bold text-white/90">@{comment.username}</span>
          <span className="text-[10px] text-white/40">
            {new Date(comment.created_at).toLocaleDateString()}
          </span>
        </div>
        <p className="text-sm text-white/80 leading-relaxed">{comment.content}</p>
        <div className="flex items-center gap-4 mt-2">
          <button 
            className={clsx("flex items-center gap-1 text-[10px] font-bold transition-colors", comment.is_liked ? "text-pink-500" : "text-white/40 hover:text-white/60")}
            onClick={() => onLike(comment.comment_id)}
          >
            {comment.is_liked ? "Liked" : "Like"}
          </button>
          <button className="text-[10px] font-bold text-white/40 hover:text-white/60">Reply</button>
        </div>
      </div>
      <button className="opacity-0 group-hover:opacity-100 transition-opacity">
        <Heart size={12} className={comment.is_liked ? "fill-pink-500 stroke-pink-500" : "stroke-white/40"} />
      </button>
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
  const containerRef = useRef<HTMLDivElement>(null);
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
        videoRef.current.play().then(() => setPlaying(true)).catch(e => console.log('Play blocked', e));
      }
    }
  };

  const handleDoubleTap = () => {
    if (!moment.is_liked) onLike(moment.moment_id);
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
  };

  const shareReel = () => {
    const url = `${window.location.origin}/moments/${moment.moment_id}`;
    if (navigator.share) {
      navigator.share({ title: 'Sparkle Moment', url }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
    api.post(`/moments/${moment.moment_id}/share`).catch(() => {});
  };

  const mediaSrc = moment.video_url || moment.media_url;
  const isVideo = moment.is_video || !!moment.video_url || !!mediaSrc?.match(/\.(mp4|webm|ogg)$/i);

  return (
    <div className="reel-container" ref={containerRef} onDoubleClick={handleDoubleTap}>
      <div className="reel-video-wrapper" onClick={togglePlay}>
        {isVideo ? (
          <video 
            ref={videoRef}
            src={mediaSrc} 
            poster={moment.thumbnail_url}
            loop
            muted={muted}
            playsInline
            className="reel-media"
          />
        ) : (
          <img 
            src={mediaSrc || moment.thumbnail_url} 
            alt="Moment" 
            className="reel-media"
          />
        )}
        
        <AnimatePresence>
          {showHeart && (
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.5, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              className="absolute pointer-events-none z-50"
            >
              <Heart size={100} fill="white" color="white" className="drop-shadow-2xl" />
            </motion.div>
          )}
        </AnimatePresence>

        {!playing && isVideo && (
          <div className="reel-play-overlay">
            <Play size={48} fill="white" className="opacity-80" />
          </div>
        )}
      </div>

      {/* Side Actions Overlay */}
      <div className="reel-sidebar">
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            <img 
              src={moment.avatar_url || '/uploads/avatars/default.png'} 
              className="w-12 h-12 rounded-full border-2 border-white object-cover cursor-pointer hover:scale-105 transition-transform" 
              alt={moment.username}
              onClick={() => navigate(`/profile/${moment.username}`)}
            />
            {!moment.is_following && (
              <button 
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center text-white text-xs border-2 border-black"
                onClick={(e) => { e.stopPropagation(); /* TODO: Follow */ }}
              >
                +
              </button>
            )}
          </div>
        </div>

        <button className="reel-action-btn group" onClick={() => onLike(moment.moment_id)}>
          <div className={clsx("p-2 rounded-full bg-white/10 backdrop-blur-md mb-1 transition-all group-hover:scale-110", moment.is_liked && "bg-pink-500/20")}>
            <Heart size={28} fill={moment.is_liked ? '#FF3D6D' : 'none'} color={moment.is_liked ? '#FF3D6D' : 'white'} />
          </div>
          <span>{moment.like_count || 0}</span>
        </button>

        <button className="reel-action-btn group" onClick={() => onOpenComments(moment.moment_id)}>
          <div className="p-2 rounded-full bg-white/10 backdrop-blur-md mb-1 transition-all group-hover:scale-110">
            <MessageCircle size={28} color="white" />
          </div>
          <span>{moment.comment_count || 0}</span>
        </button>

        <button className="reel-action-btn group" onClick={() => onSave(moment.moment_id)}>
          <div className={clsx("p-2 rounded-full bg-white/10 backdrop-blur-md mb-1 transition-all group-hover:scale-110", moment.is_saved && "bg-yellow-500/20")}>
            {moment.is_saved ? (
              <BookmarkCheck size={28} fill="#FACC15" color="#FACC15" />
            ) : (
              <Bookmark size={28} color="white" />
            )}
          </div>
          <span>Save</span>
        </button>

        <button className="reel-action-btn group" onClick={shareReel}>
          <div className="p-2 rounded-full bg-white/10 backdrop-blur-md mb-1 transition-all group-hover:scale-110">
            <Share2 size={24} color="white" />
          </div>
          <span>Share</span>
        </button>

        <button className="reel-action-btn group">
          <div className="p-2 rounded-full bg-white/10 backdrop-blur-md transition-all group-hover:scale-110">
            <MoreHorizontal size={24} color="white" />
          </div>
        </button>
        
        <button className="reel-action-btn group mt-auto" onClick={() => setMuted(!muted)}>
          <div className="p-2 rounded-full bg-white/10 backdrop-blur-md transition-all">
            {muted ? <VolumeX size={20} color="white" /> : <Volume2 size={20} color="white" />}
          </div>
        </button>
      </div>

      {/* Bottom Info Overlay */}
      <div className="reel-bottom-info">
        <div className="flex items-center gap-2 mb-2">
          <h3 
            className="text-base font-extrabold text-white cursor-pointer hover:underline"
            onClick={() => navigate(`/profile/${moment.username}`)}
          >
            @{moment.username}
          </h3>
          <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full text-white font-bold backdrop-blur-md uppercase tracking-wider">Original</span>
          <span className="text-[10px] text-white/60 font-medium ml-auto flex items-center gap-1">
             <Play size={10} fill="currentColor" /> {moment.view_count || 0}
          </span>
        </div>
        {moment.caption && (
          <p className="text-sm text-white/90 leading-tight line-clamp-2 pr-12 drop-shadow-lg">
            {moment.caption}
          </p>
        )}
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
      
      // If we are at a specific moment but it's not in the stream, fetch it separately
      if (id && !data.find((m: Moment) => m.moment_id === id)) {
        try {
          const detailRes = await api.get(`/moments/${id}`);
          const single = detailRes.data.moment || detailRes.data;
          if (single) data = [single, ...data];
        } catch (e) { console.error('Error fetching deep-link moment', e); }
      }

      setMoments(data);
    } catch (err) {
      console.error('Moments fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchMoments(); }, [fetchMoments]);

  const scrollToIndex = useCallback((index: number) => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const target = container.children[index] as HTMLElement;
      if (target) {
        container.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
      }
    }
  }, []);

  useEffect(() => {
    if (id && moments.length > 0) {
      const idx = moments.findIndex(m => m.moment_id === id);
      if (idx !== -1) {
        setActiveIndex(idx);
        scrollToIndex(idx);
      }
    }
  }, [id, moments, scrollToIndex]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    const height = e.currentTarget.clientHeight;
    const index = Math.round(scrollTop / height);
    if (index !== activeIndex && index >= 0 && index < moments.length) {
      setActiveIndex(index);
      // Update URL without reloading
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
      
      // Update count in main list
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
     <div className="moments-universe">
       <Navbar />
       
       <div 
        ref={scrollRef}
        className="reels-scroller" 
        onScroll={handleScroll}
       >
         {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-white/50 bg-[#0a0a0a]">
               <Loader2 className="w-12 h-12 animate-spin mb-4 text-pink-500" />
               <p className="font-bold tracking-widest uppercase text-sm">Synchronizing Stream</p>
            </div>
         ) : moments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/50 bg-[#0a0a0a]">
                <ArrowLeft className="w-12 h-12 mb-4 text-white/20" />
                <h2 className="text-2xl font-black text-white mb-2">The Silence of Space</h2>
                <p>No moments found in your orbit.</p>
                <button 
                  onClick={() => navigate('/create')} 
                  className="mt-6 px-8 py-3 bg-white text-black font-black rounded-full hover:scale-105 transition-transform"
                >
                  Post First Moment
                </button>
            </div>
         ) : (
            moments.map((m, idx) => (
              <div key={m.moment_id} className="reels-page-item">
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

       {/* Comments Panel */}
       <AnimatePresence>
         {showComments && (
           <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="comments-backdrop"
                onClick={() => setShowComments(false)}
              />
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="comments-panel"
              >
                <div className="comments-header">
                  <span className="text-sm font-black uppercase tracking-wider">Comments</span>
                  <button onClick={() => setShowComments(false)} className="p-1 hover:bg-white/10 rounded-full">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="comments-list">
                  {comments.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-40">
                      <MessageCircle size={40} className="mb-2" />
                      <p className="text-sm font-bold">No thoughts shared yet.</p>
                      <p className="text-xs">Be the first to speak!</p>
                    </div>
                  ) : (
                    comments.map(c => <CommentItem key={c.comment_id} comment={c} onLike={() => {}} />)
                  )}
                </div>

                <form className="comments-input-area" onSubmit={handleAddComment}>
                  <input 
                    type="text" 
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    disabled={submittingComment}
                    className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-pink-500/50"
                  />
                  <button 
                    disabled={!newComment.trim() || submittingComment}
                    className="p-2 text-pink-500 disabled:text-white/20 transition-colors"
                  >
                    {submittingComment ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                  </button>
                </form>
              </motion.div>
           </>
         )}
       </AnimatePresence>

       <style>{`
        .moments-universe { 
          position: fixed; 
          inset: 0; 
          display: flex; 
          background: #000; 
          color: white; 
          overflow: hidden; 
          font-family: 'Inter', sans-serif;
        }
        
        .reels-scroller { 
          flex: 1; 
          height: 100vh; 
          overflow-y: scroll; 
          scroll-snap-type: y mandatory; 
          scroll-behavior: smooth; 
          background: #000;
        }
        .reels-scroller::-webkit-scrollbar { display: none; }
        
        .reels-page-item { 
          height: 100vh; 
          width: 100%; 
          scroll-snap-align: start; 
          scroll-snap-stop: always; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          position: relative;
        }
        
        .reel-container { 
          position: relative; 
          width: 100%; 
          height: 100%; 
          max-width: 500px;
          margin: 0 auto;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        
        @media (min-width: 600px) { 
          .reel-container { 
            height: calc(100vh - 40px); 
            margin: 20px auto; 
            border-radius: 20px;
            box-shadow: 0 0 50px rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.05);
          } 
        }
        
        .reel-video-wrapper { 
          position: absolute; 
          inset: 0; 
          width: 100%; 
          height: 100%; 
          cursor: pointer; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          background: #000; 
        }
        .reel-media { 
          width: 100%; 
          height: 100%; 
          object-fit: cover; 
          transition: transform 0.3s ease;
        }
        .reel-play-overlay { 
          position: absolute; 
          background: rgba(0,0,0,0.4); 
          border-radius: 50%; 
          padding: 24px; 
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.1);
        }

        .reel-sidebar { 
          position: absolute; 
          bottom: 120px; 
          right: 12px; 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          gap: 12px; 
          z-index: 10; 
        }
        .reel-action-btn { 
          display: flex; 
          flex-direction: column; 
          align-items: center; 
          color: white; 
          font-size: 11px; 
          font-weight: 800; 
          padding: 0;
          border: none;
          background: none;
          cursor: pointer;
        }

        .reel-bottom-info { 
          position: absolute; 
          bottom: 0; 
          left: 0; 
          right: 0; 
          padding: 60px 16px 24px; 
          background: linear-gradient(0deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 40%, transparent 100%); 
          z-index: 9; 
        }

        /* Comments Panel Styles */
        .comments-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          z-index: 100;
        }
        .comments-panel {
          position: fixed;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 100%;
          max-width: 500px;
          height: 60vh;
          background: rgba(20,20,20,0.85);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px 24px 0 0;
          z-index: 101;
          display: flex;
          flex-direction: column;
          box-shadow: 0 -20px 40px rgba(0,0,0,0.5);
        }
        .comments-header {
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .comments-list {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }
        .comments-input-area {
          padding: 16px 20px;
          border-top: 1px solid rgba(255,255,255,0.05);
          display: flex;
          gap: 12px;
          align-items: center;
        }

        @media (max-width: 600px) {
          .reels-scroller { padding-bottom: 74px; }
          .reel-bottom-info { bottom: 74px; margin-bottom: 16px; font-size: 0.9em; }
          .reel-sidebar { bottom: 180px; right: 10px; }
          .comments-panel { height: 75vh; }
        }
       `}</style>
     </div>
  );
}
