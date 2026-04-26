import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/api';
import { X, Send, Orbit, Camera, Plus } from 'lucide-react';
import StickerRenderer from '../components/stories/StickerRenderer';
import { useStoryStore } from '../store/storyStore';
import { getAvatarUrl } from '../utils/imageUtils';

interface Story {
  story_id: string;
  media_url: string;
  media_type: string;
  caption?: string;
  background?: string;
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
  
  // Add Yours Response Modal State
  const [showAddYoursResponses, setShowAddYoursResponses] = useState(false);
  const [addYoursData, setAddYoursData] = useState<any>(null);

  // These hooks MUST be here (before any early returns) to satisfy Rules of Hooks
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
        
        // Auto-stop after duration
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
            return 0;
          } else {
            navigate('/dashboard');
            return 100;
          }
        }
        return prev + 1;
      });
    }, 40); // 4 seconds total

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
        // Navigate to create story with parent_id
        navigate(`/stories/create?parent=${currentStory.story_id}`);
      }
    } catch (err) {
      console.error('Sticker interaction failed:', err);
    }
  };

  return (
    <div className="h-screen bg-black flex flex-col relative overflow-hidden">
      {/* Hidden File Input for Direct Responses */}
      <input type="file" ref={fileInputRef} hidden accept="image/*,video/*" onChange={handleFileSelect} />

      {/* Dynamic Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/10 blur-[150px] pointer-events-none z-0"></div>

      {/* Progress Bars */}
      <div className="absolute top-6 left-6 right-6 z-40 flex gap-2">
        {userStories.stories.map((_: Story, idx: number) => (
          <div key={idx} className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden shadow-2xl">
            <div 
              className="h-full bg-white transition-all duration-75"
              style={{ 
                width: idx === currentIndex ? `${progress}%` : idx < currentIndex ? '100%' : '0%' 
              }}
            ></div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-14 left-8 right-8 z-40 flex items-center justify-between">
        <div className="flex items-center gap-4">
           <div className="p-0.5 rounded-2xl bg-white shadow-2xl border border-white/20 overflow-hidden">
              <img src={getAvatarUrl(userStories.avatar_url, userStories.user_name)} className="w-12 h-12 rounded-xl object-cover" alt="" />
           </div>
           <div>
              <h4 className="text-white font-black text-base uppercase tracking-tighter italic leading-none">{userStories.user_name}</h4>
              <p className="text-white/40 text-[9px] font-black uppercase tracking-[0.2em] mt-1 italic">
                {new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
           </div>
        </div>
        <button 
          onClick={() => navigate('/dashboard')} 
          className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-3xl border border-white/20 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all active:scale-90"
        >
          <X size={24} strokeWidth={4} />
        </button>
      </div>

      {/* Media Content */}
      <div className="flex-1 flex items-center justify-center w-full relative z-10">
        {currentStory.media_type === 'video' ? (
          <video 
            src={currentStory.media_url} 
            autoPlay 
            muted 
            playsInline 
            className="max-h-full w-full object-contain"
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
          <div className="w-full h-full flex items-center justify-center p-12" style={{ background: currentStory.background || 'linear-gradient(to bottom right, var(--tw-gradient-from), var(--tw-gradient-to))' }}>
             <h2 className="text-white text-4xl md:text-7xl font-black text-center leading-none tracking-tighter uppercase italic drop-shadow-[0_0_30px_rgba(225,29,72,0.5)] animate-in zoom-in duration-700">
               {currentStory.caption}
             </h2>
          </div>
        ) : (
          <img src={currentStory.media_url} className="max-h-full w-full object-contain" alt="" />
        )}

        {/* Sticker Renderer */}
        <StickerRenderer 
          stickers={currentStory.stickers || []} 
          onInteract={handleStickerInteract}
        />

        {/* MUSIC BAR (Requirement 7) */}
        {currentStory.music_info && (
            <motion.div 
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="absolute top-32 left-1/2 -translate-x-1/2 z-[60] w-[80%] max-w-[300px]"
            >
                <div className="bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[20px] p-3 flex items-center gap-4 shadow-2xl">
                    <div className="w-10 h-10 bg-rose-500 rounded-xl flex items-center justify-center text-[18px] animate-spin-slow">💿</div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-white font-black italic uppercase tracking-tighter text-[11px] truncate">{currentStory.music_info.title}</p>
                        <p className="text-white/50 text-[9px] font-bold truncate">{currentStory.music_info.artist}</p>
                    </div>
                </div>
            </motion.div>
        )}
      </div>

      {/* Caption Overlay (Only for non-text stories) */}
      {currentStory.caption && currentStory.media_type !== 'text' && (
        <div className="absolute bottom-32 left-0 right-0 p-12 text-center bg-gradient-to-t from-black/90 via-black/40 to-transparent z-20">
           <p className="text-white text-xl font-black italic tracking-tighter leading-snug drop-shadow-2xl animate-fade-in uppercase">{currentStory.caption}</p>
        </div>
      )}


      {/* Quick Interactions */}
      <div className="absolute bottom-8 left-0 right-0 px-8 flex items-center gap-6 z-30">
         <div className="flex-1 relative group">
           <input 
            type="text" 
            placeholder="Broadcast energy..." 
            className="w-full bg-white/10 border-2 border-white/10 rounded-[28px] h-16 px-8 text-sm font-black text-white placeholder:text-white/20 outline-none backdrop-blur-3xl focus:border-primary/50 focus:bg-white/20 transition-all uppercase tracking-widest italic" 
          />
           <button className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20 hover:scale-110 active:scale-90 transition-all">
              <Send size={18} strokeWidth={4} />
           </button>
         </div>
         <button className="w-16 h-16 rounded-[24px] bg-white/10 backdrop-blur-3xl border border-white/10 flex items-center justify-center text-2xl hover:scale-110 transition-all hover:bg-primary/20 shadow-xl">✨</button>
         <button className="w-16 h-16 rounded-[24px] bg-white/10 backdrop-blur-3xl border border-white/10 flex items-center justify-center text-2xl hover:scale-110 transition-all hover:bg-primary/20 shadow-xl">🚀</button>
      </div>

      {/* Navigation Touch Zones */}
      <div className="absolute inset-0 z-20 flex">
        <div 
          className="w-1/3 h-full cursor-pointer" 
          onClick={() => {
            if (currentIndex > 0) {
              setCurrentIndex(currentIndex - 1);
              setProgress(0);
            }
          }}
        ></div>
        <div 
          className="w-2/3 h-full cursor-pointer"
          onClick={() => {
            if (currentIndex < userStories.stories.length - 1) {
              setCurrentIndex(currentIndex + 1);
              setProgress(0);
            } else {
              navigate('/dashboard');
            }
          }}
        ></div>
      </div>

      {/* Add Yours Responses Modal */}
      <AnimatePresence>
        {showAddYoursResponses && addYoursData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 bg-black/80 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              className="bg-white w-full sm:max-w-[420px] rounded-t-[40px] sm:rounded-[40px] p-8 pb-12 flex flex-col shadow-2xl overflow-hidden max-h-[85vh]"
            >
               <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-8" />
               
               <div className="text-center mb-8">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-2 italic">Add Yours Prompt</p>
                  <h3 className="text-[24px] font-black italic uppercase tracking-tighter leading-none">{addYoursData.prompt.text}</h3>
               </div>

               <div className="flex-1 overflow-y-auto pr-2">
                  <div className="grid grid-cols-4 gap-4 mb-8">
                     {addYoursData.responses.map((res: any, i: number) => (
                        <div key={i} className="flex flex-col items-center gap-2 group cursor-pointer">
                           <div className="w-16 h-16 rounded-2xl bg-gray-100 overflow-hidden border-2 border-transparent group-hover:border-primary transition-all">
                              <img src={getAvatarUrl(res.avatar_url, res.username)} className="w-full h-full object-cover" alt="" />
                           </div>
                           <span className="text-[9px] font-black uppercase tracking-tighter italic truncate w-full text-center">{res.username}</span>
                        </div>
                     ))}
                     {addYoursData.responses.length === 0 && (
                        <div className="col-span-4 py-12 text-center opacity-30">
                           <Camera size={32} className="mx-auto mb-2" />
                           <p className="text-[10px] font-black uppercase italic">Be the first to respond</p>
                        </div>
                     )}
                  </div>
               </div>

               <div className="pt-6 flex flex-col gap-3">
                  <button 
                    onClick={() => {
                        setShowAddYoursResponses(false);
                        navigate(`/stories/create?prompt_id=${addYoursData.prompt.prompt_id}&prompt_text=${encodeURIComponent(addYoursData.prompt.text)}`);
                    }}
                    className="w-full py-6 bg-primary text-white font-black italic uppercase tracking-tight rounded-[28px] shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 active:scale-95 transition-all text-[16px]"
                  >
                    <Camera size={24} strokeWidth={4} /> Add Yours
                  </button>
                  <button onClick={() => setShowAddYoursResponses(false)} className="w-full py-4 bg-gray-100 text-gray-500 font-black italic uppercase tracking-tight rounded-[20px] hover:bg-gray-200 transition-all text-[12px]">
                    Maybe Later
                  </button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        .animate-spin-slow { animation: spin 15s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
