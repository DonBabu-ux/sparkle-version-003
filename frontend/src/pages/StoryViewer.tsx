import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/api';
import { X, Send, Orbit } from 'lucide-react';

interface Story {
  story_id: string;
  media_url: string;
  media_type: string;
  caption?: string;
  created_at: string;
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

  useEffect(() => {
    if (!userStories) return;

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
  }, [userStories, currentIndex, navigate]);

  if (loading) return (
    <div className="h-screen bg-black flex flex-col items-center justify-center gap-6">
       <Orbit size={48} strokeWidth={4} className="text-primary animate-spin-slow" />
       <p className="text-white font-black text-[10px] uppercase tracking-[0.4em] italic">Harmonizing Frequency...</p>
    </div>
  );

  if (!userStories) return null;

  const currentStory = userStories.stories[currentIndex];

  return (
    <div className="h-screen bg-black flex flex-col relative overflow-hidden">
      {/* Dynamic Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-primary/10 blur-[150px] pointer-events-none z-0"></div>

      {/* Progress Bars */}
      <div className="absolute top-6 left-6 right-6 z-30 flex gap-2">
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
      <div className="absolute top-14 left-8 right-8 z-30 flex items-center justify-between">
        <div className="flex items-center gap-4">
           <div className="p-0.5 rounded-2xl bg-white shadow-2xl border border-white/20 overflow-hidden">
              <img src={userStories.avatar_url || '/uploads/avatars/default.png'} className="w-12 h-12 rounded-xl object-cover" alt="" />
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
          <div className="w-full h-full flex items-center justify-center p-12 bg-gradient-to-br from-primary via-black to-black">
             <h2 className="text-white text-4xl md:text-7xl font-black text-center leading-none tracking-tighter uppercase italic drop-shadow-[0_0_30px_rgba(225,29,72,0.5)] animate-in zoom-in duration-700">
               {currentStory.caption}
             </h2>
          </div>
        ) : (
          <img src={currentStory.media_url} className="max-h-full w-full object-contain" alt="" />
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

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        .animate-spin-slow { animation: spin 15s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
