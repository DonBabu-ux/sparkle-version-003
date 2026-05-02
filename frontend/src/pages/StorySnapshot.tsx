import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, EyeOff, User, ArrowLeft, Heart, MessageSquare } from 'lucide-react';
import api from '../api/api';
import { getAvatarUrl } from '../utils/imageUtils';

interface StorySnapshot {
    story_id: string;
    user_id: string;
    username: string;
    user_name: string;
    avatar_url: string;
    media_url: string;
    created_at: string;
    like_count: number;
    is_expired: boolean;
}

export default function StorySnapshot() {
    const { storyId } = useParams();
    const navigate = useNavigate();
    const [story, setStory] = useState<StorySnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        const fetchStory = async () => {
            try {
                const response = await api.get(`/stories/single/${storyId}`);
                const data = response.data.story;

                if (!data.is_expired) {
                    // Story is still active, redirect to the normal viewer
                    navigate(`/stories/${data.user_id}`);
                } else {
                    setStory(data);
                }
            } catch (err) {
                console.error("Failed to fetch story snapshot:", err);
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        if (storyId) {
            fetchStory();
        }
    }, [storyId, navigate]);

    if (loading) {
        return (
            <div className="h-screen bg-black flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (error || !story) {
        return (
            <div className="h-screen bg-black flex flex-col items-center justify-center p-6">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
                    <EyeOff size={32} className="text-white/50" />
                </div>
                <h2 className="text-white font-bold text-xl mb-2">Content Unavailable</h2>
                <p className="text-white/50 text-center text-sm mb-8 max-w-xs">
                    This story has expired or been removed and is no longer available.
                </p>
                <button 
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-xl font-bold transition-all"
                >
                    <ArrowLeft size={18} /> Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background Blur */}
            <div 
                className="absolute inset-0 opacity-20 blur-3xl transform scale-110"
                style={{ 
                    backgroundImage: `url(${story.media_url || '/uploads/defaults/no-image.png'})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                }}
            />

            <button 
                onClick={() => navigate('/notifications')}
                className="absolute top-10 left-6 text-white p-3 bg-white/10 rounded-full backdrop-blur-md z-50 hover:bg-white/20 transition-all"
            >
                <ArrowLeft size={24} />
            </button>

            <div className="bg-[#111] border border-white/10 rounded-[32px] p-6 w-full max-w-sm relative z-10 shadow-2xl flex flex-col items-center">
                
                <div className="w-full flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full">
                        <Clock size={14} className="text-white/70" />
                        <span className="text-white/70 text-xs font-bold uppercase tracking-wider">Expired</span>
                    </div>
                </div>

                {/* Profile Snapshot */}
                <div className="relative mb-6">
                    <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-gray-700 to-gray-500">
                        <img 
                            src={getAvatarUrl(story.avatar_url, story.username)} 
                            alt={story.username}
                            className="w-full h-full rounded-full object-cover border-4 border-[#111]"
                        />
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-[#111] rounded-full flex items-center justify-center">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                            <Heart size={14} className="text-white fill-white" />
                        </div>
                    </div>
                </div>

                <h3 className="text-white font-black text-xl mb-1">{story.user_name}</h3>
                <p className="text-white/40 text-sm mb-6">@{story.username}</p>

                <div className="w-full bg-white/5 rounded-2xl p-4 mb-6">
                    <p className="text-white/80 text-sm text-center leading-relaxed">
                        This story was posted on <br/>
                        <span className="text-white font-bold">
                            {new Date(story.created_at).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                        <br/> and has now expired.
                    </p>
                    
                    <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-white/10">
                        <div className="flex items-center gap-2">
                            <Heart size={16} className="text-rose-500" />
                            <span className="text-white font-bold">{story.like_count}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MessageSquare size={16} className="text-white/50" />
                            <span className="text-white/50 font-bold">Replies hidden</span>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={() => navigate(`/profile/${story.user_id}`)}
                    className="w-full py-4 bg-white text-black rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                    <User size={18} /> View Profile
                </button>
            </div>
        </div>
    );
}
