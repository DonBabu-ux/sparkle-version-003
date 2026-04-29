import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Heart, MessageCircle, Share2, BookmarkCheck, 
  Play, Send, X, Search, History,
  Volume2, VolumeX, Loader2, Sparkles, Orbit
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '../components/Navbar';
import MomentShareModal from '../components/modals/MomentShareModal';
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
    <div className="flex gap-3 mb-5 group animate-fade-in">
      <img 
        src={comment.avatar_url || '/uploads/avatars/default.png'} 
        className="w-8 h-8 rounded-full object-cover border border-gray-100 shadow-sm" 
        alt={comment.username}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-gray-900">@{comment.username}</span>
            <span className="text-[10px] font-medium text-gray-400">
              {new Date(comment.created_at).toLocaleDateString()}
            </span>
          </div>
          <button className="text-gray-300 hover:text-primary transition-colors" onClick={() => onLike(comment.comment_id)}>
            <Heart size={12} className={comment.is_liked ? "fill-primary stroke-primary" : ""} />
          </button>
        </div>
        <p className="text-[13px] text-gray-700 font-medium leading-normal">{comment.content}</p>
        <div className="flex items-center gap-4 mt-1">
          <button className="text-[10px] font-bold text-primary uppercase tracking-wider hover:underline">Reply</button>
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
  onShare,
  onOpenSearch,
  active,
  downloadProgress
}: { 
  moment: Moment; 
  onLike: (id: string) => void; 
  onSave: (id: string) => void; 
  onOpenComments: (id: string) => void;
  onShare: (moment: Moment) => void;
  onOpenSearch: () => void;
  active: boolean;
  downloadProgress?: number | null;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number; rotate: number }[]>([]);
  const [progress, setProgress] = useState(0);
  const navigate = useNavigate();
  const heartIdCounter = useRef(0);

  const viewTracked = useRef(false);

  useEffect(() => {
    if (active && videoRef.current && !userPaused) {
      videoRef.current.play().then(() => {
        setPlaying(true);
        if (!viewTracked.current) {
          api.post(`/moments/${moment.moment_id}/view`).catch(() => {});
          viewTracked.current = true;
        }
      }).catch(() => setPlaying(false));
    } else if (videoRef.current) {
      videoRef.current.pause();
      setPlaying(false);
    }

    if (!active) {
      viewTracked.current = false;
    }
  }, [active, userPaused, moment.moment_id]);

  // Reset userPaused when the video becomes active (to allow autoplay for the next video)
  useEffect(() => {
    if (active) setUserPaused(false);
  }, [active]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
        setPlaying(false);
        setUserPaused(true);
      } else {
        videoRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        setUserPaused(false);
      }
    }
  };

  const handleInteraction = (e: React.MouseEvent | React.TouchEvent) => {
    // Toggle play/pause on tap
    togglePlay();

    // Detect tap location
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // Trigger like on first interaction of a potential "burst"
    if (!moment.is_liked) onLike(moment.moment_id);

    // Add heart to burst
    const newHeart = {
      id: ++heartIdCounter.current,
      x,
      y,
      rotate: (Math.random() - 0.5) * 60 // -30 to 30 deg
    };

    setHearts(prev => [...prev, newHeart]);

    // Cleanup heart after animation
    setTimeout(() => {
      setHearts(prev => prev.filter(h => h.id !== newHeart.id));
    }, 1000);
  };

  const onVideoTimeUpdate = () => {
    if (videoRef.current) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
    }
  };

  const mediaSrc = moment.video_url || moment.media_url;
  const isVideo = moment.is_video || moment.media_type === 'video' || !!moment.video_url || !!mediaSrc?.match(/\.(mp4|webm|ogg|quicktime|mov)$/i);

  return (
    <div 
      className="relative w-full h-full max-w-[480px] mx-auto bg-black rounded-none md:rounded-[48px] overflow-hidden shadow-2xl transition-all duration-700 active:scale-[0.98] group select-none" 
      onClick={handleInteraction}
    >
      
      {/* Download Progress Overlay */}
      {downloadProgress !== null && downloadProgress !== undefined && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center backdrop-blur-sm pointer-events-none">
           <div className="relative flex items-center justify-center">
             <svg className="w-24 h-24 transform -rotate-90">
                <circle cx="48" cy="48" r="40" stroke="rgba(255,255,255,0.2)" strokeWidth="6" fill="none" />
                <circle cx="48" cy="48" r="40" stroke="white" strokeWidth="6" fill="none" strokeDasharray="251.2" strokeDashoffset={251.2 - (251.2 * downloadProgress) / 100} className="transition-all duration-300 ease-out" />
             </svg>
             <span className="absolute text-white font-bold text-xl">{downloadProgress}%</span>
           </div>
        </div>
      )}

      <div className="absolute inset-0">
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
              onTimeUpdate={onVideoTimeUpdate}
              className="w-full h-full object-contain pointer-events-none"
            />
          ) : (
            <img 
              src={mediaSrc || moment.thumbnail_url} 
              alt="Moment" 
              className="w-full h-full object-contain pointer-events-none"
            />
          )}
        </div>
        
        {/* Overlays */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

        {/* Vigorous Hearts Burst Layer */}
        <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
          <AnimatePresence>
            {hearts.map(heart => (
              <motion.div
                key={heart.id}
                initial={{ scale: 0, opacity: 0, x: heart.x - 40, y: heart.y - 40, rotate: heart.rotate }}
                animate={{ 
                  scale: [1, 1.5, 2], 
                  opacity: [1, 1, 0], 
                  y: heart.y - 200, // Fly up
                  x: heart.x - 40 + (Math.random() - 0.5) * 50 // Slight horizontal drift
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="absolute text-primary pointer-events-none"
              >
                <Heart size={80} fill="currentColor" strokeWidth={0} className="drop-shadow-2xl" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {!playing && isVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px] pointer-events-none">
            <Play size={64} fill="white" className="opacity-60 drop-shadow-2xl" />
          </div>
        )}
      </div>

      {/* Side Actions (Rationalized for mobile) */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-4 z-20">
        <div className="relative mb-2 group/avatar">
          <img 
            src={moment.avatar_url || '/uploads/avatars/default.png'} 
            className="w-11 h-11 rounded-full border-2 border-white object-cover cursor-pointer shadow-xl transition-all group-hover/avatar:scale-110" 
            alt=""
            onClick={(e) => { e.stopPropagation(); navigate(`/profile/${moment.username}`); }}
          />
          {!moment.is_following && (
            <button className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center text-[10px] border-2 border-black font-black shadow-lg shadow-primary/20 hover:scale-110 transition-transform">+</button>
          )}
        </div>
 
        <button className="flex flex-col items-center gap-0.5 group/btn" onClick={(e) => { e.stopPropagation(); onLike(moment.moment_id); }}>
          <div className={clsx("w-12 h-12 rounded-full backdrop-blur-xl flex items-center justify-center transition-all group-hover/btn:scale-110 shadow-lg border", moment.is_liked ? "bg-primary border-primary text-white" : "bg-black/20 border-white/20 text-white")}>
            <Heart size={24} fill={moment.is_liked ? "currentColor" : "none"} strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-bold text-white uppercase tracking-wider drop-shadow-md">{moment.like_count || 0}</span>
        </button>
 
        <button className="flex flex-col items-center gap-0.5 group/btn" onClick={(e) => { e.stopPropagation(); onOpenComments(moment.moment_id); }}>
          <div className="w-12 h-12 rounded-full bg-black/20 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white transition-all group-hover/btn:scale-110 shadow-lg">
            <MessageCircle size={24} strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-bold text-white uppercase tracking-wider drop-shadow-md">{moment.comment_count || 0}</span>
        </button>
 
        <button className="flex flex-col items-center gap-0.5 group/btn" onClick={(e) => { e.stopPropagation(); onSave(moment.moment_id); }}>
          <div className={clsx("w-12 h-12 rounded-full backdrop-blur-xl flex items-center justify-center transition-all group-hover/btn:scale-110 shadow-lg border", moment.is_saved ? "bg-amber-400 border-amber-400 text-white" : "bg-black/20 border-white/20 text-white")}>
            <BookmarkCheck size={24} fill={moment.is_saved ? "currentColor" : "none"} strokeWidth={2.5} />
          </div>
          <span className="text-[10px] font-bold text-white uppercase tracking-wider drop-shadow-md">{moment.is_saved ? 'Saved' : 'Save'}</span>
        </button>
 
        <button 
          onClick={(e) => { e.stopPropagation(); onShare(moment); }}
          className="w-12 h-12 rounded-full bg-black/20 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white transition-all hover:bg-white/40 shadow-lg"
        >
          <Share2 size={22} strokeWidth={2.5} />
        </button>
 
        <button className="w-9 h-9 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white transition-all mt-2" onClick={(e) => { e.stopPropagation(); setMuted(!muted); }}>
          {muted ? <VolumeX size={16} strokeWidth={2.5} /> : <Volume2 size={16} strokeWidth={2.5} />}
        </button>
      </div>

      {/* Info Overlay (Rationalized) */}
      <div className="absolute inset-x-0 bottom-0 p-5 pb-6 z-10 flex flex-col gap-2 pointer-events-none">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-white tracking-tight pointer-events-auto cursor-pointer flex items-center gap-1.5" onClick={(e) => { e.stopPropagation(); navigate(`/profile/${moment.username}`); }}>
            @{moment.username}
            <Sparkles size={14} className="text-primary fill-primary" />
          </h3>
          <span className="text-[8px] font-black uppercase tracking-widest bg-black/40 backdrop-blur-md text-white px-2.5 py-0.5 rounded-full border border-white/10">Signal</span>
        </div>
        {moment.caption && (
          <p className="text-[14px] font-medium text-white/95 leading-snug drop-shadow-md pr-16 line-clamp-2">
            {moment.caption}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-1.5 opacity-60">
             <Orbit size={12} className="animate-spin-slow text-white" />
             <span className="text-[9px] font-bold text-white uppercase tracking-wider">{moment.view_count || 0} signals</span>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onOpenSearch(); }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-white/80 hover:text-white transition-all active:scale-95 pointer-events-auto"
          >
            <Search size={10} />
            <span className="text-[8px] font-bold uppercase tracking-wider">Search</span>
          </button>
        </div>
      </div>

      {/* Cinematic Progress Bar (TikTok style) */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-[30] pointer-events-none">
        <motion.div 
          className="h-full bg-white/60 shadow-[0_0_10px_rgba(255,255,255,0.5)]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1, ease: "linear" }}
        />
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
  const [activeMomentId, setActiveMomentId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [selectedMoment, setSelectedMoment] = useState<Moment | null>(null);
  
  // Moments Search States
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchHistory, setSearchHistory] = useState(['Nairobi Nightlife', 'Sheng Rap', 'Kenyan Food']);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [searchResults, setSearchResults] = useState<Moment[]>([]);
  const [activeSearchTab, setActiveSearchTab] = useState('Top');
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const searchCache = useRef<Record<string, any>>({});
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<{ id: string, progress: number } | null>(null);
  const [momentToShare, setMomentToShare] = useState<Moment | null>(null);
  
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

  const handleSearch = async (query: string, type: string = activeSearchTab, force: boolean = false) => {
    if (!query || !query.trim()) return;
    
    const cacheKey = `${type}:${query.toLowerCase().trim()}`;
    const now = Date.now();
    const TTL = 5 * 60 * 1000; // 5 minutes

    // 1. Check Memory Cache
    if (!force && searchCache.current[cacheKey] && (now - searchCache.current[cacheKey].timestamp < TTL)) {
      setSearchResults(searchCache.current[cacheKey].moments);
      setIsFallback(searchCache.current[cacheKey].isFallback);
      setHasSearched(true);
      setSearchQuery(query);
      return;
    }

    // 2. Check Persistent Cache (LocalStorage)
    const persisted = localStorage.getItem(`search_${cacheKey}`);
    if (!force && persisted) {
        const { moments, isFallback, timestamp } = JSON.parse(persisted);
        if (now - timestamp < TTL) {
            setSearchResults(moments);
            setIsFallback(isFallback);
            setHasSearched(true);
            setSearchQuery(query);
            searchCache.current[cacheKey] = { moments, isFallback, timestamp }; // Sync to memory
            return;
        }
    }

    setSearchQuery(query);
    setSearchInput(query);
    setIsSearching(true);
    setHasSearched(true);
    
    // Add to history if not exists
    if (!searchHistory.includes(query)) {
      setSearchHistory(prev => [query, ...prev.slice(0, 9)]);
    }

    try {
      const res = await api.get(`/moments/stream?query=${encodeURIComponent(query)}&type=${type}`);
      const data = res.data;
      const resultData = {
        moments: data.moments || data || [],
        isFallback: data.isFallback || false,
        timestamp: now
      };

      setSearchResults(resultData.moments);
      setIsFallback(resultData.isFallback);
      
      // Update Caches
      searchCache.current[cacheKey] = resultData;
      localStorage.setItem(`search_${cacheKey}`, JSON.stringify(resultData));
    } catch (err) {
      console.error('Search error', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search for typing
  useEffect(() => {
    if (searchInput.trim().length > 2 && searchInput !== searchQuery) {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => {
        handleSearch(searchInput, activeSearchTab);
      }, 500);
    }
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchInput]);

  // Re-trigger search when tab changes
  useEffect(() => {
    if (hasSearched && searchQuery) {
      handleSearch(searchQuery, activeSearchTab);
    }
  }, [activeSearchTab]);

  const trackEngagement = async (momentId: string, type: string, value?: number, category?: string) => {
    try {
      await api.post(`/moments/${momentId}/engagement`, { type, value, category });
    } catch (err) {
      // Silently fail telemetry
    }
  };

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

  const startDownload = async (moment: Moment) => {
    setMomentToShare(null);
    setDownloadProgress({ id: moment.moment_id, progress: 0 });

    try {
      const url = moment.video_url || moment.media_url;
      if (!url) throw new Error('No media URL');

      const response = await fetch(url);
      if (!response.body) throw new Error('ReadableStream not yet supported in this browser.');

      const contentLength = response.headers.get('content-length');
      const total = parseInt(contentLength || '0', 10);
      let loaded = 0;

      const reader = response.body.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.length;
          if (total) {
            setDownloadProgress({ id: moment.moment_id, progress: Math.round((loaded / total) * 100) });
          } else {
             setDownloadProgress(prev => ({ id: moment.moment_id, progress: Math.min((prev?.progress || 0) + 10, 90) }));
          }
        }
      }

      setDownloadProgress({ id: moment.moment_id, progress: 100 });
      
      const blob = new Blob(chunks);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `sparkle-moment-${moment.moment_id}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      setTimeout(() => setDownloadProgress(null), 1000);
    } catch (error) {
      console.error('Download error:', error);
      const link = document.createElement('a');
      link.href = moment.video_url || moment.media_url || '';
      link.download = `sparkle-moment-${moment.moment_id}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloadProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#fdf2f4] flex flex-col font-sans overflow-hidden">
      <Navbar />

      {/* Top Navigation Bar Overlay (Minimalist) */}
      {!isSearchOpen && (
        <div className="fixed top-0 left-0 right-0 p-5 flex justify-between items-center z-[1100] pointer-events-none lg:ml-72">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white pointer-events-auto active:scale-90 transition-transform"
            >
              <X size={20} />
            </button>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] drop-shadow-lg">Sparkle</span>
              <span className="text-[14px] font-bold text-white flex items-center gap-1.5 drop-shadow-md">
                Live Stream
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_#ef4444]" />
              </span>
            </div>
          </div>
          <button 
            onClick={() => setIsSearchOpen(true)}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white pointer-events-auto active:scale-90 transition-transform"
          >
            <Search size={18} />
          </button>
        </div>
      )}

      {/* Moments Specific Search Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div 
            initial={{ opacity: 0, x: '100%' }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: '100%' }}
            className="fixed inset-0 bg-black z-[2000] flex flex-col lg:ml-72"
          >
            {/* Search Header */}
            <div className="p-4 flex items-center gap-3 border-b border-white/5">
              <button onClick={() => { setIsSearchOpen(false); setHasSearched(false); }} className="text-white active:scale-90 transition-transform">
                <X size={24} />
              </button>
              <div className="flex-1 relative">
                <input 
                  autoFocus
                  type="text" 
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchInput)}
                  placeholder="Search moments..."
                  className="w-full bg-white/10 border-none rounded-full py-2.5 px-10 text-sm font-medium focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                />
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                {searchInput && (
                  <button onClick={() => { setSearchInput(''); setSearchQuery(''); setHasSearched(false); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40">
                    <X size={14} />
                  </button>
                )}
              </div>
              <button 
                onClick={() => handleSearch(searchInput)}
                className="text-primary font-bold text-sm px-2 active:opacity-50"
              >
                Search
              </button>
            </div>

            {/* Fixed Category Tabs (TikTok Style) */}
            {(hasSearched || searchQuery) && (
              <div className="flex items-center px-4 overflow-x-auto scrollbar-hide border-b border-white/5 bg-black/80 backdrop-blur-2xl z-[10]">
                {['Top', 'Videos', 'Users', 'Sounds', 'Photos', 'Live', 'Hashtags'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveSearchTab(tab)}
                    className={clsx(
                      "px-5 py-3 text-xs font-bold uppercase tracking-widest whitespace-nowrap border-b-2 transition-all",
                      activeSearchTab === tab ? "border-primary text-white" : "border-transparent text-white/40"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            )}

            <div className="flex-1 overflow-y-auto scrollbar-hide">
              {!hasSearched && !searchQuery ? (
                <div className="p-5 flex flex-col gap-8">
                  {/* Search History */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest">Recent Searches</h4>
                      <button onClick={() => setSearchHistory([])} className="text-[10px] font-bold text-white/20 uppercase tracking-wider">Clear all</button>
                    </div>
                    <div className="flex flex-col">
                      {(showAllHistory ? searchHistory : searchHistory.slice(0, 3)).map((item, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => handleSearch(item)}
                          className="flex items-center justify-between py-3.5 border-b border-white/5 active:bg-white/5 transition-colors"
                        >
                          <span className="text-sm font-medium text-white/80">{item}</span>
                          <History size={14} className="text-white/20" />
                        </div>
                      ))}
                      {searchHistory.length > 3 && !showAllHistory && (
                        <button 
                          onClick={() => setShowAllHistory(true)}
                          className="py-3 text-xs font-bold text-white/30 hover:text-white transition-colors"
                        >
                          Show more history...
                        </button>
                      )}
                    </div>
                  </div>

                  {/* You May Like - Red Highlighted Suggestions */}
                  <div>
                    <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">You May Like</h4>
                    <div className="flex flex-col gap-1">
                      {[
                        { text: 'Kenya vs World Challenge', trending: true },
                        { text: 'Mombasa Vibez 2026', trending: true },
                        { text: 'Sheng Comedy Central', trending: true },
                        { text: 'Sparkle Dance Off', trending: false },
                        { text: 'Afterglow Moments', trending: false }
                      ].map((item, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => handleSearch(item.text)}
                          className="flex items-center justify-between py-3 group cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <span className={clsx(
                              "text-sm font-bold transition-colors",
                              idx < 3 ? "text-primary" : "text-white/60 group-hover:text-white"
                            )}>
                              {item.text}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                             {item.trending && <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />}
                             <button className="p-1.5 rounded-lg bg-white/5 text-white/40 group-hover:text-white group-hover:bg-white/10 transition-all">
                                <Search size={14} />
                             </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  {/* Results Header / Fallback Info */}
                  {isFallback && !isSearching && (
                    <div className="px-5 py-4 bg-primary/10 border-b border-primary/20">
                        <p className="text-[11px] font-black uppercase tracking-widest text-primary leading-tight">No direct matches found</p>
                        <p className="text-[10px] font-bold text-white/40 mt-1 uppercase tracking-wider">Surfacing related trending content for you:</p>
                    </div>
                  )}

                  {/* Results Grid */}
                  {isSearching ? (
                    <div className="flex-1 flex items-center justify-center">
                      <Loader2 size={32} className="animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-0.5 p-0.5">
                      {searchResults.map((moment, idx) => (
                        <div 
                          key={moment.moment_id}
                          onClick={() => {
                            if (moment.media_type === 'user') {
                               navigate(`/profile/${moment.username}`);
                               return;
                            }
                            setIsSearchOpen(false);
                            setHasSearched(false);
                            setMoments([moment]);
                            setActiveIndex(0);
                          }}
                          className={clsx(
                            "relative overflow-hidden group cursor-pointer transition-all active:scale-95",
                            moment.media_type === 'user' 
                                ? "aspect-square bg-white/5 rounded-2xl flex flex-col items-center justify-center gap-3 p-4 border border-white/5 hover:bg-white/10" 
                                : "aspect-[9/16] bg-white/5"
                          )}
                        >
                          {moment.media_type === 'user' ? (
                            <>
                                <img src={moment.avatar_url || '/uploads/avatars/default.png'} className="w-20 h-20 rounded-full border-2 border-primary/20 object-cover shadow-xl" />
                                <div className="text-center">
                                    <p className="text-sm font-black text-white leading-none">@{moment.username}</p>
                                    <p className="text-[10px] text-white/40 mt-1 font-bold uppercase tracking-widest">{moment.follower_count || 0} Followers</p>
                                </div>
                                <button className="mt-2 px-4 py-1.5 rounded-full bg-primary text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-primary/20">Follow</button>
                            </>
                          ) : (
                            <>
                                {moment.media_type === 'video' ? (
                                    <video 
                                    src={moment.video_url || moment.media_url} 
                                    muted 
                                    autoPlay={false} 
                                    loop
                                    playsInline
                                    className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <img src={moment.media_url} className="w-full h-full object-cover" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                                    <img src={moment.avatar_url || '/uploads/avatars/default.png'} className="w-4 h-4 rounded-full border border-white/20" />
                                    <span className="text-[10px] font-bold text-white/90">@{moment.username}</span>
                                </div>
                                <div className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold text-white">
                                    <Heart size={10} fill="currentColor" className="text-primary" />
                                    {moment.like_count || 0}
                                </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
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
              <div key={m.moment_id} className="h-[100dvh] w-full snap-start flex items-center justify-center px-0 md:px-10 pt-0 md:pt-20 pb-12 md:pb-20 lg:ml-72 transition-all overflow-hidden relative">
                <ReelItem 
                   active={idx === activeIndex}
                   moment={m} 
                   onLike={handleLike} 
                   onSave={handleSave}
                   onOpenComments={openComments}
                   onShare={setMomentToShare}
                   onOpenSearch={() => setIsSearchOpen(true)}
                   downloadProgress={downloadProgress?.id === m.moment_id ? downloadProgress.progress : null}
                />
              </div>
            ))
        )}
      </div>

      {momentToShare && (
        <MomentShareModal 
          moment={momentToShare} 
          onClose={() => setMomentToShare(null)} 
          onDownload={startDownload}
        />
      )}

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
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="fixed bottom-0 left-0 lg:left-72 right-0 h-[60vh] bg-white rounded-t-3xl z-[1001] flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-4 flex justify-between items-center border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-gray-900">Comments</span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px] font-bold">{comments.length}</span>
                </div>
                <button onClick={() => setShowComments(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-all">
                  <X size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
                {comments.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                    <MessageCircle size={48} strokeWidth={1} className="mb-4" />
                    <p className="text-[12px] font-bold uppercase tracking-widest">No comments yet</p>
                  </div>
                ) : (
                  comments.map(c => <CommentItem key={c.comment_id} comment={c} onLike={() => {}} />)
                )}
              </div>
 
              <form className="p-4 bg-white border-t border-gray-100 flex gap-3 items-center" onSubmit={handleAddComment}>
                <input 
                  type="text" 
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="flex-1 h-10 bg-gray-100 rounded-full px-5 text-[14px] font-medium outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <button 
                  type="submit"
                  disabled={!newComment.trim() || submittingComment}
                  className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center shadow-md active:scale-90 transition-all disabled:opacity-50"
                >
                  {submittingComment ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
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
