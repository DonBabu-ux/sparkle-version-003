import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/api';

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
    }, 50); // 5 seconds total (100 * 50ms)

    return () => clearInterval(interval);
  }, [userStories, currentIndex, navigate]);

  if (loading) return (
    <div className="h-screen bg-black flex items-center justify-center text-white font-black uppercase tracking-widest text-xs">
       Synchronizing Buffer...
    </div>
  );

  if (!userStories) return null;

  const currentStory = userStories.stories[currentIndex];

  return (
    <div className="h-screen bg-black flex flex-col relative overflow-hidden">
      {/* Progress Bars */}
      <div className="absolute top-4 left-4 right-4 z-20 flex gap-1.5">
        {userStories.stories.map((_: Story, idx: number) => (
          <div key={idx} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
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
      <div className="absolute top-10 left-6 right-6 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
           <img src={userStories.avatar_url || '/uploads/avatars/default.png'} className="w-10 h-10 rounded-full border-2 border-white shadow-xl" alt="" />
           <div>
             <h4 className="text-white font-black text-sm shadow-sm">{userStories.user_name}</h4>
             <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">
               {new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
             </p>
           </div>
        </div>
        <button onClick={() => navigate('/dashboard')} className="text-white text-2xl p-2 hover:scale-110 transition-transform">✕</button>
      </div>

      {/* Media Content */}
      <div className="flex-1 flex items-center justify-center w-full">
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
          <div className="w-full h-full flex items-center justify-center p-12 bg-gradient-to-br from-[#6366f1] via-[#a855f7] to-[#ec4899]">
             <h2 className="text-white text-3xl md:text-5xl font-black text-center leading-tight drop-shadow-2xl animate-in zoom-in duration-500">
               {currentStory.caption}
             </h2>
          </div>
        ) : (
          <img src={currentStory.media_url} className="max-h-full w-full object-contain" alt="" />
        )}
      </div>

      {/* Caption Overlay (Only for non-text stories) */}
      {currentStory.caption && currentStory.media_type !== 'text' && (
        <div className="absolute bottom-20 left-0 right-0 p-8 text-center bg-gradient-to-t from-black/80 to-transparent z-20">
           <p className="text-white text-lg font-bold drop-shadow-lg">{currentStory.caption}</p>
        </div>
      )}


      {/* Quick Interactions */}
      <div className="absolute bottom-6 left-0 right-0 px-8 flex items-center gap-4">
         <div className="flex-1 relative">
           <input type="text" placeholder="Send reaction..." className="w-full bg-white/10 border border-white/20 rounded-full py-3 px-6 text-sm text-white placeholder:text-white/40 outline-none backdrop-blur-md" />
         </div>
         <button className="text-2xl filter drop-shadow-lg">✨</button>
         <button className="text-2xl filter drop-shadow-lg">🚀</button>
      </div>

      {/* Navigation Touch Zones */}
      <div className="absolute inset-0 z-10 flex">
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
    </div>
  );
}
