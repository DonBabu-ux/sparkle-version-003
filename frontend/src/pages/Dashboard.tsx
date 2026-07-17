import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import PostCard from '../components/PostCard';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import AppScreen from '../components/AppScreen';
import { useModalStore } from '../store/modalStore';
import { useFeedStore } from '../store/feedStore';
import { 
  Check, Image, Video, Smile, Ghost, 
  Plus, Sparkles, Flame, TrendingUp, Orbit, Send, 
  ChevronRight, BarChart3, Calendar 
} from 'lucide-react';
import VirtualizedFeed from '../components/VirtualizedFeed';
import Spinner from '../components/ui/Spinner';
import { useDeviceSeed } from '../hooks/useDeviceSeed';
import { PullToRefreshProvider, usePullToRefresh } from '../components/PullToRefreshProvider';
import { motion, AnimatePresence } from 'framer-motion';
import type { User } from '../types/user';
import type { Post } from '../types/post';
import { getAvatarUrl } from '../utils/imageUtils';
import { useUploadStore } from '../store/uploadStore';
import { CloudUpload, AlertTriangle, RefreshCw, X as XIcon } from 'lucide-react';
import { useUploadNotificationStore } from '../components/notifications/UploadNotificationCenter';

interface StoryItem {
  story_id?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string | null;
  duration?: number | null;
  caption?: string;
  created_at?: string;
}

interface StoryGroup {
  user_id: string;
  username: string;
  user_name: string;
  avatar_url?: string;
  is_fully_viewed?: boolean;
  unviewed_count?: number;
  stories: StoryItem[];
}

/** Format seconds to M:SS */
const formatDuration = (secs: number | null | undefined): string | null => {
  if (!secs || secs <= 0) return null;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/** Pick the best preview URL with graceful fallback */
const getStoryPreviewUrl = (story: StoryItem, fallbackAvatar?: string): string => {
  return story.thumbnail_url || story.media_url || fallbackAvatar || '/assets/story_placeholder.png';
};

interface TrendingTag {
  tag: string;
  count: string;
}

function SuggestionItem({ s, navigate }: { s: User, navigate: (path: string) => void }) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      await api.post(`/users/${s.user_id}/follow`);
      setFollowing(true);
    } catch (err) {
      console.error('Failed to follow', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" onClick={() => navigate(`/profile/${s.username}`)}>
      <img src={getAvatarUrl(s.avatar_url, s.username)} className="w-10 h-10 rounded-full object-cover border border-black/5 dark:border-white/10" alt="" />
      <div className="flex-1 min-w-0">
        <p className="font-bold text-[14px] text-black dark:text-white truncate">{s.username}</p>
        <p className="text-[12px] text-black/40 dark:text-white/40 truncate">{s.campus || 'Main Campus'}</p>
      </div>
      <button className={`px-4 py-1.5 rounded-lg font-bold text-[13px] transition-all ${following ? 'bg-black/5 dark:bg-white/5 text-black/20 dark:text-white/20' : 'bg-primary/5 text-primary hover:bg-primary/10'}`} onClick={handleFollow} disabled={loading || following}>
        {loading ? '...' : following ? 'Following' : 'Follow'}
      </button>
    </div>
  );
}

