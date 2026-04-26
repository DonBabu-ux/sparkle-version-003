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
  UserMinus, Ban, EyeOff, ExternalLink, Check, Sparkles
} from 'lucide-react';
import StickerRenderer from '../components/stories/StickerRenderer';
import { useStoryStore } from '../store/storyStore';
import { useUserStore } from '../store/userStore';
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
  views_count?: number;
  likes_count?: number;
  shares_count?: number;
  is_liked?: boolean;
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
  const [showArchiveTip, setShowArchiveTip] = useState(true);
  
  // Real Data States
  const [viewers, setViewers] = useState<any[]>([]);
  const [shareContacts, setShareContacts] = useState<any[]>([]);
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  const [activeViewerTab, setActiveViewerTab] = useState<'views' | 'likes' | 'shares'>('views');

  const longPressTimer = useRef<any>(null);

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const response = await api.get('/stories/active');
        const userGroup = response.data.find((g: UserStoryGroup) => String(g.user_id) === String(userId));
        if (userGroup) {
          setUserStories(userGroup);
          const current = userGroup.stories[0];
          api.post(`/stories/${current.story_id}/view`).catch(() => {});
        } else { navigate('/dashboard'); }
      } catch (err) { navigate('/dashboard'); } finally { setLoading(false); }
    };
    fetchStories();
  }, [userId, navigate]);

  useEffect(() => {
    if (showViewersSheet) {
      setViewerIndex(currentIndex);
    }
  }, [showViewersSheet, currentIndex]);

  useEffect(() => {
    if (userStories?.stories[currentIndex]) {
        api.post(`/stories/${userStories.stories[currentIndex].story_id}/view`).catch(() => {});
    }
  }, [currentIndex, userStories]);

  useEffect(() => {
    if (showViewersSheet && userStories?.stories[viewerIndex]) {
        api.get(`/stories/${userStories.stories[viewerIndex].story_id}/viewers`)
           .then(res => {
             const data = Array.isArray(res.data) ? res.data : [];
             setViewers(data);
           })
           .catch(e => {
             console.error('Viewers fetch error', e);
             setViewers([]);
           });
    }
  }, [showViewersSheet, viewerIndex, userStories]);

  useEffect(() => {
    if (showShareModal || showMentionModal) {
        api.get('/users/suggestions')
           .then(res => setShareContacts(res.data.suggestions || []))
           .catch(e => console.error('Contacts fetch error', e));
    }
  }, [showShareModal, showMentionModal]);

  useEffect(() => {
    if (!userStories || !userStories.stories[currentIndex]) return;
    const current = userStories.stories[currentIndex];
    if (current.audio_url) {
        audio.src = current.audio_url;
        audio.currentTime = (current.audio_start || 0) + (progress / 100 * (current.audio_duration || 15));
        const anyModalOpen = showOptionsSheet || showViewersSheet || showShareModal || showMentionModal || showViewerOptions;
        if (!isPaused && !isInputFocused && !isLongPressing && !anyModalOpen) {
          audio.play().catch(e => console.log('Audio autoplay blocked', e));
        } else { audio.pause(); }
    }
  }, [currentIndex, isPaused, isInputFocused, isLongPressing, showOptionsSheet, showViewersSheet, showShareModal, showMentionModal, showViewerOptions]);

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

  useEffect(() => {
    const anyModalOpen = showOptionsSheet || showViewersSheet || showShareModal || showMentionModal || showViewerOptions;
    if (isPaused || isInputFocused || isLongPressing || !userStories || anyModalOpen) {
      audio.pause();
      return;
    }
    const interval = setInterval(() => {
      setProgress(prev => Math.min(100, prev + 1));
    }, 40);
    return () => clearInterval(interval);
  }, [userStories, currentIndex, isPaused, isInputFocused, isLongPressing, showViewersSheet, showShareModal, showOptionsSheet, showMentionModal, showViewerOptions]);

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
    } catch (err) { console.error('Like failed', err); }
  };

  const handleMentionToggle = (userId: string) => {
    setSelectedMentions(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  };

  const handleAddMentions = async () => {
    try {
      console.log('Sending mentions to:', selectedMentions);
      setShowMentionModal(false);
      setSelectedMentions([]);
    } catch (e) { console.error('Mentions failed', e); }
  };

  const handleDeleteStory = async () => {
    if (!window.confirm('Delete this story?')) return;
    try {
      await api.delete(`/stories/${currentStory.story_id}`);
      navigate('/dashboard');
    } catch (err) { console.error('Failed to delete story', err); }
  };

  return (
    <div className="h-screen bg-black flex flex-col relative overflow-hidden safe-area-inset">
      
      {/* Media View */}
      <motion.div 
        animate={{ 
          scale: (showViewersSheet) ? 0.45 : 1, 
          y: (showViewersSheet) ? -180 : 0,
          borderRadius: (showViewersSheet) ? 40 : 0
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute inset-0 flex items-center justify-center bg-black sm:p-4 z-[50]"
      >
        <div 
          className="w-full h-full sm:h-[95vh] sm:aspect-[9/19.5] sm:rounded-[48px] overflow-hidden relative shadow-2xl bg-gray-900 border border-white/5"
          onMouseDown={() => longPressTimer.current = setTimeout(() => setIsLongPressing(true), 200)}
          onMouseUp={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); setIsLongPressing(false); }}
          onTouchStart={() => longPressTimer.current = setTimeout(() => setIsLongPressing(true), 200)}
          onTouchEnd={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); setIsLongPressing(false); }}
        >
          {/* Progress Bars */}
          <div className={`absolute top-4 left-4 right-4 z-50 flex gap-1.5 px-2 transition-opacity duration-300 ${isLongPressing ? 'opacity-0' : 'opacity-100'}`}>
            {userStories.stories.map((_: Story, idx: number) => (
              <div key={idx} className="h-[2px] flex-1 bg-white/20 rounded-full overflow-hidden">
                <motion.div className="h-full bg-white shadow-[0_0_8px_white]" initial={false} animate={{ width: idx === currentIndex ? `${progress}%` : idx < currentIndex ? '100%' : '0%' }} transition={{ duration: 0.1, ease: 'linear' }} />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className={`absolute top-10 left-6 right-6 z-50 flex items-center justify-between transition-opacity duration-300 ${isLongPressing ? 'opacity-0' : 'opacity-100'}`}>
            <div className="flex items-center gap-3">
               <div className="relative">
                  <div className={`w-10 h-10 rounded-full p-0.5 ${unviewedCount > 1 ? 'bg-gradient-to-tr from-primary to-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'bg-gray-700'}`}>
                    <img src={getAvatarUrl(userStories.avatar_url, userStories.user_name)} className="w-full h-full rounded-full object-cover border-2 border-black" alt="" />
                  </div>
               </div>
               <div className="flex flex-col">
                  <h4 className="text-white font-bold text-[13px] tracking-tight flex items-center gap-1.5">
                    {userStories.user_name} 
                    <span className="text-white/40 text-[11px] font-medium">• 
                      {showViewersSheet 
                        ? new Date(userStories.stories[viewerIndex].created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                        : new Date(currentStory.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                      }
                    </span>
                  </h4>
               </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/dashboard')} className="text-white/80 active:scale-90 transition-all hover:text-white bg-black/20 p-2 rounded-full backdrop-blur-md border border-white/10"><X size={24} strokeWidth={2.5} /></button>
            </div>
          </div>

          {/* Media Content */}
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-black">
            <AnimatePresence mode="wait">
               <motion.div 
                 key={showViewersSheet ? viewerIndex : currentIndex}
                 initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                 className="w-full h-full"
               >
                  {(showViewersSheet ? userStories.stories[viewerIndex] : currentStory).media_type === 'video' ? (
                    <video src={(showViewersSheet ? userStories.stories[viewerIndex] : currentStory).media_url} autoPlay={!isPaused} muted playsInline className="h-full w-full object-cover" />
                  ) : (
                    <img src={(showViewersSheet ? userStories.stories[viewerIndex] : currentStory).media_url} className="h-full w-full object-cover" alt="" />
                  )}
                  <StickerRenderer stickers={(showViewersSheet ? userStories.stories[viewerIndex] : currentStory).stickers || []} />
               </motion.div>
            </AnimatePresence>
          </div>

          {/* Interaction Bar */}
          <div className={`absolute bottom-6 left-0 right-0 px-6 z-50 flex items-center justify-between transition-opacity duration-300 ${isLongPressing ? 'opacity-0' : 'opacity-100'}`}>
             {isOwner ? (
               <div className="flex items-center justify-between w-full">
                  <button onClick={() => setShowViewersSheet(true)} className="flex items-center gap-3 active:scale-95 transition-all">
                    <div className="flex -space-x-4">
                       {[...Array(Math.min(3, viewers.length || 3))].map((_, i) => (
                         <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-gray-800 overflow-hidden">
                           <img src={viewers[i]?.avatar_url || `https://i.pravatar.cc/100?u=${i}`} className="w-full h-full object-cover" alt="" />
                         </div>
                       ))}
                    </div>
                    <span className="text-[11px] font-black uppercase text-white tracking-widest italic">View Activity</span>
                  </button>
                  <div className="flex items-center gap-6">
                    <button className="text-white active:scale-90 transition-all"><Phone size={22} className="text-[#25D366]" /></button>
                    <button onClick={() => setShowShareModal(true)} className="text-white active:scale-90 transition-all"><Send size={22} /></button>
                    <button onClick={() => setShowMentionModal(true)} className="text-white active:scale-90 transition-all"><AtSign size={22} /></button>
                    <button onClick={() => setShowOptionsSheet(true)} className="text-white active:scale-90 transition-all"><MoreHorizontal size={22} /></button>
                  </div>
               </div>
             ) : (
               <>
                 <div className="flex-1 relative group">
                    <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} onFocus={() => setIsInputFocused(true)} onBlur={() => setIsInputFocused(false)} placeholder="Reply to story..." className="w-full h-12 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-full px-6 text-[13px] font-medium text-white placeholder:text-white/40 outline-none focus:bg-white/20 transition-all" />
                    <button className={`absolute right-4 top-1/2 -translate-y-1/2 transition-all ${replyText ? 'text-primary' : 'text-white/40'}`}><Send size={18} /></button>
                 </div>
                 <div className="flex items-center gap-5 ml-4">
                    <button onClick={handleLike} className={`transition-all active:scale-150 ${currentStory.is_liked ? 'text-rose-500 fill-rose-500' : 'text-white'}`}><Heart size={26} strokeWidth={currentStory.is_liked ? 0 : 2} /></button>
                    <button onClick={() => setShowShareModal(true)} className="text-white active:scale-90 transition-all"><Share2 size={24} /></button>
                 </div>
               </>
             )}
          </div>

          <div className={`absolute inset-0 z-20 flex ${isInputFocused || showViewersSheet ? 'pointer-events-none' : ''}`}>
            <div className="w-1/3 h-full" onClick={() => { if (currentIndex > 0) { setCurrentIndex(currentIndex - 1); setProgress(0); } }} />
            <div className="w-2/3 h-full" onClick={() => { if (currentIndex < userStories.stories.length - 1) { setCurrentIndex(currentIndex + 1); setProgress(0); } else { setProgress(100); } }} />
          </div>
        </div>
      </motion.div>

      {/* Viewers Sheet */}
      <AnimatePresence>
        {showViewersSheet && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40"
            onClick={() => setShowViewersSheet(false)} // GENIUS: Backdrop Close
          >
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
              className="w-full max-w-[500px] bg-[#0F0F0F] rounded-t-[40px] p-8 flex flex-col h-[75vh] shadow-2xl border-t border-white/10 overflow-hidden"
            >
               <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" onClick={() => setShowViewersSheet(false)} />
               
               <div className="absolute top-[-30px] left-1/2 -translate-x-1/2">
                  <motion.div animate={{ y: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="text-white/40"><ChevronRight size={32} className="rotate-90" /></motion.div>
               </div>

               <div className="flex items-center justify-between mb-8">
                  <div className="flex gap-6">
                     <button onClick={() => setActiveViewerTab('views')} className={`tab-btn ${activeViewerTab === 'views' ? 'active' : ''}`}><Eye size={18} /> {viewers.length}</button>
                     <button onClick={() => setActiveViewerTab('likes')} className={`tab-btn ${activeViewerTab === 'likes' ? 'active' : ''}`}><Heart size={18} /> {viewers.filter(v => v.type === 'like').length}</button>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">{viewerIndex + 1} / {userStories.stories.length}</span>
                    <button onClick={() => setShowViewersSheet(false)} className="text-white bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all"><X size={20} /></button>
                  </div>
               </div>

               <div className="flex-1 relative overflow-hidden">
                  <motion.div 
                    drag="x" dragConstraints={{ left: 0, right: 0 }}
                    onDragEnd={(_, info) => {
                      if (info.offset.x < -100 && viewerIndex < userStories.stories.length - 1) { setViewerIndex(viewerIndex + 1); } 
                      else if (info.offset.x > 100 && viewerIndex > 0) { setViewerIndex(viewerIndex - 1); }
                    }}
                    className="h-full flex flex-col"
                  >
                    <AnimatePresence mode="wait">
                      <motion.div key={viewerIndex} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex-1 overflow-y-auto space-y-6 pr-2 no-scrollbar">
                         {viewers.map((v, i) => (
                           <div key={i} className="flex items-center justify-between group">
                              <div className="flex items-center gap-4">
                                 <div className="relative">
                                   <div className={`w-12 h-12 rounded-full p-0.5 ${v.has_story ? 'bg-gradient-to-tr from-primary to-blue-500' : 'bg-gray-800'}`}>
                                      <img src={getAvatarUrl(v.avatar_url, v.username)} className="w-full h-full rounded-full border-2 border-black object-cover" alt="" />
                                   </div>
                                 </div>
                                 <div>
                                   <h4 className="text-white font-bold text-[14px]">{v.username}</h4>
                                   <p className="text-white/40 text-[11px] font-medium">{v.user_name || 'Sparkle Member'}</p>
                                 </div>
                              </div>
                              <div className="flex items-center gap-4">
                                 <button className="p-2.5 bg-white/5 rounded-full text-primary hover:bg-white/10 transition-all"><Send size={16} /></button>
                                 <button onClick={() => setShowViewerOptions(v)} className="text-white/40"><MoreHorizontal size={20} /></button>
                              </div>
                           </div>
                         ))}
                         {viewers.length === 0 && <p className="text-white/20 text-center py-20 font-bold uppercase tracking-widest italic">No viewers yet</p>}
                      </motion.div>
                    </AnimatePresence>
                  </motion.div>
               </div>

               <div className="mt-6 pt-6 border-t border-white/5">
                  <button className="w-full h-14 bg-[#25D366] text-white rounded-2xl flex items-center justify-center gap-3 font-bold active:scale-95 transition-all">
                    <Phone size={20} /> Share to WhatsApp Status
                  </button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share/Send Modal */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/90 backdrop-blur-xl"
            onClick={() => setShowShareModal(false)} // GENIUS: Backdrop Close
          >
             <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} 
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[500px] bg-[#0A0A0A] rounded-t-[40px] p-8 border-t border-white/10 shadow-2xl flex flex-col h-[85vh]"
             >
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-white font-black uppercase italic tracking-widest text-[14px]">Send to</h3>
                   <button onClick={() => setShowShareModal(false)} className="text-white bg-white/10 p-2 rounded-full"><X size={24} /></button>
                </div>
                <div className="relative mb-8">
                   <div className="absolute inset-0 bg-white/5 rounded-2xl backdrop-blur-xl border border-white/10 pointer-events-none" />
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                   <input placeholder="Search followers..." className="w-full bg-transparent relative z-10 py-4 pl-12 pr-4 text-[14px] outline-none text-white font-medium" />
                </div>
                <div className="flex-1 overflow-y-auto space-y-6 no-scrollbar">
                   {shareContacts.map((contact, i) => (
                     <div key={i} className="flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                           <div className="relative">
                              <img src={getAvatarUrl(contact.avatar_url, contact.username)} className="w-14 h-14 rounded-[20px] object-cover border border-white/10" alt="" />
                              {contact.is_online ? (
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-black rounded-full" />
                              ) : (
                                <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-black/80 border border-white/10 rounded-md text-[8px] text-white/60 font-bold">12m</div>
                              )}
                           </div>
                           <div>
                              <h4 className="text-white font-bold text-[14px]">{contact.username}</h4>
                              <p className={`text-[11px] font-bold uppercase tracking-widest ${contact.is_online ? 'text-emerald-500' : 'text-white/20'}`}>{contact.is_online ? 'Active' : 'Offline'}</p>
                           </div>
                        </div>
                        <button className="px-6 h-10 bg-primary text-white rounded-xl text-[12px] font-black uppercase italic shadow-lg shadow-primary/20">Send</button>
                     </div>
                   ))}
                </div>
                <div className="mt-8 pt-8 border-t border-white/5 overflow-x-auto flex gap-6 no-scrollbar pb-2">
                   {[
                     { name: 'WhatsApp', icon: <Phone size={24} />, color: '#25D366' },
                     { name: 'Snapchat', icon: <Camera size={24} />, color: '#FFFC00', textColor: '#000' },
                     { name: 'Messenger', icon: <MessageSquare size={24} />, color: '#006AFF' },
                     { name: 'Facebook', icon: <Globe size={24} />, color: '#1877F2' },
                     { name: 'SMS', icon: <MessageCircle size={24} />, color: '#34C759' },
                     { name: 'Copy', icon: <LinkIcon size={24} />, color: '#8E8E93' }
                   ].map((app, i) => (
                     <div key={i} className="flex flex-col items-center gap-2 flex-shrink-0">
                        <div style={{ backgroundColor: app.color }} className={`w-14 h-14 rounded-[20px] flex items-center justify-center shadow-lg ${app.textColor ? `text-[${app.textColor}]` : 'text-white'}`}>
                           {app.icon}
                        </div>
                        <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">{app.name}</span>
                     </div>
                   ))}
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mention Modal */}
      <AnimatePresence>
        {showMentionModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[200] flex items-end justify-center bg-black/90 backdrop-blur-xl"
            onClick={() => setShowMentionModal(false)} // GENIUS: Backdrop Close
          >
             <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} 
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[500px] bg-[#0A0A0A] rounded-t-[40px] p-8 border-t border-white/10 shadow-2xl flex flex-col h-[85vh]"
             >
                <div className="flex items-center justify-between mb-6">
                   <h3 className="text-white font-black uppercase italic tracking-widest text-[14px]">Mention Friends</h3>
                   <button onClick={() => setShowMentionModal(false)} className="text-white bg-white/10 p-2 rounded-full"><X size={24} /></button>
                </div>
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl mb-8">
                   <p className="text-[12px] text-white/60 font-medium leading-relaxed">People added here will be mentioned in your story but their username won't be visible.</p>
                </div>
                <div className="relative mb-8">
                   <div className="absolute inset-0 bg-white/5 rounded-2xl border border-white/10" />
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                   <input placeholder="Search friends..." className="w-full bg-transparent relative z-10 py-4 pl-12 pr-4 text-[14px] outline-none text-white font-medium" />
                </div>
                <div className="flex-1 overflow-y-auto space-y-6 no-scrollbar">
                   {shareContacts.map((contact, i) => (
                     <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <img src={getAvatarUrl(contact.avatar_url, contact.username)} className="w-14 h-14 rounded-full object-cover border border-white/10" alt="" />
                           <div>
                              <h4 className="text-white font-bold text-[14px]">{contact.username}</h4>
                              <p className="text-white/40 text-[11px]">{contact.name || 'Sparkle Member'} • {contact.mutual_connections > 0 ? `Followed by example+${contact.mutual_connections} others` : 'New friend'}</p>
                           </div>
                        </div>
                        <button 
                          onClick={() => handleMentionToggle(contact.user_id)} 
                          className={`w-7 h-7 rounded-full border-2 transition-all flex items-center justify-center ${selectedMentions.includes(contact.user_id) ? 'bg-primary border-primary' : 'border-white/10'}`}
                        >
                          {selectedMentions.includes(contact.user_id) && <Check size={14} className="text-white" strokeWidth={4} />}
                        </button>
                     </div>
                   ))}
                </div>
                <button 
                  onClick={handleAddMentions}
                  disabled={selectedMentions.length === 0}
                  className={`mt-8 w-full h-16 rounded-full font-black uppercase italic tracking-[0.2em] text-[13px] transition-all ${selectedMentions.length > 0 ? 'bg-white text-black shadow-2xl' : 'bg-white/10 text-white/20 cursor-not-allowed'}`}
                >
                  Add ({selectedMentions.length})
                </button>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Options Sheet */}
      <AnimatePresence>
        {showOptionsSheet && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[300] flex items-end justify-center bg-black/80 backdrop-blur-md"
            onClick={() => setShowOptionsSheet(false)} // GENIUS: Backdrop Close
          >
            <motion.div 
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} 
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[500px] bg-[#0F0F0F] rounded-t-[40px] p-8 pb-12 border-t border-white/10 shadow-2xl flex flex-col max-h-[85vh]"
            >
               <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-8" onClick={() => setShowOptionsSheet(false)} />
               {showArchiveTip && (
                 <div className="p-5 bg-white/5 border border-white/10 rounded-3xl mb-8 relative group">
                    <div className="flex gap-4 items-start">
                       <div className="p-3 bg-white/10 rounded-2xl text-white/60"><Archive size={20} className="rotate-180" /></div>
                       <p className="text-[13px] text-white/80 font-medium leading-relaxed pr-8">Archive stories while they are active to keep them saved for later.</p>
                    </div>
                    <button onClick={() => setShowArchiveTip(false)} className="absolute top-4 right-4 text-white/20"><X size={16} /></button>
                 </div>
               )}
               <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar pr-1">
                  {[
                    { name: 'Delete', icon: <Trash2 size={20} />, color: 'text-rose-500', action: handleDeleteStory },
                    { name: 'Archive', icon: <Archive size={20} /> },
                    { name: 'Save Video', icon: <Download size={20} /> },
                    { name: 'Highlight', icon: <Star size={20} /> },
                    { name: 'Share to Facebook', icon: <Globe size={20} />, color: 'text-[#1877F2]' },
                    { name: 'Story Edit', icon: <Wand2 size={20} /> },
                    { name: 'AI Label', icon: <Sparkles size={20} />, color: 'text-primary' },
                    { name: 'Share...', icon: <ShareIcon size={20} /> },
                    { name: 'Story Settings', icon: <Settings size={20} /> },
                    { name: 'Turn off commenting', icon: <MessageCircleOff size={20} /> }
                  ].map((opt, i) => (
                    <button key={i} onClick={opt.action} className={`w-full py-5 px-6 rounded-2xl bg-white/5 flex items-center justify-between group active:scale-[0.98] transition-all`}>
                      <div className={`flex items-center gap-4 font-bold ${opt.color || 'text-white'}`}>
                         {opt.icon} {opt.name}
                      </div>
                      <ChevronRight size={16} className="text-white/10 group-hover:text-white/40 transition-colors" />
                    </button>
                  ))}
                  <button onClick={() => setShowOptionsSheet(false)} className="w-full py-5 px-6 rounded-2xl text-white/40 flex items-center justify-center font-bold mt-4 bg-white/5">Cancel</button>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Viewer Options */}
      <AnimatePresence>
        {showViewerOptions && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
            onClick={() => setShowViewerOptions(null)} // GENIUS: Backdrop Close
          >
             <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} 
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-[320px] bg-[#1A1A1A] rounded-[32px] p-6 border border-white/10 shadow-2xl space-y-1"
             >
                <button className="w-full py-4 text-rose-500 font-bold text-[15px] hover:bg-white/5 rounded-2xl transition-all"><Ban size={18} className="inline mr-3" /> Block</button>
                <button className="w-full py-4 text-white font-bold text-[15px] hover:bg-white/5 rounded-2xl transition-all"><UserMinus size={18} className="inline mr-3" /> Remove Follower</button>
                <button className="w-full py-4 text-white font-bold text-[15px] hover:bg-white/5 rounded-2xl transition-all"><EyeOff size={18} className="inline mr-3" /> Hide your story</button>
                <button className="w-full py-4 text-white font-bold text-[15px] hover:bg-white/5 rounded-2xl transition-all" onClick={() => navigate(`/profile/${showViewerOptions.username}`)}><User size={18} className="inline mr-3" /> View Profile</button>
                <div className="h-px bg-white/5 my-2" />
                <button onClick={() => setShowViewerOptions(null)} className="w-full py-4 text-white/40 font-bold text-[15px]">Cancel</button>
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
