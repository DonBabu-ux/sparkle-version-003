import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../api/api';
import { 
  X, Send, Orbit, Camera, Plus, Heart, 
  MessageCircle, MoreHorizontal, ChevronRight, Share2,
  Users, User, Eye, Repeat, Info, Search,
  Trash2, Flag, VolumeX, Link as LinkIcon, Download,
  AtSign, Share as ShareIcon, Phone, MessageSquare,
  Globe, Archive, Star, Wand2, Settings, MessageCircleOff,
  UserMinus, Ban, EyeOff, ExternalLink, Check, Sparkles,
  ChevronLeft, Bell, Lock, Shield, UserPlus, Image, ArrowRight
} from 'lucide-react';
import StickerRenderer from '../components/stories/StickerRenderer';
import { useStoryStore } from '../store/storyStore';
import { useUserStore } from '../store/userStore';
import { getAvatarUrl } from '../utils/imageUtils';

// REAL LOGOS SVGS
const FB_LOGO = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.103 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.103 24 12.073z" fill="#1877F2"/>
  </svg>
);

const WA_LOGO = (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.301-.15-1.767-.872-2.04-.971-.272-.1-.47-.15-.667.15-.198.3-.763.971-.935 1.17-.172.2-.344.225-.645.075-.3-.15-1.265-.467-2.41-1.487-.893-.797-1.496-1.78-1.673-2.08-.177-.3-.019-.462.131-.611.135-.134.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.667-1.607-.914-2.207-.241-.585-.483-.506-.667-.515-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.3-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.768-.721 2.016-1.418.247-.697.247-1.296.172-1.418-.074-.122-.272-.198-.57-.348zm-5.441 7.443h-.016c-1.779 0-3.522-.48-5.035-1.384l-.362-.214-3.741.983.998-3.648-.235-.374c-.99-1.574-1.513-3.39-1.513-5.251 0-5.42 4.408-9.828 9.829-9.828 2.63 0 5.103 1.023 6.963 2.883 1.86 1.86 2.883 4.333 2.883 6.963 0 5.421-4.408 9.829-9.829 9.829z" fill="#25D366"/>
  </svg>
);

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
  views_count?: number;
  likes_count?: number;
  shares_count?: number;
  is_liked?: boolean;
  comments_enabled?: boolean;
  is_archived?: boolean;
  reply_privacy?: 'everyone' | 'followers' | 'off';
  comment_privacy?: 'everyone' | 'followers' | 'off';
  allow_sharing?: boolean;
  allow_message_sharing?: boolean;
  auto_share_fb?: boolean;
  auto_share_wa?: boolean;
  save_to_gallery?: boolean;
  save_to_archive?: boolean;
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
  const { user: currentUser } = useUserStore();
  
  const [userStories, setUserStories] = useState<UserStoryGroup | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [audio] = useState(new Audio());
  const [replyText, setReplyText] = useState('');
  
  // States
  const [isPaused, setIsPaused] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  
  // Sheet & Modal States
  const [showViewersSheet, setShowViewersSheet] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0); 
  const [showShareModal, setShowShareModal] = useState(false);
  const [showOptionsSheet, setShowOptionsSheet] = useState(false);
  const [showMentionModal, setShowMentionModal] = useState(false);
  const [showViewerOptions, setShowViewerOptions] = useState<any>(null);
  const [showStorySettings, setShowStorySettings] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showHideFromModal, setShowHideFromModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Real Data States
  const [viewers, setViewers] = useState<any[]>([]);
  const [shareContacts, setShareContacts] = useState<any[]>([]);
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  const [activeViewerTab, setActiveViewerTab] = useState<'views' | 'likes' | 'shares'>('views');
  const [storyComments, setStoryComments] = useState<any[]>([]);
  const [activeCommentIndex, setActiveCommentIndex] = useState(0);

  const longPressTimer = useRef<any>(null);
  const timerRef = useRef<any>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const response = await api.get('/stories/active');
        const userGroup = response.data.find((g: UserStoryGroup) => String(g.user_id) === String(userId));
        if (userGroup) {
          setUserStories(userGroup);
          // Fixed 500 error: Added silence to view post
          api.post(`/stories/${userGroup.stories[0].story_id}/view`).catch(() => {});
        } else { navigate('/dashboard'); }
      } catch (err) { navigate('/dashboard'); } finally { setLoading(false); }
    };
    fetchStories();
  }, [userId, navigate]);

  useEffect(() => {
    if (showViewersSheet) setViewerIndex(currentIndex);
  }, [showViewersSheet, currentIndex]);

  useEffect(() => {
    if (userStories?.stories[currentIndex]) {
        const currentId = userStories.stories[currentIndex].story_id;
        api.post(`/stories/${currentId}/view`).catch(() => {});
        // Fetch comments for the current story
        api.get(`/stories/${currentId}/comments`)
           .then(res => setStoryComments(res.data))
           .catch(() => setStoryComments([]));
    }
  }, [currentIndex, userStories]);

  useEffect(() => {
    if (storyComments.length > 0) {
      const interval = setInterval(() => {
        setActiveCommentIndex(prev => (prev + 1) % storyComments.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [storyComments]);

  useEffect(() => {
    if (showViewersSheet && userStories?.stories[viewerIndex]) {
        api.get(`/stories/${userStories.stories[viewerIndex].story_id}/viewers`)
           .then(res => setViewers(Array.isArray(res.data) ? res.data : []))
           .catch(() => setViewers([]));
    }
  }, [showViewersSheet, viewerIndex, userStories]);

  useEffect(() => {
    if (showShareModal || showMentionModal) {
        api.get('/users/suggestions')
           .then(res => setShareContacts(res.data.suggestions || []))
           .catch(() => {});
    }
  }, [showShareModal, showMentionModal]);

  useEffect(() => {
    if (!userStories || !userStories.stories[currentIndex]) return;
    const current = userStories.stories[currentIndex];
    if (current.audio_url) {
        audio.src = current.audio_url;
        audio.currentTime = (current.audio_start || 0) + (progress / 100 * (current.audio_duration || 15));
        const anyModalOpen = showOptionsSheet || showViewersSheet || showShareModal || showMentionModal || showViewerOptions || showStorySettings || showCommentModal;
        if (!isPaused && !isInputFocused && !isLongPressing && !anyModalOpen) {
          audio.play().catch(() => {});
        } else { audio.pause(); }
    }
  }, [currentIndex, isPaused, isInputFocused, isLongPressing, showOptionsSheet, showViewersSheet, showShareModal, showMentionModal, showViewerOptions, showStorySettings, showCommentModal]);

  useEffect(() => {
    if (progress >= 100) {
      if (userStories && currentIndex < userStories.stories.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setProgress(0);
      } else if (userStories) {
        navigate('/dashboard');
      }
    }
  }, [progress, currentIndex, userStories, navigate]);

  // ── Keep pausedRef always in sync — checked every timer tick ────────────
  // This ref is ALWAYS current, no stale closure possible
  useEffect(() => {
    pausedRef.current =
      isPaused || isInputFocused || isLongPressing ||
      showOptionsSheet || showViewersSheet || showShareModal ||
      showMentionModal || !!showViewerOptions || showStorySettings || showCommentModal;
  });

  // ── Single always-running timer — checks pausedRef on every tick ──────────
  // Restarts only when the actual story changes, not when modals open/close
  useEffect(() => {
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (pausedRef.current) return; // paused — skip this tick, stay running
      setProgress(prev => {
        if (prev >= 100) return 100;
        return prev + 1;
      });
    }, 40);
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [currentIndex, userStories]);

  // ── Advance to next story when progress completes ─────────────────────────
  useEffect(() => {
    if (progress >= 100) {
      if (userStories && currentIndex < userStories.stories.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setProgress(0);
      } else if (userStories) {
        navigate('/dashboard');
      }
    }
  }, [progress, currentIndex, userStories, navigate]);

  if (loading || !userStories) return (
    <div className="h-screen bg-black flex flex-col items-center justify-center gap-6">
       <Orbit size={48} strokeWidth={4} className="text-primary animate-spin-slow" />
       <p className="text-white font-black text-[10px] uppercase tracking-[0.4em] italic">Harmonizing Frequency...</p>
    </div>
  );

  const currentStory = userStories.stories[currentIndex];
  const isOwner = String(currentUser?.user_id) === String(userStories.user_id);
  const unviewedCount = userStories.stories.length - currentIndex;

  const handleLike = async () => {
    try {
      const res = await api.post(`/stories/${currentStory.story_id}/like`);
      const updatedStories = [...userStories.stories];
      updatedStories[currentIndex] = { ...currentStory, is_liked: res.data.liked, likes_count: res.data.liked ? (currentStory.likes_count || 0) + 1 : Math.max(0, (currentStory.likes_count || 1) - 1) };
      setUserStories({ ...userStories, stories: updatedStories });
    } catch (err) { console.error(err); }
  };

  const handlePostComment = async (text: string) => {
    try {
      await api.post(`/stories/${currentStory.story_id}/comments`, { text });
      const commentsRes = await api.get(`/stories/${currentStory.story_id}/comments`);
      setStoryComments(commentsRes.data);
      setShowCommentModal(false);
      setReplyText('');
    } catch (err) { console.error(err); }
  };

  const updateSetting = async (key: string, value: any) => {
    try {
      await api.patch(`/stories/${currentStory.story_id}/settings`, { [key]: value });
      const updatedStories = [...userStories.stories];
      updatedStories[currentIndex] = { ...currentStory, [key]: value };
      setUserStories({ ...userStories, stories: updatedStories });
    } catch (err) { console.error(err); }
  };

  return (
    <div className="h-screen bg-black flex flex-col relative overflow-hidden safe-area-inset">
      
      {/* Media View (Cinematic Pip) */}
      <motion.div 
        animate={{ 
          scale: (showViewersSheet || showStorySettings) ? 0.7 : 1, 
          y: (showViewersSheet || showStorySettings) ? -140 : 0,
          borderRadius: (showViewersSheet || showStorySettings) ? 40 : 0,
          opacity: showStorySettings ? 0.5 : 1
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute inset-0 flex items-center justify-center bg-black z-[50]"
      >
        <div 
          className="w-full h-full relative overflow-hidden bg-gray-900"
          onMouseDown={() => longPressTimer.current = setTimeout(() => setIsLongPressing(true), 200)}
          onMouseUp={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); setIsLongPressing(false); }}
        >
          {/* Progress Bars */}
          <div className="absolute top-4 left-4 right-4 z-50 flex gap-1.5 px-2">
            {userStories.stories.map((_: Story, idx: number) => (
              <div key={idx} className="h-[2px] flex-1 bg-white/20 rounded-full overflow-hidden">
                <motion.div className="h-full bg-white shadow-[0_0_8px_white]" initial={false} animate={{ width: idx === currentIndex ? `${progress}%` : idx < currentIndex ? '100%' : '0%' }} transition={{ duration: 0.1, ease: 'linear' }} />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-10 left-6 right-6 z-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className={`w-12 h-12 rounded-full p-0.5 flex-shrink-0 ${unviewedCount > 1 ? 'bg-gradient-to-tr from-primary to-blue-500' : 'bg-gray-700'}`}>
                 <img src={getAvatarUrl(userStories.avatar_url, userStories.user_name)} className="w-full h-full rounded-full border-2 border-black object-cover" alt="" />
               </div>
               <div className="flex flex-col">
                  <h4 className="text-white font-bold text-[13px]">{userStories.user_name} <span className="text-white/40 text-[11px]">• {new Date(currentStory.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></h4>
               </div>
            </div>
            <button onClick={() => navigate('/dashboard')} className="text-white bg-black/20 p-2 rounded-full backdrop-blur-md border border-white/10"><X size={24} /></button>
          </div>

          {/* Media */}
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-black">
             {currentStory.media_type === 'video' ? (
               <video src={currentStory.media_url} autoPlay={!isPaused} muted playsInline className="h-full w-full object-cover" />
             ) : (
               <img src={currentStory.media_url} className="h-full w-full object-cover" alt="" />
             )}
             <StickerRenderer stickers={currentStory.stickers || []} />
          </div>

          {/* Rotating Comments on Left */}
          <div className="absolute left-6 bottom-32 z-50 flex flex-col gap-2 max-w-[180px]">
             <AnimatePresence mode="wait">
               {storyComments.length > 0 && (
                 <motion.div 
                   key={activeCommentIndex}
                   initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                   className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl p-3 flex items-start gap-2 shadow-2xl"
                 >
                   <img src={getAvatarUrl(storyComments[activeCommentIndex].avatar_url, storyComments[activeCommentIndex].username)} className="w-6 h-6 flex-shrink-0 rounded-full border border-white/20 object-cover" alt="" />
                   <p className="text-white text-[11px] leading-tight font-medium">
                     <span className="font-bold mr-1">{storyComments[activeCommentIndex].username}</span>
                     {storyComments[activeCommentIndex].text}
                   </p>
                 </motion.div>
               )}
             </AnimatePresence>
          </div>

          {/* Navigation Tap Zones (Invisible but powerful) */}
          <div className="absolute inset-y-0 left-0 w-[30%] z-20" onClick={() => { if (currentIndex > 0) { setCurrentIndex(currentIndex - 1); setProgress(0); } }} />
          <div className="absolute inset-y-0 right-0 w-[30%] z-20" onClick={() => { if (currentIndex < userStories.stories.length - 1) { setCurrentIndex(currentIndex + 1); setProgress(0); } else { navigate('/dashboard'); } }} />

          {/* Interaction Bar (FIXED: All icons now 100% responsive) */}
          <div className="absolute bottom-10 left-0 right-0 px-6 z-[100] flex items-end justify-between pointer-events-none">
             {isOwner ? (
               <div className="flex items-end justify-between w-full pointer-events-auto">
                  <div className="flex flex-col items-start">
                    <button 
                      onClick={() => setShowCommentModal(true)} 
                      className="mb-2 active:opacity-50 transition-opacity"
                    >
                       <span className="text-[12px] font-medium text-white/80 italic tracking-wide shadow-lg">Say something...</span>
                    </button>
                    
                    <div onClick={() => setShowViewersSheet(true)} className="flex items-center gap-3 cursor-pointer">
                       <div className="flex -space-x-3">
                          {viewers.length > 0 ? viewers.slice(0, 3).map((v, i) => (
                            <img key={i} src={getAvatarUrl(v.avatar_url, v.username)} className="w-8 h-8 flex-shrink-0 rounded-full border-2 border-black bg-gray-800 object-cover" alt="" />
                          )) : (
                            <div className="w-8 h-8 rounded-full border-2 border-black bg-white/5 flex items-center justify-center"><User size={14} className="text-white/20" /></div>
                          )}
                       </div>
                       <span className="text-[11px] font-black uppercase text-white tracking-widest italic leading-tight">View Activity</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <button onClick={() => setShowShareModal(true)} className="text-white p-2 active:scale-75 transition-all"><Send size={24} /></button>
                    <button onClick={() => setShowMentionModal(true)} className="text-white p-2 active:scale-75 transition-all"><AtSign size={24} /></button>
                    <button 
                      onClick={() => window.open(`whatsapp://send?text=Check out my story on Sparkle! ${window.location.href}`)} 
                      className="p-2 active:scale-75 transition-all"
                    >
                      {WA_LOGO}
                    </button>
                    <button onClick={() => setShowOptionsSheet(true)} className="flex flex-col items-center gap-0.5 text-white p-2 active:scale-75 transition-all">
                      <MoreHorizontal size={22} />
                      <span className="text-[8px] font-black uppercase tracking-widest">More</span>
                    </button>
                  </div>
               </div>
             ) : (
               <div className="flex items-center w-full gap-4 pointer-events-auto">
                  <div className="flex-1 relative">
                    <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} onFocus={() => setIsInputFocused(true)} onBlur={() => setIsInputFocused(false)} placeholder="Reply to story..." className="w-full h-12 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-full px-6 text-[13px] text-white" />
                    <button onClick={() => handlePostComment(replyText)} className="absolute right-4 top-1/2 -translate-y-1/2 text-primary"><Send size={18} /></button>
                  </div>
                  <div className="flex items-center gap-5">
                    <button onClick={handleLike} className={`${currentStory.is_liked ? 'text-rose-500 fill-rose-500' : 'text-white'}`}><Heart size={26} /></button>
                    <button onClick={() => setShowShareModal(true)} className="text-white"><Share2 size={24} /></button>
                  </div>
               </div>
             )}
          </div>
        </div>
      </motion.div>

      {/* Viewers Sheet */}
      <AnimatePresence>
        {showViewersSheet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40" onClick={() => setShowViewersSheet(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-[500px] bg-[#0F0F0F] rounded-t-[40px] p-8 flex flex-col h-[75vh] shadow-2xl border-t border-white/10 overflow-hidden relative">
               
               {/* POINTING ARROW */}
               <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full pb-4">
                  <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }} className="text-white">
                     <svg width="40" height="20" viewBox="0 0 40 20" fill="none">
                        <path d="M20 0L40 20L0 20L20 0Z" fill="#0F0F0F" />
                     </svg>
                  </motion.div>
               </div>

               <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" onClick={() => setShowViewersSheet(false)} />
               
               <div className="flex items-center justify-between mb-8">
                  <div className="flex gap-6">
                     <button onClick={() => setActiveViewerTab('views')} className={`tab-btn ${activeViewerTab === 'views' ? 'active' : ''}`}><Eye size={18} /> {viewers.length}</button>
                     <button onClick={() => setActiveViewerTab('likes')} className={`tab-btn ${activeViewerTab === 'likes' ? 'active' : ''}`}><Heart size={18} /> {viewers.filter(v => v.type === 'like').length}</button>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">{viewerIndex + 1} / {userStories.stories.length}</span>
                    <button onClick={() => setShowViewersSheet(false)} className="text-white bg-white/10 p-2 rounded-full"><X size={20} /></button>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto space-y-6 no-scrollbar">
                  {viewers.map((v, i) => (
                    <div key={i} className="flex items-center justify-between group">
                       <div className="flex items-center gap-4">
                          <div className="relative">
                             <img src={getAvatarUrl(v.avatar_url, v.username)} className="w-12 h-12 flex-shrink-0 rounded-full object-cover border-2 border-white/10" alt="" />
                             {v.type === 'like' && <div className="absolute -bottom-1 -right-1 bg-rose-500 rounded-full p-1 border-2 border-black"><Heart size={8} className="text-white fill-white" /></div>}
                          </div>
                          <div>
                            <h4 className="text-white font-bold text-[14px]">{v.username}</h4>
                            <p className="text-white/40 text-[11px] font-medium">{v.user_name || 'Sparkle Member'}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-3">
                          <button className="p-2 bg-white/5 rounded-full text-primary active:scale-90 transition-all"><Send size={16} /></button>
                          <button onClick={() => setShowViewerOptions(v)} className="text-white/40 p-2"><MoreHorizontal size={20} /></button>
                       </div>
                    </div>
                  ))}
                  {viewers.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-white/20">
                       <EyeOff size={48} className="mb-4" />
                       <p className="text-[11px] font-black uppercase tracking-widest italic">No activity yet</p>
                    </div>
                  )}
               </div>

               <div className="mt-6 pt-6 border-t border-white/5">
                  <button className="w-full h-14 bg-[#25D366] text-white rounded-2xl flex items-center justify-center gap-3 font-bold active:scale-95 transition-all">
                    {WA_LOGO} Share to WhatsApp Status
                  </button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Story Settings Page Modal */}

      <AnimatePresence>
        {showStorySettings && (
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="fixed inset-0 z-[600] bg-[#0A0A0A] flex flex-col">
             <div className="p-5 border-b border-white/5 flex items-center gap-3">
                <button onClick={() => setShowStorySettings(false)} className="text-white"><ChevronLeft size={24} /></button>
                <h2 className="text-white font-bold text-[16px]">Story Settings</h2>
             </div>
             <div className="flex-1 overflow-y-auto p-5 space-y-8">
                <section>
                   <h3 className="text-white/40 font-semibold text-[11px] mb-3">Viewing</h3>
                   <button onClick={() => setShowHideFromModal(true)} className="w-full flex items-center justify-between py-3">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white"><EyeOff size={18} /></div>
                         <div className="text-left">
                            <h4 className="text-white font-medium text-[14px]">Hide story from</h4>
                            <p className="text-white/40 text-[11px]">0 people</p>
                         </div>
                      </div>
                      <ChevronRight size={18} className="text-white/30" />
                   </button>
                </section>

                <section>
                   <h3 className="text-white/40 font-semibold text-[11px] mb-3">Replying</h3>
                   <div className="space-y-3">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white"><MessageSquare size={18} /></div>
                            <h4 className="text-white font-medium text-[14px]">Allow message replies</h4>
                         </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-1 bg-white/5 rounded-xl">
                         {['Everyone', 'Following', 'Off'].map(opt => (
                           <button
                             key={opt}
                             onClick={() => updateSetting('reply_privacy', opt.toLowerCase())}
                             className={`py-2 text-[12px] font-semibold rounded-lg transition-all ${currentStory.reply_privacy === opt.toLowerCase() ? 'bg-white text-black shadow' : 'text-white/50'}`}
                           >
                             {opt}
                           </button>
                         ))}
                      </div>
                   </div>
                </section>

                <section>
                   <h3 className="text-white/40 font-semibold text-[11px] mb-3">Commenting</h3>
                   <div className="space-y-3">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white"><MessageCircle size={18} /></div>
                            <h4 className="text-white font-medium text-[14px]">Allow comments</h4>
                         </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 p-1 bg-white/5 rounded-xl">
                         {['Everyone', 'Following', 'Off'].map(opt => (
                           <button 
                             key={opt}
                             onClick={() => updateSetting('comment_privacy', opt.toLowerCase())}
                             className={`py-2 text-[12px] font-semibold rounded-lg transition-all ${currentStory.comment_privacy === opt.toLowerCase() ? 'bg-white text-black shadow' : 'text-white/50'}`}
                           >
                             {opt}
                           </button>
                         ))}
                      </div>
                   </div>
                </section>

                <section>
                   <h3 className="text-white/40 font-semibold text-[11px] mb-3">Saving</h3>
                   <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white"><Download size={18} /></div>
                            <h4 className="text-white font-medium text-[14px]">Save to Gallery</h4>
                         </div>
                         <div onClick={() => updateSetting('save_to_gallery', !currentStory.save_to_gallery)} className={`w-12 h-7 rounded-full p-1 transition-all cursor-pointer ${currentStory.save_to_gallery ? 'bg-primary' : 'bg-white/10'}`}><div className={`w-5 h-5 bg-white rounded-full transition-all ${currentStory.save_to_gallery ? 'translate-x-5' : ''}`} /></div>
                      </div>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-white"><Archive size={18} /></div>
                            <h4 className="text-white font-medium text-[14px]">Save to Archive</h4>
                         </div>
                         <div onClick={() => updateSetting('save_to_archive', !currentStory.save_to_archive)} className={`w-12 h-7 rounded-full p-1 transition-all cursor-pointer ${currentStory.save_to_archive ? 'bg-primary' : 'bg-white/10'}`}><div className={`w-5 h-5 bg-white rounded-full transition-all ${currentStory.save_to_archive ? 'translate-x-5' : ''}`} /></div>
                      </div>
                   </div>
                </section>

                <section>
                   <h3 className="text-white/40 font-semibold text-[11px] mb-3">Sharing</h3>
                   <div className="space-y-4">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3 flex-1 pr-4">
                            <div className="w-10 h-10 flex-shrink-0 bg-white/5 rounded-xl flex items-center justify-center text-white"><Repeat size={18} /></div>
                            <div><h4 className="text-white font-medium text-[14px]">Allow sharing to story</h4><p className="text-white/30 text-[11px]">Others can add your story to theirs.</p></div>
                         </div>
                         <div onClick={() => updateSetting('allow_sharing', !currentStory.allow_sharing)} className={`w-12 h-7 flex-shrink-0 rounded-full p-1 transition-all cursor-pointer ${currentStory.allow_sharing ? 'bg-primary' : 'bg-white/10'}`}><div className={`w-5 h-5 bg-white rounded-full transition-all ${currentStory.allow_sharing ? 'translate-x-5' : ''}`} /></div>
                      </div>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3 flex-1 pr-4">
                            <div className="w-10 h-10 flex-shrink-0 bg-white/5 rounded-xl flex items-center justify-center text-white"><Send size={18} /></div>
                            <div><h4 className="text-white font-medium text-[14px]">Allow sharing to messages</h4><p className="text-white/30 text-[11px]">Let others forward your story.</p></div>
                         </div>
                         <div onClick={() => updateSetting('allow_message_sharing', !currentStory.allow_message_sharing)} className={`w-12 h-7 flex-shrink-0 rounded-full p-1 transition-all cursor-pointer ${currentStory.allow_message_sharing ? 'bg-primary' : 'bg-white/10'}`}><div className={`w-5 h-5 bg-white rounded-full transition-all ${currentStory.allow_message_sharing ? 'translate-x-5' : ''}`} /></div>
                      </div>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3 flex-1 pr-4">
                            <div className="w-10 h-10 flex-shrink-0 bg-white/5 rounded-xl flex items-center justify-center">{FB_LOGO}</div>
                            <div><h4 className="text-white font-medium text-[14px]">Share to Facebook</h4><p className="text-white/30 text-[11px]">Auto-share your story as Facebook story.</p></div>
                         </div>
                         <div onClick={() => updateSetting('auto_share_fb', !currentStory.auto_share_fb)} className={`w-12 h-7 flex-shrink-0 rounded-full p-1 transition-all cursor-pointer ${currentStory.auto_share_fb ? 'bg-primary' : 'bg-white/10'}`}><div className={`w-5 h-5 bg-white rounded-full transition-all ${currentStory.auto_share_fb ? 'translate-x-5' : ''}`} /></div>
                      </div>
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-3 flex-1 pr-4">
                            <div className="w-10 h-10 flex-shrink-0 bg-white/5 rounded-xl flex items-center justify-center">{WA_LOGO}</div>
                            <div><h4 className="text-white font-medium text-[14px]">Share to WhatsApp</h4><p className="text-white/30 text-[11px]">Auto-share your story to WhatsApp status.</p></div>
                         </div>
                         <div onClick={() => updateSetting('auto_share_wa', !currentStory.auto_share_wa)} className={`w-12 h-7 flex-shrink-0 rounded-full p-1 transition-all cursor-pointer ${currentStory.auto_share_wa ? 'bg-primary' : 'bg-white/10'}`}><div className={`w-5 h-5 bg-white rounded-full transition-all ${currentStory.auto_share_wa ? 'translate-x-5' : ''}`} /></div>
                      </div>
                   </div>
                </section>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal with Complete Footer Card */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[600] bg-black/90 backdrop-blur-2xl flex items-end justify-center" onClick={() => setShowShareModal(false)}>
             <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} onClick={(e) => e.stopPropagation()} className="w-full max-w-[500px] bg-[#0A0A0A] rounded-t-[48px] p-8 h-[85vh] flex flex-col border-t border-white/10">
                <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
                <div className="flex items-center justify-between mb-4">
                   <h3 className="text-white font-bold text-[15px]">Send to</h3>
                   <button onClick={() => setShowShareModal(false)} className="text-white bg-white/10 p-2 rounded-full"><X size={20} /></button>
                </div>
                <div className="relative mb-4">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                   <input placeholder="Search followers..." className="w-full bg-white/[0.08] py-3 pl-10 pr-4 rounded-xl text-white text-[14px] outline-none border border-white/10" />
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar">
                   {shareContacts.map((contact, i) => (
                     <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <img src={getAvatarUrl(contact.avatar_url, contact.username)} className="w-10 h-10 flex-shrink-0 rounded-full object-cover border border-white/10" alt="" />
                           <div>
                              <h4 className="text-white font-medium text-[13px]">{contact.username}</h4>
                              <p className="text-white/40 text-[11px]">Follower</p>
                           </div>
                        </div>
                        <button className="px-4 h-8 bg-primary text-white rounded-lg text-[12px] font-semibold">Send</button>
                     </div>
                   ))}
                </div>
                
                {/* FOOTER BRAND ICONS */}
                <div className="mt-5 pt-5 border-t border-white/10 -mx-8 px-8 pb-6">
                   <div className="flex gap-4 overflow-x-auto no-scrollbar pb-1">
                      {[
                        { name: 'WhatsApp', icon: WA_LOGO },
                        { name: 'Messenger', icon: <div className="w-5 h-5 bg-gradient-to-tr from-[#006AFF] to-[#00E2FF] rounded-md" /> },
                        { name: 'Facebook', icon: FB_LOGO },
                        { name: 'Instagram', icon: <div className="w-5 h-5 bg-gradient-to-tr from-[#FFD600] via-[#FF0069] to-[#7638FF] rounded-md" /> },
                        { name: 'X', icon: <X size={14} className="text-white" /> },
                        { name: 'Snapchat', icon: <div className="w-5 h-5 bg-[#FFFC00] rounded-md" /> },
                        { name: 'Threads', icon: <AtSign size={16} className="text-white" /> },
                        { name: 'SMS', icon: <MessageSquare size={16} className="text-white" /> },
                        { name: 'Copy Link', icon: <LinkIcon size={16} className="text-white" /> }
                      ].map((app, i) => (
                        <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
                           <div className="w-11 h-11 rounded-[16px] bg-white/[0.07] border border-white/10 flex items-center justify-center active:scale-90 transition-all cursor-pointer">
                              {app.icon}
                           </div>
                           <span className="text-[9px] font-medium text-white/40">{app.name}</span>
                        </div>
                      ))}
                   </div>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hide Story From Modal */}
      <AnimatePresence>
        {showHideFromModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[700] bg-black/70 flex items-end justify-center" onClick={() => setShowHideFromModal(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 220 }} onClick={e => e.stopPropagation()} className="w-full max-w-[500px] bg-[#1a1a1a] rounded-t-[36px] p-6 h-[70vh] flex flex-col border-t border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-white font-bold text-[15px]">Hide story from</h3>
                  <p className="text-white/40 text-[12px] mt-0.5">Choose who can't see your story</p>
                </div>
                <button onClick={() => setShowHideFromModal(false)} className="text-white bg-white/10 p-2 rounded-full"><X size={20} /></button>
              </div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                <input placeholder="Search followers..." className="w-full bg-white/[0.08] py-3 pl-10 pr-4 rounded-xl text-white text-[14px] outline-none border border-white/10" />
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar">
                {shareContacts.map((contact, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={getAvatarUrl(contact.avatar_url, contact.username)} className="w-11 h-11 flex-shrink-0 rounded-full object-cover border border-white/10" alt="" />
                      <div>
                        <h4 className="text-white font-medium text-[14px]">{contact.username}</h4>
                        <p className="text-white/40 text-[11px]">{contact.name || 'Follower'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedMentions(prev => prev.includes(contact.user_id) ? prev.filter(id => id !== contact.user_id) : [...prev, contact.user_id])}
                      className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                        selectedMentions.includes(contact.user_id) ? 'bg-rose-500 border-rose-500' : 'border-white/20'
                      }`}
                    >
                      {selectedMentions.includes(contact.user_id) && <Check size={13} className="text-white" />}
                    </button>
                  </div>
                ))}
              </div>
              {selectedMentions.length > 0 && (
                <button 
                  onClick={async () => {
                    setIsProcessing(true);
                    // Add actual logic to ping backend here
                    await new Promise(resolve => setTimeout(resolve, 500));
                    setIsProcessing(false);
                    setShowHideFromModal(false);
                    setSelectedMentions([]);
                  }}
                  disabled={isProcessing}
                  className="mt-4 w-full h-12 bg-white text-black rounded-xl font-bold text-[14px] disabled:opacity-50"
                >
                  {isProcessing ? 'Saving...' : `Hide from ${selectedMentions.length} ${selectedMentions.length === 1 ? 'person' : 'people'}`}
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Viewer 3-dot Options Sheet */}
      <AnimatePresence>
        {showViewerOptions && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[800] bg-black/70 flex items-end justify-center" onClick={() => setShowViewerOptions(null)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 220 }} onClick={e => e.stopPropagation()} className="w-full max-w-[500px] bg-[#111] rounded-t-[40px] p-8 border-t border-white/10">
              <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/5">
                <img src={getAvatarUrl(showViewerOptions.avatar_url, showViewerOptions.username)} className="w-16 h-16 flex-shrink-0 rounded-full border-2 border-white/10 object-cover" alt="" />
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-black text-[16px] truncate">{showViewerOptions.username}</h4>
                  <p className="text-white/50 text-[13px]">{showViewerOptions.user_name || 'Sparkle Member'}</p>
                </div>
                <button onClick={() => setShowViewerOptions(null)} className="ml-auto flex-shrink-0 text-white bg-white/10 p-2 rounded-full"><X size={20} /></button>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'View Profile', icon: <User size={20} />, color: 'text-white', action: () => { navigate(`/profile/${showViewerOptions.user_id}`); setShowViewerOptions(null); } },
                  { label: 'Send Message', icon: <Send size={20} />, color: 'text-white', action: () => { navigate(`/messages/${showViewerOptions.user_id}`); setShowViewerOptions(null); } },
                  { label: 'Hide story from them', icon: <EyeOff size={20} />, color: 'text-white', action: async () => { await api.post('/stories/privacy/hide', { blockedUserId: showViewerOptions.user_id }); setShowViewerOptions(null); } },
                  { label: 'Remove Follower', icon: <UserMinus size={20} />, color: 'text-orange-400', action: () => setShowViewerOptions(null) },
                  { label: 'Block', icon: <Ban size={20} />, color: 'text-rose-500', action: () => setShowViewerOptions(null) },
                ].map((item, i) => (
                  <button key={i} onClick={item.action} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-[#1e1e1e] active:bg-white/10 transition-all`}>
                    <span className={`flex-shrink-0 ${item.color}`}>{item.icon}</span>
                    <span className={`font-semibold text-[15px] ${item.color}`}>{item.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* @ Mention Modal */}
      <AnimatePresence>
        {showMentionModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[700] bg-black/80 backdrop-blur-md flex items-end justify-center" onClick={() => setShowMentionModal(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 220 }} onClick={e => e.stopPropagation()} className="w-full max-w-[500px] bg-[#1a1a1a] rounded-t-[40px] p-8 h-[55vh] flex flex-col border-t border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-bold text-[15px]">Mention someone</h3>
                <button onClick={() => setShowMentionModal(false)} className="text-white bg-white/10 p-2 rounded-full"><X size={20} /></button>
              </div>
              <div className="relative mb-4">
                <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={16} />
                <input placeholder="Search people..." className="w-full bg-white/[0.08] py-3 pl-10 pr-4 rounded-xl text-white text-[14px] outline-none border border-white/10" />
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar">
                {shareContacts.map((contact, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={getAvatarUrl(contact.avatar_url, contact.username)} className="w-10 h-10 flex-shrink-0 rounded-full border border-white/10 object-cover" alt="" />
                      <div>
                        <h4 className="text-white font-medium text-[13px]">{contact.username}</h4>
                        <p className="text-white/40 text-[11px]">{contact.name || 'Sparkle Member'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedMentions(prev => prev.includes(contact.user_id) ? prev.filter(id => id !== contact.user_id) : [...prev, contact.user_id])}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        selectedMentions.includes(contact.user_id) ? 'bg-primary border-primary' : 'border-white/20'
                      }`}
                    >
                      {selectedMentions.includes(contact.user_id) && <Check size={12} className="text-white" />}
                    </button>
                  </div>
                ))}
              </div>
              {selectedMentions.length > 0 && (
                <button 
                  onClick={async () => {
                    setIsProcessing(true);
                    // Add actual logic to ping backend here
                    await new Promise(resolve => setTimeout(resolve, 500));
                    setIsProcessing(false);
                    setShowMentionModal(false);
                    setSelectedMentions([]);
                  }}
                  disabled={isProcessing}
                  className="mt-4 w-full h-12 bg-primary text-white rounded-xl font-bold text-[14px] shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                  {isProcessing ? 'Mentioning...' : `Mention ${selectedMentions.length} ${selectedMentions.length === 1 ? 'person' : 'people'}`}
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Owner Options Sheet (3 dots / More) */}
      <AnimatePresence>
        {showOptionsSheet && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[700] bg-black/70 flex items-end justify-center" onClick={() => setShowOptionsSheet(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 220 }} onClick={e => e.stopPropagation()} className="w-full max-w-[500px] bg-[#111] rounded-t-[40px] p-8 border-t border-white/10">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-bold text-[15px]">More options</h3>
                <button onClick={() => setShowOptionsSheet(false)} className="text-white bg-white/10 p-2 rounded-full"><X size={20} /></button>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'Story Settings', icon: <Settings size={18} />, color: 'text-white', action: () => { setShowOptionsSheet(false); setShowStorySettings(true); } },
                  { label: currentStory.comments_enabled ? 'Turn off comments' : 'Turn on comments', icon: <MessageCircleOff size={18} />, color: 'text-white', action: async () => { await api.post(`/stories/${currentStory.story_id}/comments/toggle`); setShowOptionsSheet(false); } },
                  { label: 'Archive story', icon: <Archive size={18} />, color: 'text-white', action: async () => { await api.post(`/stories/${currentStory.story_id}/archive`); setShowOptionsSheet(false); } },
                  { label: 'Delete story', icon: <Trash2 size={18} />, color: 'text-rose-500', action: async () => { await api.delete(`/stories/${currentStory.story_id}`); navigate('/dashboard'); } },
                ].map((item, i) => (
                  <button key={i} onClick={item.action} className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl bg-[#2a2a2a] active:bg-white/10 transition-all`}>
                    <span className={`flex-shrink-0 ${item.color}`}>{item.icon}</span>
                    <span className={`font-medium text-[14px] ${item.color}`}>{item.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Say Something Comment Modal */}
      <AnimatePresence>
        {showCommentModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[700] bg-black/80 flex items-center justify-center p-6 backdrop-blur-md">
             <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} className="w-full max-w-[340px] bg-[#111] rounded-[32px] p-6 border border-white/10 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                   <h3 className="text-white font-black uppercase text-[12px] italic tracking-widest">Say something...</h3>
                   <button onClick={() => setShowCommentModal(false)} className="text-white/20"><X size={20} /></button>
                </div>
                <div className="relative">
                   <textarea 
                     value={replyText} onChange={(e) => setReplyText(e.target.value)}
                     className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-white text-[14px] outline-none focus:border-primary/50 transition-all" 
                     placeholder="Type a comment, mention friends..."
                   />
                </div>
                <div className="flex items-center justify-between mt-4">
                   <div className="flex gap-2">
                      {['❤️', '🔥', '👏', '😂'].map(e => <button key={e} onClick={() => setReplyText(prev => prev + e)} className="text-xl active:scale-125 transition-all">{e}</button>)}
                   </div>
                   <button onClick={() => handlePostComment(replyText)} className="px-6 h-10 bg-white text-black rounded-full font-black uppercase italic text-[11px]">Post</button>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .tab-btn { display: flex; align-items: center; gap: 8px; color: rgba(255,255,255,0.4); font-size: 14px; font-weight: 800; padding-bottom: 8px; border-bottom: 2px solid transparent; transition: all 0.3s; }
        .tab-btn.active { color: white; border-color: white; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
