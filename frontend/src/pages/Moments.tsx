import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Bookmark, BookmarkCheck, MoreHorizontal, Play } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';

interface Moment {
  moment_id: string;
  username: string;
  title?: string;
  caption?: string; 
  avatar_url?: string;
  thumbnail_url?: string;
  video_url?: string;
  media_url?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  created_at: string;
  is_video?: boolean;
  is_liked?: boolean;
  is_saved?: boolean;
}

const ReelItem = ({ 
  moment, 
  onLike, 
  onSave 
}: { 
  moment: Moment; 
  onLike: (id: string) => void;
  onSave: (id: string) => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry.isIntersecting) {
        if (videoRef.current) {
          videoRef.current.play().then(() => setPlaying(true)).catch((e) => {
             console.log('Autoplay blocked', e);
             setPlaying(false);
          });
        }
      } else {
        if (videoRef.current) {
          videoRef.current.pause();
          setPlaying(false);
        }
      }
    }, { threshold: 0.6 });

    if (containerRef.current) observer.observe(containerRef.current);
    
    return () => {
      if (containerRef.current) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        observer.unobserve(containerRef.current);
      }
    }
  }, []);

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

  const shareReel = () => {
    const url = `${window.location.origin}/moments/${moment.moment_id}`;
    if (navigator.share) {
      navigator.share({ title: 'Sparkle Moment', url }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  const titleCaption = moment.caption || moment.title;
  const mediaSrc = moment.video_url || moment.media_url;
  const isVideo = moment.is_video || !!moment.video_url || !!mediaSrc?.match(/\.(mp4|webm|ogg)$/i);

  return (
    <div className="reel-container" ref={containerRef}>
      <div className="reel-video-wrapper" onClick={togglePlay}>
        {isVideo ? (
          <video 
            ref={videoRef}
            src={mediaSrc} 
            poster={moment.thumbnail_url}
            loop
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
        {!playing && isVideo && (
          <div className="reel-play-overlay"><Play size={56} fill="white" /></div>
        )}
      </div>

      {/* Side Actions Overlay */}
      <div className="reel-sidebar">
        <div className="reel-action-box" onClick={() => navigate(`/profile/${moment.username}`)}>
          <img 
            src={moment.avatar_url || '/uploads/avatars/default.png'} 
            className="reel-avatar" 
            alt={moment.username}
            onError={(e) => { (e.target as HTMLImageElement).src = '/uploads/avatars/default.png'; }}
          />
        </div>
        <button className="reel-action-btn" onClick={() => onLike(moment.moment_id)}>
          <Heart size={28} fill={moment.is_liked ? '#FF3D6D' : 'rgba(255,255,255,0.2)'} color={moment.is_liked ? '#FF3D6D' : 'white'} className={moment.is_liked ? 'liked-bounce' : ''} />
          <span>{moment.like_count || 0}</span>
        </button>
        <button className="reel-action-btn" onClick={() => navigate(`/moments/${moment.moment_id}`)}>
          <MessageCircle size={28} fill="rgba(255,255,255,0.2)" color="white" />
          <span>{moment.comment_count || 0}</span>
        </button>
        <button className="reel-action-btn" onClick={() => onSave(moment.moment_id)}>
          {moment.is_saved ? (
             <BookmarkCheck size={28} fill="#FACC15" color="#FACC15" className="liked-bounce" />
          ) : (
             <Bookmark size={28} fill="rgba(255,255,255,0.2)" color="white" />
          )}
          <span>Save</span>
        </button>
        <button className="reel-action-btn" onClick={shareReel}>
          <Share2 size={28} fill="rgba(255,255,255,0.2)" color="white" />
          <span>Share</span>
        </button>
        <button className="reel-action-btn">
          <MoreHorizontal size={28} color="white" />
        </button>
      </div>

      {/* Bottom Info Overlay */}
      <div className="reel-bottom-info">
        <div className="reel-info-user" onClick={() => navigate(`/profile/${moment.username}`)}>
          <span className="reel-username">@{moment.username}</span>
          <button className="reel-follow-btn" onClick={(e) => { e.stopPropagation(); /* TODO: follow */ }}>Follow</button>
        </div>
        {titleCaption && (
          <p className="reel-caption">{titleCaption}</p>
        )}
      </div>
    </div>
  );
};

export default function Moments() {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchMoments(); }, []);

  const fetchMoments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/moments/stream');
      const data = res.data.moments || res.data || [];
      // Optionally fallback data if api is empty for testing:
      if (data.length === 0) {
        setMoments([]);
      } else {
        setMoments(data);
      }
    } catch (err) {
      console.error('Moments fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (id: string) => {
    const idx = moments.findIndex(m => m.moment_id === id);
    if (idx === -1) return;
    const m = moments[idx];
    const wasLiked = m.is_liked;
    
    setMoments(prev => prev.map(item => item.moment_id === id ? {
      ...item, is_liked: !wasLiked, like_count: (item.like_count || 0) + (wasLiked ? -1 : 1)
    } : item));
    
    try {
      await api.post(`/moments/${id}/spark`);
    } catch (err) {
      setMoments(prev => prev.map(item => item.moment_id === id ? {
        ...item, is_liked: wasLiked, like_count: (item.like_count || 0) + (wasLiked ? 1 : -1)
      } : item));
    }
  };

  const handleSave = async (id: string) => {
    const idx = moments.findIndex(m => m.moment_id === id);
    if (idx === -1) return;
    const m = moments[idx];
    const wasSaved = m.is_saved;
    
    setMoments(prev => prev.map(item => item.moment_id === id ? {
      ...item, is_saved: !wasSaved
    } : item));
    
    try {
      await api.post(`/moments/${id}/save`);
    } catch (err) {
       console.log('Save state updated locally (no endpoint found perhaps)', err);
    }
  };

  return (
     <div className="page-wrapper">
       <Navbar />
       <div className="reels-page-content">
         {loading ? (
            <div className="reel-loader">
               <div className="loader-spinner"></div>
               <p>Loading Moments...</p>
            </div>
         ) : moments.length === 0 ? (
            <div className="reel-loader" style={{flexDirection: 'column'}}>
                <h2>No Moments Found</h2>
                <p>Be the first to create one!</p>
            </div>
         ) : (
            moments.map(m => (
              <div key={m.moment_id} className="reel-snap-item">
                <ReelItem 
                   moment={m} 
                   onLike={handleLike} 
                   onSave={handleSave} 
                />
              </div>
            ))
         )}
       </div>

       <style>{`
        .page-wrapper { display: flex; background: #000; min-height: 100vh; overflow: hidden; width: 100%; }
        .reels-page-content { flex: 1; height: 100vh; overflow-y: scroll; scroll-snap-type: y mandatory; scroll-behavior: smooth; position: relative; display: flex; flex-direction: column; align-items: center; }
        .reels-page-content::-webkit-scrollbar { display: none; }
        
        .reel-snap-item { height: 100vh; width: 100%; max-width: 500px; scroll-snap-align: start; scroll-snap-stop: always; display: flex; align-items: center; justify-content: center; background: #000; position: relative; }
        
        .reel-container { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #111; overflow: hidden; }
        @media (min-width: 600px) { .reel-container { height: calc(100vh - 40px); border-radius: 12px; margin: 20px 0; } }
        
        .reel-video-wrapper { position: absolute; inset: 0; width: 100%; height: 100%; cursor: pointer; display: flex; align-items: center; justify-content: center; background: #000; }
        .reel-media { width: 100%; height: 100%; object-fit: cover; }
        .reel-play-overlay { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.3); border-radius: 50%; padding: 16px; pointer-events: none; backdrop-filter: blur(5px); }

        /* Overlays */
        .reel-sidebar { position: absolute; bottom: 120px; right: 12px; display: flex; flex-direction: column; align-items: center; gap: 20px; z-index: 10; }
        .reel-action-btn { display: flex; flex-direction: column; align-items: center; gap: 6px; background: none; border: none; color: white; cursor: pointer; font-size: 13px; font-weight: 700; font-family: inherit; text-shadow: 0 1px 4px rgba(0,0,0,0.9); transition: transform 0.2s; padding: 0; }
        .reel-action-btn svg { filter: drop-shadow(0 2px 5px rgba(0,0,0,0.6)); transition: transform 0.2s; }
        .reel-action-btn:hover svg { transform: scale(1.1); }
        .liked-bounce { animation: bounceIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }

        .reel-action-box { display: flex; flex-direction: column; align-items: center; cursor: pointer; margin-bottom: 8px; border-radius: 50%; padding: 2px; }
        .reel-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid white; box-shadow: 0 2px 10px rgba(0,0,0,0.3); }

        .reel-bottom-info { position: absolute; bottom: 0; left: 0; right: 70px; padding: 40px 16px 24px; background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%); z-index: 9; color: white; }
        .reel-info-user { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; cursor: pointer; }
        .reel-username { font-weight: 800; font-size: 1.05rem; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }
        .reel-follow-btn { border: 1px solid white; background: transparent; color: white; border-radius: 6px; padding: 4px 10px; font-weight: 600; font-size: 0.8rem; cursor: pointer; transition: 0.2s; text-shadow: none; }
        .reel-follow-btn:hover { background: white; color: black; }
        .reel-caption { font-size: 0.95rem; line-height: 1.4; margin: 0; text-shadow: 0 1px 3px rgba(0,0,0,0.8); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

        .reel-loader { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; width: 100%; color: white; font-weight: 700; font-size: 1.2rem; }
        .loader-spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.2); border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 16px; }

        @keyframes bounceIn { 0% { transform: scale(0.8); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        @media (max-width: 1024px) {
           .reels-page-content { padding-bottom: 75px; /* space for mobile nav */ }
           .reel-snap-item { max-width: 100%; }
           .reel-container { height: 100%; border-radius: 0; margin: 0; }
           .reel-sidebar { bottom: 30px; }
           .reel-bottom-info { bottom: 0; padding-bottom: 30px; right: 60px; }
        }
       `}</style>
     </div>
  );
}