function DashboardContent() {
  const { user } = useUserStore();
  const navigate = useNavigate();
  const { setActiveModal } = useModalStore();
  const { stories, suggestions, setPosts, appendPosts, prependPosts, setStories, setSuggestions, lastFetched, orderedPostIds, postsById } = useFeedStore();
  const { start: refreshDashboard } = usePullToRefresh('dashboard', () => fetchDashboardData(true, true));
const posts = orderedPostIds.map(id => postsById[id]);

  // Upload queue state
  const uploadJobs = useUploadStore((s) => s.jobs);
  const cancelUploadJob = useUploadStore((s) => s.cancelJob);
  const retryUploadJob = useUploadStore((s) => s.retryJob);
  const discardUploadJob = useUploadStore((s) => s.discardJob);
  const activeUploads = uploadJobs.filter((j) => j.type === 'STORY' && j.status !== 'PUBLISHED' && j.status !== 'CANCELLED');
  const [showUploadSheet, setShowUploadSheet] = useState(false);
  
  const [newPostContent, setNewPostContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>([]);
  const [loading, setLoading] = useState(!lastFetched);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hiddenPostIds, setHiddenPostIds] = useState<string[]>([]);
  const offsetRef = useRef<number>(0);
  const lastSyncTime = useRef<number>(Date.now());
  const isInitialMount = useRef(true);
  const { seed: deviceSeed, deviceId } = useDeviceSeed();

  const [isProfileCardDismissed, setIsProfileCardDismissed] = useState(() => {
    return localStorage.getItem('profileCompletionCardDismissed') === 'true';
  });

  const dismissProfileCard = () => {
    localStorage.setItem('profileCompletionCardDismissed', 'true');
    setIsProfileCardDismissed(true);
  };

  const profileCompletion = useMemo(() => {
    if (!user) return 0;
    const fields = [
      user.name,
      user.username,
      user.avatar_url,
      user.bio,
      user.campus,
      user.major
    ];
    const completed = fields.filter(f => f && String(f).trim().length > 0).length;
    return Math.round((completed / fields.length) * 100);
  }, [user]);

  const fetchDeltaData = useCallback(async () => {
    try {
      const since = new Date(lastSyncTime.current).toISOString();
      const res = await api.get(`/posts/new?since=${since}`);
      const newPosts = res.data;
      
      if (Array.isArray(newPosts) && newPosts.length > 0) {
        prependPosts(newPosts);
        lastSyncTime.current = Date.now();
      }
    } catch (err) {
      console.error('Delta sync failed:', err);
    }
  }, [prependPosts]);

  const fetchStoriesData = useCallback(async () => {
    try {
      const res = await api.get('/stories/active');
      if (Array.isArray(res.data)) {
        setStories(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch stories:', err);
    }
  }, [setStories]);

  const fetchDashboardData = useCallback(async (isInitial = true, force = false) => {
    // Reduce 'fresh' window to 30s for variety but stability
    const isFresh = lastFetched && (Date.now() - lastFetched < 30000);
    
    // Only skip if it's an initial load AND we have fresh data AND not forcing
    if (isInitial && isFresh && (posts?.length ?? 0) > 0 && !force) {
      setLoading(false);
      return; 
    }

    if (isInitial) {
      setLoading(true);
      if (force) {
        offsetRef.current = 0;
      }
    } else {
      setLoadingMore(true);
    }

    try {
      const currentOffset = isInitial ? 0 : offsetRef.current;
      
      const [dashRes, suggestionsRes] = await Promise.all([
        api.get(`/posts/feed?offset=${currentOffset}&limit=10&seed=${deviceSeed}&device_id=${deviceId}${force ? '&force=true' : ''}`),
        isInitial ? api.get(`/users/suggestions?seed=${deviceSeed}${force ? '&force=true' : ''}`).catch(() => ({ data: { suggestions: [] } })) : Promise.resolve({ data: { suggestions: [] } })
      ]);
      
      const newPosts = Array.isArray(dashRes.data) ? dashRes.data : (dashRes.data.feed || dashRes.data.posts || []);
      
      if (isInitial) {
        setPosts(newPosts);
        lastSyncTime.current = Date.now();
        if (suggestionsRes.data.suggestions) setSuggestions(suggestionsRes.data.suggestions);
        setTrendingTags([
          { tag: 'campus_life', count: '12.4k' },
          { tag: 'campus_talk', count: '8.8k' },
          { tag: 'announcements', count: '5.1k' },
          { tag: 'campus_vibes', count: '942' }
        ]);
      } else {
        appendPosts(newPosts);
      }

      if (newPosts.length > 0) {
        offsetRef.current = isInitial ? newPosts.length : offsetRef.current + newPosts.length;
      }
      
      setHasMore(newPosts.length === 10);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [lastFetched, posts.length, setPosts, appendPosts, setSuggestions]);

  useEffect(() => {
    const hidden = JSON.parse(localStorage.getItem('hiddenPostIds') || '[]');
    setHiddenPostIds(hidden);

    const handlePostHidden = (e: any) => {
      const postId = e.detail;
      setHiddenPostIds(prev => [...prev, postId]);
    };

    const handleFocus = () => {
      fetchDeltaData();
    };

    window.addEventListener('postHidden', handlePostHidden);
    window.addEventListener('focus', handleFocus);

    const handleScrollToTop = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      fetchDashboardData(true, true);
      fetchStoriesData();
    };
    window.addEventListener('scrollDashboardToTop', handleScrollToTop);
    
    return () => {
      window.removeEventListener('postHidden', handlePostHidden);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('scrollDashboardToTop', handleScrollToTop);
    };
  }, [fetchDashboardData, fetchDeltaData, fetchStoriesData]);

  const { refreshCounter } = useModalStore();
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const storyJustPosted = sessionStorage.getItem('sparkle_story_posted');
    if (isInitialMount.current || refreshCounter > 0 || storyJustPosted) {
      fetchDashboardData(true, true);
      fetchStoriesData();
      isInitialMount.current = false;
      if (storyJustPosted) {
        sessionStorage.removeItem('sparkle_story_posted');
      }
    }
  }, [refreshCounter, fetchDashboardData, fetchStoriesData]);

  // Feed managed by VirtualizedFeed component
  
  return (
    <>
    <AppScreen immersive={true} className="flex min-h-screen font-sans overflow-x-hidden transition-colors duration-300">
      <Navbar />

      <main className="flex-1 lg:ml-72 p-0 sm:p-2 lg:p-8 relative z-10 max-w-[1035px] mx-auto w-full pt-[calc(4rem+env(safe-area-inset-top))] lg:pt-8 pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <div className="bg-white dark:bg-[#000000] rounded-lg shadow-sm p-4 mt-2 animate-fade-in border border-black/5 dark:border-white/5">
          <div className="flex gap-4 items-center mb-5">
            <img src={getAvatarUrl(user?.avatar_url, user?.username)} className="w-11 h-11 rounded-full object-cover border border-black/5 dark:border-white/10 shadow-sm" alt="" />
            <button onClick={() => setActiveModal('feeling')} className="flex-1 h-11 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-black dark:text-white rounded-lg px-5 text-left transition-colors font-medium text-sm">
              What's on your mind, {user?.name || user?.username}?
            </button>
          </div>
          <div className="border-t border-black/5 dark:border-white/5 pt-3 flex items-center justify-around">
            <label className="flex items-center gap-2.5 px-4 py-2 hover:bg-red-500/5 rounded-xl transition-all cursor-pointer group text-red-500/60 dark:text-red-400">
              <Video size={20} className="text-red-500 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest">Video</span>
              <input type="file" className="hidden" accept="video/*" onChange={(e) => { setActiveModal('post', null, { initialFiles: Array.from(e.target.files || []) }); }} />
            </label>
            <label className="flex items-center gap-2.5 px-4 py-2 hover:bg-emerald-500/5 rounded-xl transition-all cursor-pointer group text-emerald-500/60 dark:text-emerald-400">
              <Image size={20} className="text-emerald-500 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest">Photo</span>
              <input type="file" multiple className="hidden" accept="image/*,video/*" onChange={(e) => { setActiveModal('post', null, { initialFiles: Array.from(e.target.files || []) }); }} />
            </label>
            <button onClick={() => setActiveModal('post')} className="flex items-center gap-2.5 px-4 py-2 hover:bg-amber-500/5 rounded-xl transition-all group text-amber-500/60 dark:text-amber-400">
              <Smile size={20} className="text-amber-500 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest">Feeling</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8 mt-0.5 lg:mt-0">
          <section className="flex flex-col gap-0 bg-white dark:bg-black">
            {!isProfileCardDismissed && profileCompletion < 100 && (
              <div className="bg-gradient-to-r from-rose-50 to-rose-100 dark:from-zinc-900/40 dark:to-zinc-800/40 border border-rose-200/50 dark:border-zinc-700/50 rounded-2xl p-5 mb-4 relative overflow-hidden shadow-sm animate-scale-up">
                <button
                  onClick={dismissProfileCard}
                  className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                  aria-label="Dismiss"
                >
                  <Plus className="rotate-45" size={18} />
                </button>
                <div className="flex gap-4 items-center">
                  <div className="w-12 h-12 bg-rose-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-rose-500/20">
                     <Sparkles size={24} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-sm text-slate-850 dark:text-zinc-100 uppercase tracking-wide">Complete your profile</h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Add info to help other students find you on campus.</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-black text-rose-500">{profileCompletion}%</span>
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Complete</span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 bg-rose-200/40 dark:bg-zinc-700 rounded-full mt-4 overflow-hidden">
                  <div
                    className="h-full bg-rose-500 transition-all duration-500"
                    style={{ width: `${profileCompletion}%` }}
                  />
                </div>
                {/* Checklist items list */}
                <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4 pt-3 border-t border-rose-200/30 dark:border-zinc-700/30">
                  {[
                    { label: 'Name', met: !!user?.name },
                    { label: 'Username', met: !!user?.username },
                    { label: 'Photo', met: !!user?.avatar_url },
                    { label: 'Bio', met: !!user?.bio },
                    { label: 'Campus', met: !!user?.campus },
                    { label: 'Major', met: !!user?.major }
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[10px] font-bold">
                      <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${item.met ? 'bg-emerald-500 text-white' : 'bg-slate-200 dark:bg-zinc-700 text-slate-400'}`}>
                        {item.met ? '✓' : '○'}
                      </span>
                      <span className={item.met ? 'text-slate-700 dark:text-zinc-300' : 'text-slate-400 dark:text-zinc-500'}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* STORIES - GENIUS RING & BADGE IMPLEMENTATION (Requirement) */}
            <div className="animate-fade-in py-0.5 px-2 sm:px-0 bg-white dark:bg-black sm:bg-transparent rounded-[8px] sm:rounded-none border-none shadow-none">
              <div className="flex gap-2 overflow-x-auto py-2 no-scrollbar px-2 sm:px-0">
                {/* Add Story Card — 118×210 */}
                <div onClick={() => navigate('/afterglow/create')} className="flex-shrink-0 w-[118px] h-[210px] bg-white dark:bg-black rounded-xl shadow-lg cursor-pointer group relative overflow-hidden transition-all hover:brightness-95 active:scale-[0.98] border border-black/5 dark:border-white/10">
                  <div className="h-[158px] w-full overflow-hidden">
                    <img src={getAvatarUrl(user?.avatar_url, user?.username)} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
                  </div>
                  <div className="h-[52px] w-full flex flex-col items-center justify-end pb-3 relative bg-white dark:bg-[#121212]">
                    <div className="absolute top-[-20px] w-10 h-10 bg-primary rounded-full border-4 border-white dark:border-[#121212] flex items-center justify-center text-white shadow-xl z-10"><Plus size={24} strokeWidth={4} /></div>
                    <span className="text-[11px] font-black uppercase tracking-widest text-black dark:text-white">Add Story</span>
                  </div>
                </div>

                {/* Uploading "You" Card — 118×210 */}
                {activeUploads.length > 0 && (
                  <div
                    onClick={() => setShowUploadSheet(true)}
                    className="flex-shrink-0 w-[118px] h-[210px] rounded-xl shadow-lg cursor-pointer relative overflow-hidden group transition-all hover:brightness-90 active:scale-[0.98] border-2 border-purple-500/40"
                  >
                    {/* Background: blurred thumbnail or gradient */}
                    {activeUploads[0]?.localUri ? (
                      <img
                        src={activeUploads[0].thumbnailUri || activeUploads[0].localUri}
                        className="w-full h-full object-cover blur-[4px] scale-110"
                        alt=""
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-900 via-purple-700 to-pink-600" />
                    )}
                    <div className="absolute inset-0 bg-black/40" />

                    {/* Purple animated ring avatar */}
                    <div className="absolute top-3 left-3 w-10 h-10 rounded-full relative z-10">
                      <div className="absolute inset-[-4px] rounded-full border-[3px] border-purple-500 shadow-[0_0_16px_rgba(168,85,247,0.6)] animate-pulse" />
                      <div className="w-full h-full rounded-full border-2 border-black/10 dark:border-white/10 overflow-hidden relative">
                        <img
                          src={getAvatarUrl(user?.avatar_url, user?.username)}
                          className="w-full h-full object-cover"
                          alt=""
                        />
                      </div>
                      {/* Upload count badge */}
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-purple-500 text-white text-[10px] font-black rounded-full border-2 border-white dark:border-black flex items-center justify-center shadow-lg"
                      >
                        {activeUploads.length}
                      </motion.div>
                    </div>

                    {/* Progress bar at bottom */}
                    <div className="absolute inset-x-0 bottom-0">
                      <div className="p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <CloudUpload size={10} className="text-purple-400 animate-pulse" />
                          <p className="text-[10px] font-black text-white uppercase tracking-widest">You</p>
                        </div>
                        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                            animate={{ width: `${Math.round(activeUploads.reduce((s, j) => s + j.progress, 0) / activeUploads.length)}%` }}
                            transition={{ duration: 0.3 }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Story Cards — 118×210 premium */}
                {stories.map((group: StoryGroup) => {
                  const unviewed = group.unviewed_count || (group.is_fully_viewed ? 0 : group.stories.length);
                  const firstStory = group.stories[0];
                  const previewUrl = getStoryPreviewUrl(firstStory, group.avatar_url);
                  const isVideo = firstStory?.media_type === 'video';
                  const duration = formatDuration(firstStory?.duration);
                  const storyAge = firstStory?.created_at
                    ? (() => {
                        const diff = Date.now() - new Date(firstStory.created_at).getTime();
                        const mins = Math.floor(diff / 60000);
                        if (mins < 60) return `${mins}m ago`;
                        const hrs = Math.floor(mins / 60);
                        if (hrs < 24) return `${hrs}h ago`;
                        return `${Math.floor(hrs / 24)}d ago`;
                      })()
                    : null;

                  return (
                    <div
                      key={group.user_id}
                      onClick={() => navigate(`/stories/${group.user_id}`)}
                      className="flex-shrink-0 w-[118px] h-[210px] rounded-xl shadow-lg cursor-pointer relative overflow-hidden group transition-all hover:brightness-90 active:scale-[0.98]"
                    >
                      {/* Background preview — thumbnail → media_url → placeholder */}
                      <img
                        src={previewUrl}
                        onError={(e) => {
                          const el = e.currentTarget;
                          if (el.src !== (firstStory?.media_url || '')) {
                            el.src = firstStory?.media_url || '/assets/story_placeholder.png';
                          } else {
                            el.src = '/assets/story_placeholder.png';
                          }
                        }}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                        alt={`${group.username}'s story`}
                      />
                      <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />

                      {/* Video indicator — centered play + bottom-right duration */}
                      {isVideo && (
                        <>
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center shadow-lg">
                              <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4 ml-0.5"><polygon points="5,3 19,12 5,21" /></svg>
                            </div>
                          </div>
                          {duration && (
                            <span className="absolute bottom-10 right-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm z-10">
                              {duration}
                            </span>
                          )}
                        </>
                      )}

                      {/* Avatar — top-left, clickable to profile */}
                      <div
                        className="absolute top-3 left-3 z-20"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/profile/${group.username}`);
                        }}
                      >
                        <div className="w-10 h-10 rounded-full relative cursor-pointer">
                          {/* Gradient ring */}
                          <div
                            className={`absolute inset-[-3px] rounded-full p-[2.5px] shadow-md ${
                              unviewed > 0 ? 'story-ring-unviewed' : 'story-ring-viewed'
                            }`}
                          >
                            <div className="w-full h-full rounded-full bg-transparent" />
                          </div>
                          {/* White border separator */}
                          <div className="absolute inset-[-1px] rounded-full border-2 border-white shadow-sm" />
                          {/* Avatar image */}
                          <img
                            src={getAvatarUrl(group.avatar_url, group.username)}
                            className="w-full h-full rounded-full object-cover relative z-10"
                            alt={group.username}
                          />
                          {/* Unread count badge */}
                          {unviewed > 0 && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-primary text-white text-[10px] font-black rounded-full border-2 border-white dark:border-black flex items-center justify-center shadow-lg z-20"
                            >
                              {unviewed}
                            </motion.div>
                          )}
                        </div>
                      </div>

                      {/* Bottom overlay — username + timestamp */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent pt-8 pb-2.5 px-2.5 z-10">
                        <p className="text-[11px] font-bold text-white truncate leading-tight">
                          {group.username || group.user_name}
                        </p>
                        {storyAge && (
                          <p className="text-[9px] text-white/60 font-normal truncate leading-tight mt-0.5">
                            {storyAge}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Upload Details Bottom Sheet */}
            <AnimatePresence>
              {showUploadSheet && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
                  onClick={() => setShowUploadSheet(false)}
                >
                  <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                    className="absolute bottom-0 left-0 right-0 bg-[#0a0a0c] rounded-t-3xl border-t border-white/10 max-h-[60vh] overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Handle */}
                    <div className="flex justify-center pt-3 pb-2">
                      <div className="w-10 h-1 bg-white/20 rounded-full" />
                    </div>

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 pb-3">
                      <h3 className="text-[13px] font-black uppercase tracking-widest text-white">
                        <CloudUpload size={14} className="inline mr-2 text-purple-400" />
                        Uploading {activeUploads.length} {activeUploads.length === 1 ? 'Story' : 'Stories'}
                      </h3>
                      <button
                        onClick={() => setShowUploadSheet(false)}
                        className="p-1.5 rounded-full bg-white/5 text-white/60 hover:text-white"
                      >
                        <XIcon size={14} />
                      </button>
                    </div>

                    {/* Job List */}
                    <div className="px-5 pb-6 space-y-3 overflow-y-auto max-h-[45vh]">
                      {uploadJobs
                        .filter((j) => j.type === 'STORY' && j.status !== 'PUBLISHED' && j.status !== 'CANCELLED')
                        .map((job) => (
                          <div
                            key={job.uploadId}
                            className="bg-white/5 rounded-xl p-3 border border-white/5 flex items-center gap-3"
                          >
                            {/* Mini Thumbnail */}
                            <div className="w-10 h-14 bg-black rounded-lg overflow-hidden flex-shrink-0 border border-white/10">
                              {job.thumbnailUri || job.localUri ? (
                                <img
                                  src={job.thumbnailUri || job.localUri}
                                  alt=""
                                  className="w-full h-full object-cover blur-[2px] scale-105"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-purple-900 to-pink-700" />
                              )}
                            </div>

                            {/* Progress Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-black text-white uppercase tracking-tight truncate">
                                {job.status === 'FAILED'
                                  ? job.error || 'Upload failed'
                                  : job.status === 'GENERATING_THUMBNAIL'
                                  ? 'Generating thumbnail...'
                                  : job.status === 'COMPRESSING'
                                  ? 'Compressing...'
                                  : job.status === 'UPLOADING'
                                  ? `Uploading ${job.progress}%`
                                  : job.status === 'VERIFYING'
                                  ? 'Finalizing...'
                                  : 'Queued'}
                              </p>
                              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-1.5">
                                <div
                                  className={`h-full transition-all duration-300 rounded-full ${
                                    job.status === 'FAILED'
                                      ? 'bg-rose-500'
                                      : 'bg-gradient-to-r from-purple-500 to-pink-500'
                                  }`}
                                  style={{ width: `${job.progress}%` }}
                                />
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex-shrink-0 flex items-center gap-1">
                              {job.status === 'FAILED' && (
                                <button
                                  onClick={() => {
                                    retryUploadJob(job.uploadId);
                                    useUploadNotificationStore.getState().resetJob(job.uploadId);
                                  }}
                                  className="p-1.5 rounded-md bg-white/5 text-emerald-400 hover:bg-white/10 active:scale-90 transition-all"
                                  title="Retry"
                                >
                                  <RefreshCw size={12} />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (job.status === 'FAILED') {
                                    discardUploadJob(job.uploadId);
                                    useUploadNotificationStore.getState().dismissJob(job.uploadId);
                                  } else {
                                    cancelUploadJob(job.uploadId);
                                    useUploadNotificationStore.getState().dismissJob(job.uploadId);
                                  }
                                }}
                                className="p-1.5 rounded-md bg-white/5 text-rose-400 hover:bg-white/10 active:scale-90 transition-all"
                                title={job.status === 'FAILED' ? 'Discard' : 'Cancel'}
                              >
                                <XIcon size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* FEED */}
            <div className="space-y-[3px] sm:space-y-3 pb-48 animate-fade-in mt-[-8px]">
              <VirtualizedFeed initialPosts={posts} suggestions={suggestions} />
            </div>
          </section>

          {/* Sidebar */}
          <aside className="hidden xl:flex flex-col gap-4 sticky top-24 h-fit animate-fade-in">
            <div className="bg-white dark:bg-[#121212] rounded-2xl border border-black/5 dark:border-white/10 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[11px] font-black text-black/30 dark:text-white/30 uppercase tracking-widest">Connect</h3>
                <Link to="/connect" className="text-[10px] font-black text-primary hover:underline uppercase tracking-widest">View All</Link>
              </div>
              <div className="space-y-4">{suggestions.length > 0 ? suggestions.map(s => <SuggestionItem key={s.user_id} s={s} navigate={navigate} />) : <div className="flex flex-col items-center py-8 gap-4 opacity-30"><Spinner size="medium" color="text-black/30 dark:text-white/30" /><p className="text-[12px] font-semibold text-black/30 dark:text-white/30 uppercase tracking-widest text-center">No Suggestions</p></div>}</div>
            </div>
            {/* Trending */}
            <div className="bg-white dark:bg-[#121212] rounded-2xl border border-black/5 dark:border-white/10 p-6 shadow-sm overflow-hidden group">
               <div className="flex flex-col gap-6">
                  <h3 className="text-[11px] font-black text-black/30 dark:text-white/30 uppercase tracking-widest">Hot Right Now</h3>
                  <div className="space-y-3">{trendingTags.map(tag => (
                      <Link key={tag.tag} to={`/search?q=${tag.tag}`} className="block p-4 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 hover:border-primary/20 rounded-2xl transition-all group/tag">
                         <div className="flex items-center justify-between">
                            <p className="text-[15px] font-black text-black dark:text-white group-hover/tag:text-primary italic uppercase tracking-tight">#{tag.tag}</p>
                            <TrendingUp size={14} className="text-primary opacity-0 group-hover/tag:opacity-100 transition-opacity" />
                         </div>
                         <p className="text-[10px] font-bold text-black/30 dark:text-white/30 mt-1 uppercase tracking-widest">{tag.count} Sparks</p>
                      </Link>
                    ))}</div>
                  <Link to="/explore" className="w-full h-11 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-center gap-2 text-[11px] font-black text-black/40 dark:text-white/40 hover:bg-black/10 dark:hover:bg-white/10 hover:text-black dark:hover:text-white transition-all group/more uppercase tracking-widest">Explore More <ChevronRight size={14} className="group-hover/more:translate-x-1 transition-transform" /></Link>
               </div>
            </div>
          </aside>
        </div>
      </main>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes bounce-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
        .animate-bounce-slow { animation: bounce-slow 4s infinite ease-in-out; }
        .animate-spin-slow { animation: spin 15s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </AppScreen>
    </>
  );
}

export default function Dashboard() {
  return (
    <PullToRefreshProvider>
      <DashboardContent />
    </PullToRefreshProvider>
  );
}
