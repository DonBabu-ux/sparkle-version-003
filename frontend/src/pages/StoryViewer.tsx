import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/api';
import { 
  X, Send, Orbit, Camera, Plus, Heart, 
  MessageCircle, MoreHorizontal, ChevronRight, Share2 
} from 'lucide-react';
import StickerRenderer from '../components/stories/StickerRenderer';
import { useStoryStore } from '../store/storyStore';
import { getAvatarUrl } from '../utils/imageUtils';

interface Story {
  story_id: string;
  media_url: string;
  media_type: string;
  caption?: string;
  background?: string;
  music_info?: any;
  audio_url?: string;
  audio_source?: string;
  audio_start?: number;
  audio_duration?: number;
  created_at: string;
  stickers?: any[];
}

interface UserStoryGroup {
  user_id: string;
  user_name: string;
  avatar_url?: string;
  stories: Story[];
}

export default function StoryViewer() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [userStories, setUserStories] = useState<UserStoryGroup | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [audio] = useState(new Audio());
  const [isLiked, setIsLiked] = useState(false);
  
  // Add Yours Response Modal State
  const [showAddYoursResponses, setShowAddYoursResponses] = useState(false);
  const [addYoursData, setAddYoursData] = useState<any>(null);

  const { setPendingFile } = useStoryStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activePromptRef = useRef<{ id: string, text: string } | null>(null);

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const response = await api.get('/stories/active');
        const userGroup = response.data.find((g: UserStoryGroup) => g.user_id === userId);
        if (userGroup) {
          setUserStories(userGroup);
        } else {
          navigate('/dashboard');
        }
      } catch (err) {
        console.error('Failed to fetch stories:', err);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    fetchStories();
  }, [userId, navigate]);

  // Audio Playback Controller
  useEffect(() => {
    if (!userStories || !userStories.stories[currentIndex]) return;
    const current = userStories.stories[currentIndex];

    if (current.audio_url) {
        audio.src = current.audio_url;
        audio.currentTime = current.audio_start || 0;
        audio.play().catch(e => console.log('Audio autoplay blocked or failed', e));
        
        const duration = (current.audio_duration || 15) * 1000;
        const timer = setTimeout(() => audio.pause(), duration);
        return () => {
            audio.pause();
            clearTimeout(timer);
        };
    } else {
        audio.pause();
    }
  }, [currentIndex, userStories, audio]);

  useEffect(() => {
    if (!userStories || showAddYoursResponses) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          if (currentIndex < userStories.stories.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setIsLiked(false);
            return 0;
          } else {
            navigate('/dashboard');
            return 100;
          }
        }
        return prev + 1;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [userStories, currentIndex, navigate, showAddYoursResponses]);

  if (loading) return (
    <div className="h-screen bg-black flex flex-col items-center justify-center gap-6">
       <Orbit size={48} strokeWidth={4} className="text-primary animate-spin-slow" />
       <p className="text-white font-black text-[10px] uppercase tracking-[0.4em] italic">Harmonizing Frequency...</p>
    </div>
  );

  if (!userStories) return null;

  const currentStory = userStories.stories[currentIndex];

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activePromptRef.current) {
      setPendingFile(file);
      navigate(`/stories/create?prompt_id=${activePromptRef.current.id}&prompt_text=${encodeURIComponent(activePromptRef.current.text)}`);
    }
  };

  const handleStickerInteract = async (stickerId: string, data: any) => {
    try {
      if (data.action === 'vote') {
        const res = await api.post(`/stickers/poll/vote`, {
          sticker_id: stickerId,
          option_index: data.optionIndex
        });
        
        setUserStories(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            stories: prev.stories.map((s, idx) => idx === currentIndex ? {
                ...s,
                stickers: s.stickers?.map(st => st.id === stickerId ? { ...st, config: res.data.config } : st)
            } : s)
          };
        });
      } else if (data.action === 'respond') {
        navigate(`/stories/create?parent=${currentStory.story_id}`);
      }
    } catch (err) {
      console.error('Sticker interaction failed:', err);
    }
  };

  return (
    <div className="h-screen bg-black flex flex-col relative overflow-hidden safe-area-inset">
      <input type="file" ref={fileInputRef} hidden accept="image/*,video/*" onChange={handleFileSelect} />

      {/* Modern Phone-Frame Media View (Requirement: Instagram Modern) */}
      <div className="absolute inset-0 flex items-center justify-center bg-black sm:p-4">
        <div className="w-full h-full sm:h-[95vh] sm:aspect-[9/19.5] sm:rounded-[48px] overflow-hidden relative shadow-2xl bg-gray-900 border border-white/5">
          
          {/* Progress Bars (Thinner, Premium) */}
          <div className="absolute top-4 left-4 right-4 z-50 flex gap-1.5 px-2">
            {userStories.stories.map((_: Story, idx: number) => (
              <div key={idx} className="h-[2px] flex-1 bg-white/20 rounded-full overflow-hidden">
                <motion.div 
                  className="h-full bg-white shadow-[0_0_8px_white]"
                  initial={false}
                  animate={{ width: idx === currentIndex ? `${progress}%` : idx < currentIndex ? '100%' : '0%' }}
                  transition={{ duration: 0.1, ease: 'linear' }}
                />
              </div>
            ))}
          </div>

          {/* Header (Premium, Compact) */}
          <div className="absolute top-10 left-6 right-6 z-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 to-rose-500">
                  <img src={getAvatarUrl(userStories.avatar_url, userStories.user_name)} className="w-full h-full rounded-full object-cover border-2 border-black" alt="" />
               </div>
               <div className="flex flex-col">
                  <h4 className="text-white font-bold text-[13px] tracking-tight flex items-center gap-1.5">
                    {userStories.user_name}
                    <span className="text-white/40 text-[11px] font-medium">• {new Date(currentStory.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                  </h4>
               </div>
            </div>
            <div className="flex items-center gap-3">
              <button className="text-white/60 active:scale-90 transition-all"><MoreHorizontal size={20} /></button>
              <button onClick={() => navigate('/dashboard')} className="text-white/80 active:scale-90 transition-all"><X size={24} strokeWidth={2.5} /></button>
            </div>
          </div>

          {/* Media Content */}
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-black">
            {currentStory.media_type === 'video' ? (
              <video 
                src={currentStory.media_url} 
                autoPlay 
                muted 
                playsInline 
                className="h-full w-full object-cover"
                onEnded={() => {
                  if (currentIndex < userStories.stories.length - 1) {
                    setCurrentIndex(currentIndex + 1);
                    setProgress(0);
                  } else {
                    navigate('/dashboard');
                  }
                }}
              />
            ) : currentStory.media_type === 'text' ? (
              <div className="w-full h-full flex items-center justify-center p-10" style={{ background: currentStory.background || '#111' }}>
                 <h2 className="text-white text-3xl md:text-5xl font-black text-center leading-tight tracking-tighter uppercase italic">
                   {currentStory.caption}
                 </h2>
              </div>
            ) : (
              <img src={currentStory.media_url} className="h-full w-full object-cover" alt="" />
            )}

            {/* Sticker Renderer */}
            <StickerRenderer 
              stickers={currentStory.stickers || []} 
              onInteract={handleStickerInteract}
            />

            {/* Premium Music Indicator */}
            {currentStory.music_info && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="absolute bottom-28 left-6 z-[60]">
                    <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-full py-2 px-4 flex items-center gap-3 shadow-xl">
                        <div className="w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-[12px] animate-spin-slow">💿</div>
                        <div className="flex items-center gap-2 overflow-hidden max-w-[150px]">
                            <p className="text-white font-bold text-[10px] uppercase tracking-wide truncate">{currentStory.music_info.title}</p>
                            <span className="text-white/30 text-[10px]">—</span>
                            <p className="text-white/50 text-[9px] font-medium truncate">{currentStory.music_info.artist}</p>
                        </div>
                    </div>
                </motion.div>
            )}
          </div>

          {/* Bottom Interaction Bar (Requirement: Modern & Glassy) */}
          <div className="absolute bottom-6 left-0 right-0 px-6 z-50 flex items-center gap-4">
             <div className="flex-1 relative">
                <input 
                  type="text" 
                  placeholder="Send message" 
                  className="w-full h-12 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-full px-6 text-[13px] font-medium text-white placeholder:text-white/40 outline-none focus:bg-white/20 transition-all" 
                />
                <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40"><ChevronRight size={18} /></button>
             </div>
             
             <div className="flex items-center gap-5">
               <button 
                onClick={() => setIsLiked(!isLiked)} 
                className={`transition-all active:scale-150 ${isLiked ? 'text-rose-500 fill-rose-500' : 'text-white'}`}
               >
                 <Heart size={26} strokeWidth={isLiked ? 0 : 2} />
               </button>
               <button className="text-white active:scale-90 transition-all">
                 <Share2 size={24} />
               </button>
             </div>
          </div>

          {/* Navigation Touch Zones */}
          <div className="absolute inset-0 z-20 flex">
            <div className="w-1/3 h-full" onClick={() => { if (currentIndex > 0) { setCurrentIndex(currentIndex - 1); setProgress(0); } }} />
            <div className="w-2/3 h-full" onClick={() => { if (currentIndex < userStories.stories.length - 1) { setCurrentIndex(currentIndex + 1); setProgress(0); } else { navigate('/dashboard'); } }} />
          </div>

        </div>
      </div>

      {/* Add Yours Responses Modal */}
      <AnimatePresence>
        {showAddYoursResponses && addYoursData && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/90 backdrop-blur-xl">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} className="bg-black/40 backdrop-blur-3xl border border-white/10 w-full sm:max-w-[420px] rounded-t-[40px] sm:rounded-[40px] p-8 pb-12 flex flex-col shadow-2xl overflow-hidden max-h-[85vh]">
               <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
               <div className="text-center mb-8">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2 italic">Add Yours Prompt</p>
                  <h3 className="text-[24px] font-black italic uppercase text-white tracking-tighter leading-none">{addYoursData.prompt.text}</h3>
               </div>
               <div className="flex-1 overflow-y-auto pr-2">
                  <div className="grid grid-cols-4 gap-4 mb-8">
                     {addYoursData.responses.map((res: any, i: number) => (
                        <div key={i} className="flex flex-col items-center gap-2 group cursor-pointer">
                           <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 overflow-hidden group-hover:border-primary transition-all">
                              <img src={getAvatarUrl(res.avatar_url, res.username)} className="w-full h-full object-cover" alt="" />
                           </div>
                           <span className="text-[9px] font-bold text-white/40 uppercase tracking-tighter truncate w-full text-center">{res.username}</span>
                        </div>
                     ))}
                  </div>
               </div>
               <div className="pt-6 flex flex-col gap-3">
                  <button onClick={() => { setShowAddYoursResponses(false); navigate(`/stories/create?parent=${currentStory.story_id}`); }} className="w-full py-6 bg-white text-black font-black uppercase rounded-[28px] flex items-center justify-center gap-3 active:scale-95 transition-all text-[14px]">
                    <Camera size={24} /> Add Yours
                  </button>
                  <button onClick={() => setShowAddYoursResponses(false)} className="w-full py-4 text-white/40 font-bold uppercase tracking-widest text-[10px]">Maybe Later</button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .animate-spin-slow { animation: spin 12s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .safe-area-inset { padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom); }
      `}</style>
    </div>
  );
}
