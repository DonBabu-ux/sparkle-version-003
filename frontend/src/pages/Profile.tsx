import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';
import FollowListModal from '../components/modals/FollowListModal';
import { useModalStore } from '../store/modalStore';
import type { User } from '../types/user';
import type { Post } from '../types/post';
import { 
  Grid, 
  Bookmark, 
  UserSquare, 
  Clapperboard, 
  Settings as SettingsIcon, 
  Link as LinkIcon, 
  MessageSquare, 
  Sparkles, 
  Orbit, 
  Heart, 
  MapPin,
  GraduationCap,
  Plus,
  History,
  Image as ImageIcon,
  Zap,
  TrendingUp,
  Target,
  ChevronDown,
  LayoutDashboard
} from 'lucide-react';
import { getAvatarUrl } from '../utils/imageUtils';
import { motion, AnimatePresence } from 'framer-motion';
import Spinner from '../components/ui/Spinner';

export default function Profile() {
  const { username } = useParams();
  const { user: currentUser } = useUserStore();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reels, setReels] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved' | 'tagged'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [modalType, setModalType] = useState<'Followers' | 'Following' | null>(null);
  const { setActiveModal, refreshCounter } = useModalStore();
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showAccountSwitcher, setShowAccountSwitcher] = useState(false);

  // Highlights
  const [highlights, setHighlights] = useState<{ id: string; title: string; cover_url: string; story_count: number }[]>([]);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setActiveTab('posts'); 
    try {
      const endpoint = username === 'me' ? '/users/me' : `/users/${username}`;
      const profileRes = await api.get(endpoint);
      if (profileRes.data) {
        const profileData = profileRes.data;
        setProfile(profileData);
        setIsFollowing(profileData.is_followed_by_me);
        setIsRequested(profileData.is_requested_by_me);

        const postsRes = await api.get(`/users/${profileData.id || profileData.user_id}/posts`);
        if (postsRes.data && Array.isArray(postsRes.data)) {
          const allPosts = postsRes.data.sort((a: Post, b: Post) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
          setPosts(allPosts);
          setReels(allPosts.filter((p: Post) => p.media_type === 'video' || (p.media_url && p.media_url.match(/\.(mp4|webm|ogg|mov)$/i))));
        }
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [username]);

  const fetchHighlights = useCallback(async (userId: string) => {
    try {
      const res = await api.get(`/users/${userId}/highlights`);
      setHighlights(res.data || []);
    } catch (err) {
      console.error('Failed to fetch highlights:', err);
    }
  }, []);

  const fetchSaved = useCallback(async () => {
    try {
      const res = await api.get('/posts/saved');
      setSavedPosts(res.data || []);
    } catch (err) {
      console.error('Failed to fetch saved posts:', err);
    }
  }, []);

  useEffect(() => {
    if (currentUser) fetchProfile();
  }, [fetchProfile, currentUser, refreshCounter]);

  // Fetch highlights when profile is loaded
  useEffect(() => {
    const id = profile?.id || profile?.user_id;
    if (id) fetchHighlights(id);
  }, [profile, fetchHighlights]);

  const openHighlight = async (highlightId: string, title: string) => {
    try {
      const res = await api.get(`/highlights/${highlightId}`);
      setActiveModal('highlight_player', null, { 
        id: highlightId, 
        title, 
        stories: res.data.stories || [],
        ownerUsername: profile?.username,
        ownerAvatar: profile?.avatar_url
      });
    } catch (err) {
      console.error('Failed to load highlight:', err);
    }
  };

  useEffect(() => {
    const currentId = currentUser?.id || currentUser?.user_id;
    const profileId = profile?.id || profile?.user_id;
    const ownProfile = !!currentId && !!profileId && String(currentId) === String(profileId);
    if (activeTab === 'saved' && ownProfile) {
      fetchSaved();
    }
  }, [activeTab, currentUser, profile, fetchSaved]);

  const handleFollowToggle = async () => {
    if (!profile || isRequested) return;
    const targetId = profile.user_id || profile.id;
    try {
      const res = await api.post(`/users/${targetId}/follow`);
      if (res.data.status === 'requested') setIsRequested(true);
      else if (res.data.status === 'following') setIsFollowing(true);
      else if (res.data.status === 'unfollowed') setIsFollowing(false);
      
      setProfile((prev: User | null) => prev ? {
        ...prev,
        followers_count: res.data.status === 'following' ? ((prev.followers_count || 0) + 1) : 
                         res.data.status === 'unfollowed' ? ((prev.followers_count || 0) - 1) : 
                         (prev.followers_count || 0)
      } : prev);
    } catch (err) {
      console.error('Follow toggle failed:', err);
    }
  };



  if (loading) {
    return (
      <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center lg:ml-72 transition-all">
          <div className="relative mb-20"> {/* Increased margin */}
            <Spinner size="xl" color="text-primary" />
          </div>
          
          <div className="flex flex-col items-center gap-6"> {/* Increased gap */}
             {/* Calibration Watermark moved below spinner */}
             <div className="opacity-10 mb-2">
                <Orbit size={60} className="animate-spin-slow" />
             </div>
             
             <div className="h-4 overflow-hidden flex flex-col items-center">
                <motion.div 
                  animate={{ y: [0, -20, -40, -60] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", times: [0, 0.33, 0.66, 1] }}
                  className="flex flex-col items-center"
                >
                  {['Synchronizing Identity', 'Calibrating Frequency', 'Scanning Nodes', 'Authenticating Signature'].map((text, i) => (
                    <span key={i} className="text-[10px] font-black italic text-black/20 uppercase tracking-[0.4em] h-5">{text}</span>
                  ))}
                </motion.div>
             </div>
             <div className="w-32 h-[1px] bg-black/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="w-full h-full bg-primary/20"
                />
             </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center lg:ml-72 text-center p-12 animate-fade-in">
           <Orbit size={120} strokeWidth={1} className="text-black/5" />
           <h2 className="text-5xl font-black text-black mt-8 mb-6 tracking-tighter italic uppercase">Signal Lost.</h2>
           <p className="text-sm font-bold text-black/40 max-w-sm mx-auto mb-10 uppercase tracking-widest leading-loose">This signature does not exist in our village directory.</p>
           <button onClick={() => navigate('/')} className="px-12 py-5 bg-primary text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-primary/30 transition-all hover:scale-105 active:scale-95 italic">Go Home</button>
        </div>
      </div>
    );
  }

  const currentId = currentUser?.id || currentUser?.user_id;
  const profileId = profile?.id || profile?.user_id;
  const isOwnProfile = !!currentId && !!profileId && String(currentId) === String(profileId);
  const isMeAlias = username === 'me';
  const showOwnerActions = isOwnProfile || isMeAlias;

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
      <Navbar />
      

      {/* Main Header Wrapper */}

      {/* Top Navigation Bar with Account Switcher */}
      <div className="fixed top-0 left-0 lg:left-72 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-black/[0.03] z-[100] flex items-center justify-center px-4">
        <div className="relative">
          <button 
            onClick={() => setShowAccountSwitcher(!showAccountSwitcher)}
            className="flex items-center gap-2 px-4 py-1.5 hover:bg-black/5 rounded-full transition-all group"
          >
            <span className="text-sm font-bold text-black tracking-tight">{profile?.username}</span>
            <ChevronDown size={16} className={`text-black/30 transition-transform ${showAccountSwitcher ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showAccountSwitcher && (
              <>
                <div className="fixed inset-0 z-[-1]" onClick={() => setShowAccountSwitcher(false)} />
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-64 bg-white rounded-lg shadow-2xl border border-black/5 p-2 z-[101]"
                >
                  <div className="px-3 py-2 border-b border-black/5 mb-1">
                    <span className="text-[10px] font-bold text-black/30 uppercase tracking-widest">Switch Identity</span>
                  </div>
                  <div className="space-y-1 max-h-60 overflow-y-auto no-scrollbar">
                    {accounts.map((acc) => (
                      <button 
                        key={acc.user.user_id}
                        onClick={() => {
                          if (acc.user.user_id !== currentUser?.user_id) {
                            switchAccount(acc.user.user_id);
                            setShowAccountSwitcher(false);
                            navigate(`/profile/${acc.user.username}`);
                          }
                        }}
                        className={`w-full p-2 flex items-center gap-3 rounded-xl transition-all ${acc.user.user_id === currentUser?.user_id ? 'bg-black/5 border border-black/5 cursor-default' : 'hover:bg-black/5'}`}
                      >
                        <img 
                          src={getAvatarUrl(acc.user.avatar_url, acc.user.username)} 
                          alt="" 
                          className="w-8 h-8 rounded-full object-cover border border-black/5" 
                        />
                        <div className="flex flex-col text-left">
                          <span className="text-xs font-bold text-black">{acc.user.username}</span>
                          {acc.user.user_id === currentUser?.user_id ? (
                            <span className="text-[9px] text-black/40 font-medium uppercase tracking-tight">Active Node</span>
                          ) : (
                            <span className="text-[9px] text-black/20 font-medium uppercase tracking-tight">Switch to Node</span>
                          )}
                        </div>
                        {acc.user.user_id === currentUser?.user_id && (
                          <div className="ml-auto w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        )}
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={() => { setShowAccountSwitcher(false); navigate('/login'); }}
                    className="w-full mt-1 p-2.5 flex items-center gap-3 hover:bg-black/5 rounded-xl transition-colors text-left border-t border-black/5 pt-3"
                  >
                    <div className="w-8 h-8 rounded-full border border-dashed border-black/20 flex items-center justify-center">
                      <Plus size={16} className="text-black/40" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-tight text-black">Add Sparkle Account</span>
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      <main className="flex-1 lg:ml-72 p-4 md:p-8 relative z-10 w-full pt-24 lg:pt-24">
        <div className="max-w-4xl mx-auto">
          <header className="flex flex-col gap-8 mb-12 animate-fade-in w-full">
            {/* Main Header Row: Avatar + Basic Info */}
            <div className="flex items-start gap-6 md:gap-10">
              {/* Avatar Column */}
              <div className="relative shrink-0">
                <div 
                  className={`w-24 h-24 md:w-36 md:h-36 rounded-full shadow-2xl cursor-pointer ${profile?.has_story ? 'p-1 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500' : ''}`}
                  onClick={() => {
                    if (profile?.has_story) setShowAvatarMenu(true);
                    else setActiveModal('media_preview', null, { url: getAvatarUrl(profile?.avatar_url, profile?.username) });
                  }}
                >
                  <div className={`w-full h-full rounded-full ${profile?.has_story ? 'p-1 bg-[#fdf2f4]' : ''}`}>
                    <img 
                      src={getAvatarUrl(profile?.avatar_url, profile?.username)} 
                      alt="" 
                      className="w-full h-full rounded-full object-cover border border-black/5" 
                    />
                  </div>
                </div>

                {/* Avatar Action Menu */}
                <AnimatePresence>
                  {showAvatarMenu && (
                    <>
                      <div className="fixed inset-0 z-[1000]" onClick={() => setShowAvatarMenu(false)} />
                      <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="absolute top-0 left-full ml-4 z-[1001] bg-white rounded-[14px] shadow-2xl border border-black/5 p-2 flex flex-col gap-1 min-w-[180px]"
                      >
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowAvatarMenu(false); navigate(`/stories/${profile?.id || profile?.user_id}`); }}
                          className="w-full px-4 py-3 text-left hover:bg-black/5 rounded-lg transition-colors flex items-center gap-3"
                        >
                          <History size={18} className="text-primary" />
                          <span className="text-sm font-bold text-black tracking-tight">View Story</span>
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setShowAvatarMenu(false); setActiveModal('media_preview', null, { url: getAvatarUrl(profile?.avatar_url, profile?.username) }); }}
                          className="w-full px-4 py-3 text-left hover:bg-black/5 rounded-lg transition-colors flex items-center gap-3"
                        >
                          <ImageIcon size={18} className="text-black/40" />
                          <span className="text-sm font-bold text-black tracking-tight">View Picture</span>
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                {/* Note Bubble Removed */}
              </div>

              {/* Info Column (Beside Avatar) */}
              <div className="flex-1 flex flex-col pt-2">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <h1 className="text-xl md:text-2xl font-black text-black tracking-tight">{profile?.username}</h1>
                  {profile?.is_verified && (
                    <div className="bg-[#FF1F6D] p-1 rounded-full shadow-[0_0_10px_rgba(255,31,109,0.5)]">
                       <Sparkles size={14} className="text-white fill-white" />
                    </div>
                  )}
                  
                  {/* Stats Row Beside Username */}
                  <div className="flex items-center gap-6 ml-4 md:ml-8 border-l border-black/5 pl-4 md:pl-8">
                    <div className="flex flex-col items-center">
                       <span className="text-sm md:text-base font-black text-black leading-none">{posts.length}</span>
                       <span className="text-[10px] font-bold text-black uppercase tracking-widest">Posts</span>
                    </div>
                    <div className="flex flex-col items-center cursor-pointer hover:opacity-70 transition-opacity" onClick={() => setModalType('Followers')}>
                       <span className="text-sm md:text-base font-black text-black leading-none">{profile?.followers_count || 0}</span>
                       <span className="text-[10px] font-bold text-black uppercase tracking-widest">Followers</span>
                    </div>
                    <div className="flex flex-col items-center cursor-pointer hover:opacity-70 transition-opacity" onClick={() => setModalType('Following')}>
                       <span className="text-sm md:text-base font-black text-black leading-none">{profile?.following_count || 0}</span>
                       <span className="text-[10px] font-bold text-black uppercase tracking-widest">Following</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {showOwnerActions ? (
                    <button onClick={() => navigate('/settings')} className="px-6 py-2 bg-black text-white rounded-lg text-xs font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/10">
                      Edit Node
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      {isFollowing ? (
                        <button onClick={handleFollowToggle} className="px-6 py-2 bg-black/5 hover:bg-black/10 rounded-lg text-xs font-bold text-black transition-all uppercase tracking-widest border border-black/5">
                          Following
                        </button>
                      ) : (
                        <button onClick={handleFollowToggle} className="px-6 py-2 bg-[#FF1F6D] hover:scale-105 active:scale-95 rounded-lg text-xs font-bold text-white transition-all shadow-lg shadow-[#FF1F6D]/20 uppercase tracking-widest">
                          Follow
                        </button>
                      )}
                      <button onClick={() => navigate(`/messages/${profile?.user_id || profile?.id}`)} className="px-6 py-2 bg-white border border-black/10 hover:bg-black/5 rounded-lg text-xs font-bold text-black transition-all uppercase tracking-widest">
                        Message
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
              
            {/* Content Row: Name, Bio, and Professional Dashboard */}
            <div className="mt-4 md:pl-2">
              <h2 className="text-base font-black text-black mb-1 tracking-tight">{profile?.name || profile?.username}</h2>
              
              {/* Prestige Node & Power Bar */}
              {/* Prestige Node & Badges (Only visible to owner to hide 'verification criteria') */}
              {showOwnerActions && (
                <>
                  <div className="w-full max-w-[240px] mb-4">
                     <div className="flex justify-between items-center mb-1 px-0.5">
                        <span className="text-[9px] font-bold text-black uppercase tracking-widest">Node Prestige <span className="text-black font-black ml-1">Lvl {profile.reputation?.trustLevel || 1}</span></span>
                        <span className="text-[9px] font-black text-[#FF1F6D] uppercase tracking-widest">{profile.reputation?.prestigeScore || 0}% Power</span>
                     </div>
                     <div className="h-1.5 bg-black/5 rounded-full overflow-hidden p-0.5 border border-white shadow-inner">
                        <div 
                          className="h-full bg-gradient-to-r from-black via-slate-800 to-black rounded-full shadow-[0_0_8px_rgba(0,0,0,0.15)] transition-all duration-1000" 
                          style={{ width: `${profile.reputation?.prestigeScore || 10}%` }}
                        />
                     </div>
                  </div>

                  {/* Badges Flowing Horizontally */}
                  <div className="flex flex-wrap gap-2 mb-8">
                     {[
                       { id: 'spark_seed', color: 'from-amber-400 to-orange-500', icon: <Zap size={12} fill="currentColor" />, active: (profile.reputation?.trustLevel || 0) >= 1 },
                       { id: 'viral_node', color: 'from-emerald-400 to-cyan-500', icon: <TrendingUp size={12} />, active: (profile.reputation?.trustLevel || 0) >= 3 },
                       { id: 'verified_node', color: 'from-[#FF1F6D] to-purple-600', icon: <Heart size={12} fill="currentColor" />, active: !!profile.is_verified }
                     ].filter(b => b.active).map((badge, idx) => (
                       <div 
                         key={idx}
                         className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-tr ${badge.color} text-white shadow-lg border border-white/50`}
                       >
                          {badge.icon}
                          <span className="text-[10px] font-black uppercase tracking-widest">{badge.id.replace('_', ' ')}</span>
                       </div>
                     ))}
                  </div>
                </>
              )}

              {(profile?.campus || profile?.major) && (
                <div className="text-[11px] font-bold text-black mb-3 uppercase tracking-wider flex items-center gap-2">
                   <div className="w-1 h-1 bg-primary rounded-full" />
                   {profile.campus} <span className="text-black/10 mx-1">|</span> {profile.major}
                </div>
              )}

              <div className="text-sm font-bold text-black leading-relaxed whitespace-pre-wrap max-w-lg mb-6">
                {profile?.bio || (showOwnerActions ? 'Initialize your node biography...' : '')}
              </div>

              {profile?.website && (
                <a href={`https://${profile.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-[#FF1F6D] hover:underline mb-6 tracking-tight">
                  <LinkIcon size={14} strokeWidth={2.5} />
                  {profile.website.replace(/^https?:\/\//, '')}
                </a>
              )}

              {/* Professional Dashboard Node (Clickable Card) */}
              {showOwnerActions && (
                <div 
                  onClick={() => navigate('/professional-dashboard')}
                  className="bg-white/40 backdrop-blur-sm border border-black/[0.03] rounded-2xl p-4 flex items-center justify-between group cursor-pointer hover:bg-white hover:shadow-xl hover:shadow-primary/5 transition-all max-w-sm mb-6"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary/10 to-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <LayoutDashboard size={20} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-black tracking-tight">Professional Dashboard</span>
                      <span className="text-[10px] text-black/40 font-medium uppercase tracking-wider">Track your network pulse</span>
                    </div>
                  </div>
                  <ChevronDown className="text-black/10 -rotate-90 group-hover:text-primary transition-colors" size={20} />
                </div>
              )}
            </div>
          </header>

          {/* Story Highlights Section */}
          <div className="flex gap-4 md:gap-8 overflow-x-auto no-scrollbar w-full mb-10 pb-2 px-2 md:px-0">
            {/* New Highlight button (own profile only) - MOVE TO FRONT */}
            {showOwnerActions && (
              <div
                className="flex flex-col items-center gap-2 cursor-pointer group shrink-0"
                onClick={() => setActiveModal('highlight')}
              >
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border border-dashed border-black/30 flex items-center justify-center group-hover:bg-black/5 transition-colors">
                  <Plus size={24} className="text-black/50" />
                </div>
                <span className="text-xs font-medium text-black">New</span>
              </div>
            )}

            {/* Real Highlights */}
            {highlights.map(h => (
              <div
                key={h.id}
                className="flex flex-col items-center gap-2 cursor-pointer group shrink-0"
                onClick={() => openHighlight(h.id, h.title)}
              >
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full p-0.5 bg-black/10 group-hover:bg-black/20 transition-colors">
                  <div className="w-full h-full bg-[#fdf2f4] rounded-full p-0.5 overflow-hidden">
                    {h.cover_url ? (
                      <img src={h.cover_url} className="w-full h-full rounded-full object-cover" alt={h.title} />
                    ) : (
                      <div className="w-full h-full rounded-full bg-black/10 flex items-center justify-center">
                        <span className="text-black/40 text-xl">{h.title[0]?.toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-xs font-medium text-black truncate max-w-[64px] text-center">{h.title}</span>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex items-center justify-center gap-12 border-t border-black/10 w-full mb-4">
            {([
              { id: 'posts',  label: 'POSTS',  icon: Grid },
              { id: 'reels',  label: 'REELS',  icon: Clapperboard },
              ...(showOwnerActions ? [{ id: 'saved', label: 'SAVED', icon: Bookmark }] : []),
              { id: 'tagged', label: 'TAGGED', icon: UserSquare }
            ] as const).map(tab => (
              <button 
                key={tab.id}
                className={`flex items-center gap-2 py-4 border-t font-semibold text-[12px] tracking-widest transition-all ${activeTab === tab.id ? 'border-black text-black' : 'border-transparent text-black/50 hover:text-black/70'}`} 
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={14} /> {tab.label}
              </button>
            ))}
          </div>

          {/* Grid Section */}
          <div className="grid grid-cols-3 gap-1 pb-32 animate-fade-in w-full">
            {(activeTab === 'posts' ? posts : activeTab === 'reels' ? reels : activeTab === 'saved' ? savedPosts : []).length > 0 ? (
              (activeTab === 'posts' ? posts : activeTab === 'reels' ? reels : activeTab === 'saved' ? savedPosts : []).map((post) => (
                <div 
                  key={post.post_id} 
                  className="relative aspect-square bg-gray-100 overflow-hidden group cursor-pointer" 
                  onClick={() => navigate(`/post/${post.post_id}`)}
                >
                  <div className="w-full h-full relative">
                    {post.media_type === 'video' || (post.media_url && post.media_url.match(/\.(mp4|webm|ogg|mov)$/i)) ? (
                      <video src={post.media_url} className="w-full h-full object-cover" />
                    ) : (post.media_url || post.image_url) ? (
                      <img src={post.media_url || post.image_url} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full flex flex-col justify-center items-center p-4 text-center text-black">
                         <p className="font-medium text-[10px] md:text-xs italic opacity-60 leading-snug break-words line-clamp-4">
                           {post.content || 'No Media'}
                         </p>
                      </div>
                    )}
                    
                    {/* Media Badge */}
                    {(post.media_type === 'video' || (post.media_url && post.media_url.match(/\.(mp4|webm|ogg|mov)$/i))) && (
                       <div className="absolute top-2 right-2 flex items-center justify-center text-white drop-shadow-md">
                          <Clapperboard size={16} fill="white" className="text-white" />
                       </div>
                    )}
                  </div>
                  
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-6 text-white z-10 hidden md:flex">
                     <div className="flex items-center gap-2 font-bold text-base">
                          <Heart size={20} fill="currentColor" strokeWidth={0} />
                          <span>{formatCount(post.spark_count || 0)}</span>
                     </div>
                     <div className="flex items-center gap-2 font-bold text-base">
                          <MessageSquare size={20} fill="currentColor" strokeWidth={0} />
                          <span>{formatCount(post.comment_count || 0)}</span>
                     </div>
                  </div>
                </div>
            ))
          ) : (
            <div className="col-span-full py-32 flex flex-col items-center text-center gap-8 animate-fade-in opacity-40">
               <Orbit size={80} strokeWidth={1.5} className="text-black animate-spin-slow" />
               <div className="space-y-4">
                  <h3 className="text-2xl font-black text-black italic uppercase tracking-tighter">
                     {activeTab === 'posts' ? 'Static Void.' : activeTab === 'reels' ? 'Motion Blank.' : 'Vault Empty.'}
                  </h3>
                   <p className="text-[9px] font-black text-black uppercase tracking-[0.2em] max-w-xs mx-auto leading-relaxed">
                     {activeTab === 'posts' ? 'No signals captured in this frequency.' : activeTab === 'reels' ? 'This frequency lacks visual motion.' : 'Empty memory space detected.'}
                   </p>
               </div>
            </div>
          )}
        </div>

        <footer className="py-16 text-center border-t border-black/[0.03] relative">
          <div className="flex flex-wrap items-center justify-center gap-12 text-[10px] font-black text-black/20 uppercase tracking-[0.3em] mb-12 italic">
            {['Village', 'Privacy', 'Safety', 'Terms', 'Connect'].map(item => (
                <span key={item} className="hover:text-primary transition-colors cursor-pointer">{item}</span>
            ))}
          </div>
          <div className="space-y-4">
            {/* Watermark Removed */}
          </div>
        </footer>
        </div>
      </main>


      {/* Local Note Editor Modal Removed */}

      {modalType && (
        <FollowListModal
          isOpen={!!modalType}
          onClose={() => setModalType(null)}
          title={modalType}
          profileId={profile?.id || profile?.user_id || ''}
        />
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        @keyframes fadeInRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        .animate-fade-in-right { animation: fadeInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        .no-scrollbar::-webkit-scrollbar { display: none; }
        .animate-spin-slow { animation: spin 15s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        @media (max-width: 768px) {
           .aspect-square { aspect-ratio: 1/1; }
        }
      `}</style>
    </div>
  );
}

function formatCount(count: number): string {
  if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
  if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
  return count.toString();
}
