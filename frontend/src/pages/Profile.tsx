import { showError, showInfo } from '../utils/toast';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import FollowListModal from '../components/modals/FollowListModal';
import { useModalStore } from '../store/modalStore';
import type { User } from '../types/user';
import type { Post } from '../types/post';
import { Grid, Bookmark, UserSquare, Clapperboard, Link as LinkIcon, MessageSquare, Heart, Plus, History, Image as ImageIcon, Zap, TrendingUp, ChevronDown, LayoutDashboard, Camera, ShieldCheck, LayoutGrid, List } from 'lucide-react';
import { getAvatarUrl } from '../utils/imageUtils';
import { motion, AnimatePresence } from 'framer-motion';
import SparkleHub from '../components/SparkleHub';
import Spinner from '../components/ui/Spinner';
import ModernOfflineState from '../components/ui/ModernOfflineState';
import { IdentityManager } from '../utils/identityManager';
import { VerifiedBadge } from '../components/common/VerifiedBadge';
import EditProfileModal from '../components/profile/EditProfileModal';
import { logger } from '../utils/logger';

export default function Profile() {
  const { username } = useParams();
  const { user: currentUser, accounts, switchAccount } = useUserStore();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<User | null>(null);
  // null = loaded fine. 'not_found' = 404, the account genuinely doesn't exist.
  // 'unavailable' = 500/network/timeout, transient — the account may well be fine.
  const [profileError, setProfileError] = useState<'not_found' | 'unavailable' | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [reels, setReels] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved' | 'tagged'>('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRequested, setIsRequested] = useState(false);
  const [modalType, setModalType] = useState<'Followers' | 'Following' | null>(null);
  const { setActiveModal } = useModalStore();
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showSparkleHub, setShowSparkleHub] = useState(false);

  const identity = IdentityManager.resolveIdentity(profile);

  const handleOpenChat = async () => {
    const targetId = profile?.user_id || profile?.id;
    if (!targetId && !profile?.username) return;

    setIsOpeningChat(true);
    try {
      const res = await api.post('/messages/open', {
        partnerId: targetId,
        username: profile?.username
      });
      const convId = res.data?.data?.conversationId || res.data?.data?.chatId;
      if (convId) {
        navigate(`/messages?chat=${convId}`);
      } else {
        navigate('/messages');
      }
    } catch (err) {
      logger.error('Failed to open conversation:', err);
      showError('Could not open conversation. Please check your connection and try again.');
    } finally {
      setIsOpeningChat(false);
    }
  };

  // Highlights
  const [highlights, setHighlights] = useState<{ id: string; title: string; cover_url: string; story_count: number }[]>([]);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setActiveTab('posts'); 
    try {
      const endpoint = username === 'me' ? '/users/me' : `/users/${encodeURIComponent(username || '')}`;
      const profileRes = await api.get(endpoint);
      if (profileRes.data) {
        const profileData = profileRes.data;
        setProfile(profileData);
        setIsFollowing(profileData.is_followed_by_me);
        setIsRequested(profileData.is_requested_by_me);

        // Posts are secondary: a failure here must not wipe the loaded profile
        try {
          const postsRes = await api.get(`/users/${profileData.id || profileData.user_id}/posts`);
          if (postsRes.data && Array.isArray(postsRes.data)) {
            const allPosts = postsRes.data.sort((a: Post, b: Post) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0));
            setPosts(allPosts);
            setReels(allPosts.filter((p: Post) => p.media_type === 'video' || (p.media_url && p.media_url.match(/\.(mp4|webm|ogg|mov)$/i))));
          }
        } catch (err) {
          logger.error('Failed to fetch posts:', err);
          setPosts([]);
          setReels([]);
        }
      }
    } catch (err) {
      logger.error('Failed to fetch profile:', err);
      const status = (err as { response?: { status?: number } })?.response?.status;
      // Only a 404 means the account truly doesn't exist. A 500, network error,
      // or timeout is transient and must NOT be presented as "vanished".
      setProfileError(status === 404 ? 'not_found' : 'unavailable');
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
      logger.error('Failed to fetch highlights:', err);
    }
  }, []);

  const fetchSaved = useCallback(async () => {
    try {
      const res = await api.get('/posts/saved');
      setSavedPosts(res.data || []);
    } catch (err) {
      logger.error('Failed to fetch saved posts:', err);
    }
  }, []);

  useEffect(() => {
    if (currentUser) fetchProfile();
  }, [fetchProfile, currentUser]);

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
      logger.error('Failed to load highlight:', err);
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

  useEffect(() => {
    const handleProfileUpdated = (e: Event) => {
      const customEv = e as CustomEvent;
      const updated = customEv.detail;
      const currentProfileId = profile?.id || profile?.user_id;
      if (updated && currentProfileId && String(updated.user_id) === String(currentProfileId)) {
        setProfile((prev) => (prev ? { ...prev, ...updated } : prev));
      }
    };
    window.addEventListener('sparkle:profile_updated', handleProfileUpdated);
    return () => window.removeEventListener('sparkle:profile_updated', handleProfileUpdated);
  }, [profile]);

  const handleFollowToggle = async () => {
    if (!profile) return;
    if (isRequested) {
      showInfo('Follow request already sent — waiting for approval.');
      return;
    }
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
      logger.error('Follow toggle failed:', err);
      showError('Could not update follow. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex bg-[#fdf2f4] dark:bg-black min-h-dvh text-[#18181b] dark:text-white overflow-x-hidden font-sans transition-colors duration-300">
        <div className="flex-1 flex flex-col items-center justify-center transition-all text-[#18181b] dark:text-white">
          <div className="relative mb-20">
            <Spinner size="xl" color="text-primary" />
          </div>
          <div className="text-[12px] font-bold text-black/60 dark:text-white/40 uppercase tracking-widest">
            Loading your profile
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    const isGenuinelyMissing = profileError === 'not_found';
    return (
        <div className="flex bg-white dark:bg-black min-h-dvh text-[#18181b] dark:text-white overflow-x-hidden font-sans pb-[var(--safe-area-inset-bottom,env(safe-area-inset-bottom))]">
        <div className="flex-1 flex items-center justify-center p-12">
           <ModernOfflineState
             type="error"
             title={isGenuinelyMissing ? 'Ghost Profile' : "Can't load this profile"}
             message={
               isGenuinelyMissing
                 ? 'This sparkle account seems to have vanished or never existed in our campus directory.'
                 : "We're having trouble reaching Sparkle's servers right now. This doesn't mean the account is gone — try again in a moment."
             }
             onRetry={() => fetchProfile()}
           />
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
    <div className="flex bg-white dark:bg-black min-h-dvh text-[#18181b] dark:text-white overflow-x-hidden font-sans pt-20">

      {/* Top Navigation Bar */}
      <header className="md:hidden fixed top-0 left-0 w-full bg-white/40 dark:bg-black/80 backdrop-blur-3xl flex justify-between items-center z-(--z-header) px-5 pt-[calc(1rem+var(--safe-area-inset-top,env(safe-area-inset-top)))] pb-4 transition-all">
        <a className="flex items-center gap-2.5 active:scale-95 transition-transform" href="/dashboard" data-discover="true">
          <span className="font-heading font-black text-xl tracking-tighter text-[#18181b] dark:text-white">Sparkle</span>
        </a>
        {accounts.length > 1 && (
          <button
            type="button"
            onClick={() => setShowAccountMenu(!showAccountMenu)}
            className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center text-black/30 dark:text-white/40 hover:bg-black/10 dark:hover:bg-white/10 transition-colors active:scale-90"
          >
            <img
              src={getAvatarUrl(currentUser?.avatar_url, currentUser?.username)}
              alt={currentUser?.username || 'Account'}
              className="w-full h-full rounded-full object-cover border border-black/5 dark:border-white/5"
            />
          </button>
        )}
        {showAccountMenu && (
          <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-black rounded-xl shadow-2xl border border-black/5 dark:border-white/10 p-2 z-[1001]">
            <div className="px-3 py-2 border-b border-black/5 dark:border-white/5 mb-2">
              <span className="text-[10px] font-bold text-black/30 dark:text-white/30 uppercase tracking-widest">Accounts</span>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto no-scrollbar">
              {accounts.map((acc) => (
                <button
                  key={acc.user.user_id}
                  onClick={() => {
                    switchAccount(acc.user.user_id);
                    setShowAccountMenu(false);
                    navigate(`/profile/${acc.user.username}`);
                  }}
                  className={`w-full p-2.5 flex items-center gap-3 rounded-xl transition-colors text-left ${acc.user.user_id === currentUser?.user_id ? 'bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                >
                  <img
                    src={getAvatarUrl(acc.user.avatar_url, acc.user.username)}
                    alt={acc.user.username}
                    className="w-8 h-8 rounded-full object-cover border border-black/5 dark:border-white/5"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#18181b] dark:text-white">{acc.user.username}</span>
                    {acc.user.user_id === currentUser?.user_id && (
                      <span className="text-[9px] text-black/40 dark:text-white/40 font-medium uppercase tracking-tight">Active account</span>
                    )}
                  </div>
                  {acc.user.user_id === currentUser?.user_id && (
                    <div className="ml-auto w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  )}
                  </button>
              ))}
            </div>
            <div className="border-t border-black/5 dark:border-white/5 pt-2 mt-2">
              <button
                onClick={() => { setShowAccountMenu(false); navigate('/settings'); }}
                className="w-full p-2.5 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl text-left"
              >
                <ShieldCheck size={16} className="text-black/40 dark:text-white/40" />
                <span className="text-xs font-black uppercase tracking-tight text-[#18181b] dark:text-white">Account Settings</span>
              </button>
            </div>
            <div className="border-t border-black/5 dark:border-white/5 pt-2 mt-2">
              <button
                onClick={() => { setShowAccountMenu(false); navigate('/login'); }}
                className="w-full p-2.5 flex items-center gap-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-xl text-left"
              >
                <Plus size={16} className="text-black/40 dark:text-white/40" />
                <span className="text-xs font-black uppercase tracking-tight text-[#18181b] dark:text-white">Add Sparkle Account</span>
              </button>
            </div>
          </div>
        )}
        <div className="flex-1 mx-4">
          <button type="button" aria-label="Search" onClick={() => navigate('/search')} className="bg-black/5 dark:bg-white/5 h-10 rounded-2xl flex items-center px-4 gap-3 text-black/30 dark:text-white/30 border border-black/5 dark:border-white/5 transition-all active:bg-white dark:active:bg-white/10 w-full min-w-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-search" aria-hidden="true">
              <path d="m21 21-4.34-4.34"></path>
              <circle cx="11" cy="11" r="8"></circle>
            </svg>
            <span className="text-[12px] font-bold">Search...</span>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <a className="relative w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center text-black/30 hover:text-primary transition-all active:scale-90" href="/notifications" data-discover="true">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bell" aria-hidden="true">
              <path d="M10.268 21a2 2 0 0 0 3.464 0"></path>
              <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"></path>
            </svg>
          </a>
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setShowSparkleHub(true)}
            className="w-10 h-10 bg-black/5 dark:bg-white/5 rounded-xl flex items-center justify-center text-black/40 dark:text-white/40 hover:bg-black/10 dark:hover:bg-white/10 transition-colors active:scale-90"
          >
            <LayoutGrid size={20} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 relative z-10 w-full pb-[calc(5rem+var(--safe-area-inset-bottom,env(safe-area-inset-bottom)))]">
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      if (profile?.has_story) setShowAvatarMenu(true);
                      else setActiveModal('media_preview', null, { url: getAvatarUrl(profile?.avatar_url, profile?.username) });
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className={`w-full h-full rounded-full ${profile?.has_story ? 'p-1 bg-white dark:bg-black' : ''}`}>
                    <img
                      src={identity.avatar}
                      alt={profile?.username ? `${profile.username}'s profile picture` : 'Profile picture'}
                      className="w-full h-full rounded-full object-cover border border-black/5 dark:border-white/5"
                    />
                  </div>
                </div>

                {/* Avatar Quick Edit Badge for Owner */}
                {showOwnerActions && (
                  <button
                    type="button"
                    aria-label="Edit Profile Photo"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowEditProfileModal(true);
                    }}
                    className="absolute bottom-0 right-0 z-20 w-8 h-8 md:w-9 md:h-9 rounded-full bg-pink-500 hover:bg-pink-600 text-white flex items-center justify-center shadow-lg shadow-pink-500/30 border-2 border-white dark:border-black active:scale-90 transition-all cursor-pointer"
                  >
                    <Camera size={15} />
                  </button>
                )}

                {/* Avatar Action Menu */}
                <AnimatePresence>
                  {showAvatarMenu && (
                    <>
                      <div className="fixed inset-0 z-(--z-chrome)" onClick={() => setShowAvatarMenu(false)} />
                      <motion.div
                         initial={{ opacity: 0, x: 20 }}
                         animate={{ opacity: 1, x: 0 }}
                         exit={{ opacity: 0, x: 20 }}
                         className="absolute top-0 left-full ml-4 z-[1001] bg-white dark:bg-black rounded-[14px] shadow-2xl border border-black/5 dark:border-white/10 p-2 flex flex-col gap-1 min-w-[180px]"
                      >
                         <button
                           onClick={(e) => { e.stopPropagation(); setShowAvatarMenu(false); navigate(`/stories/${profile?.id || profile?.user_id}`); }}
                           className="w-full px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors flex items-center gap-3"
                         >
                           <History size={18} className="text-primary" />
                           <span className="text-sm font-bold text-[#18181b] dark:text-white tracking-tight">View Story</span>
                         </button>
                         <button
                           onClick={(e) => { e.stopPropagation(); setShowAvatarMenu(false); setActiveModal('media_preview', null, { url: getAvatarUrl(profile?.avatar_url, profile?.username) }); }}
                           className="w-full px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors flex items-center gap-3"
                         >
                           <ImageIcon size={18} className="text-black/40 dark:text-white/40" />
                           <span className="text-sm font-bold text-[#18181b] dark:text-white tracking-tight">View Picture</span>
                         </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>

                {/* Note Bubble Removed */}
              </div>

              {/* Info Column (Beside Avatar) */}
              <div className="flex-1 flex flex-col pt-2">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-xl md:text-2xl font-black text-[#18181b] dark:text-white tracking-tight flex items-center gap-1.5">
                    {identity.displayName}
                    <VerifiedBadge accountType={identity.accountType} isVerified={identity.badge.show} color={identity.badge.color} size="md" />
                  </h1>

                  {/* Stats Row Beside Username */}
                  <div className="flex items-center gap-6 ml-4 md:ml-8 border-l border-black/5 dark:border-white/5 pl-4 md:pl-8">
                    <div className="flex flex-col items-center">
                      <span className="text-sm md:text-base font-black text-[#18181b] dark:text-white leading-none">{posts.length}</span>
                      <span className="text-[11px] font-bold text-[#18181b] dark:text-white/40 uppercase tracking-widest">Posts</span>
                    </div>
                    <div className="flex flex-col items-center cursor-pointer hover:opacity-70 transition-opacity" onClick={() => setModalType('Followers')}>
                      <span className="text-sm md:text-base font-black text-[#18181b] dark:text-white leading-none">{profile?.followers_count || 0}</span>
                      <span className="text-[11px] font-bold text-[#18181b] dark:text-white/40 uppercase tracking-widest">Followers</span>
                    </div>
                    <div className="flex flex-col items-center cursor-pointer hover:opacity-70 transition-opacity" onClick={() => setModalType('Following')}>
                      <span className="text-sm md:text-base font-black text-[#18181b] dark:text-white leading-none">{profile?.following_count || 0}</span>
                      <span className="text-[11px] font-bold text-[#18181b] dark:text-white/40 uppercase tracking-widest">Following</span>
                    </div>
                  </div>
                </div>

                {identity.subtitle && (
                  <p className="text-xs font-semibold text-rose-500/90 dark:text-rose-400/90 mb-3 tracking-wide">
                    {identity.subtitle}
                  </p>
                )}

        <div className="flex items-center gap-3">
                  {showOwnerActions ? (
                    <div className="flex items-center gap-2">
                      {/* Edit Identity — refined Meta-style action button */}
                      <button
                        onClick={() => setShowEditProfileModal(true)}
                        className="group flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-semibold tracking-tight text-neutral-800 dark:text-neutral-100 bg-neutral-100/90 hover:bg-neutral-200/80 active:bg-neutral-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.12] dark:active:bg-white/[0.06] border border-neutral-200/80 dark:border-white/10 shadow-xs hover:shadow-sm active:scale-[0.98] transition-all duration-150"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300 transition-transform duration-150 group-hover:scale-105"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        <span>Edit Identity</span>
                      </button>

                      {/* Saved Messages — cohesive Meta-style action button */}
                      <button
                        onClick={handleOpenChat}
                        disabled={isOpeningChat}
                        className="group flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-semibold tracking-tight text-neutral-800 dark:text-neutral-100 bg-neutral-100/90 hover:bg-neutral-200/80 active:bg-neutral-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.12] dark:active:bg-white/[0.06] border border-neutral-200/80 dark:border-white/10 shadow-xs hover:shadow-sm active:scale-[0.98] transition-all duration-150 disabled:opacity-50"
                      >
                        {isOpeningChat ? (
                          <>
                            <Spinner size="small" text-pink-500 className="w-3.5 h-3.5" />
                            <span>Opening…</span>
                          </>
                        ) : (
                          <>
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300 transition-transform duration-150 group-hover:scale-105"
                            >
                              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                            </svg>
                            <span>Saved</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {isFollowing ? (
                        <button onClick={handleFollowToggle} className="px-6 py-3 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg text-xs font-bold text-[#18181b] dark:text-white transition-all uppercase tracking-widest border border-black/5 dark:border-white/5">
                          Following
                        </button>
                      ) : isRequested ? (
                        <button onClick={handleFollowToggle} className="px-6 py-2 bg-white dark:bg-white/5 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-xs font-bold text-black/50 dark:text-white/50 transition-all uppercase tracking-widest border border-dashed border-black/20 dark:border-white/20">
                          Requested
                        </button>
                      ) : (
                        <button onClick={handleFollowToggle} className="px-6 py-3 bg-[#FF1F6D] hover:scale-105 active:scale-95 rounded-lg text-xs font-bold text-white transition-all shadow-lg shadow-[#FF1F6D]/20 uppercase tracking-widest">
                          Follow
                        </button>
                      )}
                      <button 
                        onClick={handleOpenChat}
                        disabled={isOpeningChat}
                        className="px-6 py-3 bg-white dark:bg-white/5 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-xs font-bold text-[#18181b] dark:text-white transition-all uppercase tracking-widest shadow-sm active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isOpeningChat ? (
                          <>
                            <Spinner size="small" text-rose-500 className="w-3.5 h-3.5" />
                            <span>Opening...</span>
                          </>
                        ) : (
                          <span>Message</span>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 md:gap-6 w-full">
              <div className="flex flex-col sm:flex-row gap-4 w-full max-w-2xl text-center sm:text-left">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-widest">Reputation</span>
                    <span className="text-xs font-bold text-[#FF1F6D] uppercase tracking-widest">{profile.reputation?.prestigeScore || 0}% Power</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gray-300 dark:from-gray-600 via-gray-400 to-gray-300 rounded-full transition-all duration-700"
                      style={{ width: `${profile.reputation?.prestigeScore || 0}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2">
                  {showOwnerActions && (
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'spark_seed', color: 'from-amber-400 to-orange-500', icon: <Zap size={12} fill="currentColor" />, active: (profile.reputation?.trustLevel || 0) >= 1 },
                        { id: 'viral_node', color: 'from-emerald-400 to-cyan-500', icon: <TrendingUp size={12} />, active: (profile.reputation?.trustLevel || 0) >= 3 },
                        { id: 'verified_node', color: 'from-[#FF1F6D] to-purple-600', icon: <Heart size={12} fill="currentColor" />, active: !!profile.is_verified }
                      ].filter(b => b.active).map((badge, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${badge.color} text-white shadow-sm border border-white/20`}
                        >
                          {badge.icon}
                          <span>{badge.id.replace('_', ' ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {(profile?.campus || profile?.major) && (
                <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-3">
                  <span className="w-1 h-1 bg-primary rounded-full" />
                  {profile.campus} <span className="text-gray-400">|</span> {profile.major}
                </div>
              )}

              <div className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-4 max-w-xl">
                {profile?.bio || 'Initialize your node biography...'}
              </div>

              {profile?.website && (
                <a href={`https://${profile.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-bold text-[#FF1F6D] hover:underline mb-6 tracking-tight">
                  <LinkIcon size={14} strokeWidth={2.5} />
                  {profile.website.replace(/^https?:\/\//, '')}
                </a>
              )}

              {showOwnerActions && (
                <div
                  onClick={() => navigate('/professional-dashboard')}
                  className="bg-white/40 dark:bg-black/40 backdrop-blur-sm border border-black/[0.03] dark:border-white/5 rounded-2xl p-4 flex items-center justify-between group cursor-pointer hover:bg-white dark:hover:bg-white/5 hover:shadow-xl hover:shadow-primary/5 transition-all max-w-sm mb-6"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary/10 to-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <LayoutDashboard size={20} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-bold text-[#18181b] dark:text-white tracking-tight">Professional Dashboard</span>
                      <span className="text-[11px] text-black/40 dark:text-white/40 font-medium uppercase tracking-wider">Track your performance</span>
                    </div>
                  </div>
                  <ChevronDown className="text-black/10 dark:text-white/10 -rotate-90 group-hover:text-primary transition-colors" size={20} />
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
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border border-dashed border-black/30 dark:border-white/30 flex items-center justify-center group-hover:bg-black/5 dark:group-hover:bg-white/5 transition-colors">
                  <Plus size={24} className="text-black/50 dark:text-white/50" />
                </div>
                <span className="text-xs font-medium text-[#18181b] dark:text-white">New</span>
              </div>
            )}

            {/* Real Highlights */}
            {highlights.map(h => (
              <div
                key={h.id}
                className="flex flex-col items-center gap-2 cursor-pointer group shrink-0"
                onClick={() => openHighlight(h.id, h.title)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openHighlight(h.id, h.title);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full p-0.5 bg-black/10 dark:bg-white/10 group-hover:bg-black/20 dark:group-hover:bg-white/20 transition-colors">
                  <div className="w-full h-full bg-white dark:bg-black rounded-full p-0.5 overflow-hidden">
                    {h.cover_url ? (
                      <img src={h.cover_url} className="w-full h-full rounded-full object-cover" alt={h.title} />
                    ) : (
                      <div className="w-full h-full rounded-full bg-black/10 flex items-center justify-center">
                        <span className="text-black/40 text-xl">{h.title[0]?.toUpperCase()}</span>
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-xs font-medium text-[#18181b] dark:text-white truncate max-w-[64px] text-center">{h.title}</span>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="relative flex items-center justify-center border-t border-black/10 dark:border-white/10 w-full mb-4">
            <div className="flex items-center justify-center gap-12">
              {([
              { id: 'posts',  label: 'POSTS',  icon: Grid },
              { id: 'reels',  label: 'REELS',  icon: Clapperboard },
              ...(showOwnerActions ? ([{ id: 'saved', label: 'SAVED', icon: Bookmark }] as const) : []),
              { id: 'tagged', label: 'TAGGED', icon: UserSquare }
            ] as const).map(tab => (
              <button 
                key={tab.id}
                className={`flex items-center gap-2 py-4 border-t font-semibold text-[12px] tracking-widest transition-all ${activeTab === tab.id ? 'border-black dark:border-white text-[#18181b] dark:text-white' : 'border-transparent text-black/50 dark:text-white/50 hover:text-black/70 dark:hover:text-white/70'}`} 
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={14} /> {tab.label}
              </button>
              ))}
            </div>
            <button
              type="button"
              aria-label={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="absolute right-0 p-2 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors"
            >
              {viewMode === 'grid' ? <List size={18} /> : <LayoutGrid size={18} />}
            </button>
          </div>

          {/* Grid Section */}
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 pb-32 animate-fade-in w-full'
                : 'flex flex-col gap-2 pb-32 animate-fade-in w-full'
            }
          >
            {(activeTab === 'posts' ? posts : activeTab === 'reels' ? reels : activeTab === 'saved' ? savedPosts : []).length > 0 ? (
              (activeTab === 'posts' ? posts : activeTab === 'reels' ? reels : activeTab === 'saved' ? savedPosts : []).map((post) => (
                <div
                    key={post.post_id}
                    className={`relative overflow-hidden group cursor-pointer bg-gray-100 dark:bg-white/5 ${viewMode === 'grid' ? 'aspect-square' : 'aspect-[4/3] md:aspect-[3/2] h-48'}`}
                    onClick={() => navigate(`/post/${post.post_id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/post/${post.post_id}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                >
                  <div className="w-full h-full relative">
                    {post.media_type === 'video' || (post.media_url && post.media_url.match(/\.(mp4|webm|ogg|mov)$/i)) ? (
                      <video src={post.media_url} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                    ) : (post.media_url || post.image_url) ? (
                      <img src={post.media_url || post.image_url} className="w-full h-full object-cover" alt={post.content || "Post image"} />
                    ) : (
                      <div className="w-full h-full flex flex-col justify-center items-center p-4 text-center text-[#18181b] dark:text-white">
                         <p className="font-medium text-[11px] md:text-xs italic opacity-60 leading-snug break-words line-clamp-4">
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
            <div className="col-span-full py-12">
                <ModernOfflineState 
                  type="empty"
                  title={activeTab === 'posts' ? 'No posts yet' : activeTab === 'reels' ? 'No reels yet' : activeTab === 'saved' ? 'Nothing saved' : 'Tagged posts unavailable'}
                  message={activeTab === 'posts'
                    ? showOwnerActions ? 'Create your first post to get started!' : 'This profile has not shared any posts yet.'
                    : activeTab === 'reels'
                      ? showOwnerActions ? 'Record your first reel to share moments.' : 'This profile has not shared any reels yet.'
                      : activeTab === 'saved'
                        ? 'Save posts you love to see them here.'
                        : 'Tagged posts are not currently available on profiles.'
                  }
                  primaryAction={showOwnerActions && (activeTab === 'posts' || activeTab === 'reels') ? {
                    label: 'Create post',
                    onClick: () => setActiveModal('post')
                  } : undefined}
                />
            </div>
          )}
        </div>

        <footer className="py-16 text-center border-t border-black/[0.03] dark:border-white/[0.03] relative">
          <div className="flex flex-wrap items-center justify-center gap-12 text-[11px] font-black text-black/20 dark:text-white/20 uppercase tracking-[0.3em] mb-12 italic">
            {['Community', 'Privacy', 'Safety', 'Terms', 'Connect'].map(item => (
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

      <EditProfileModal
        isOpen={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
        onProfileUpdated={(updatedUser) => {
          setProfile((prev) => (prev ? { ...prev, ...updatedUser } : updatedUser));
        }}
      />

      {showSparkleHub && <SparkleHub onClose={() => setShowSparkleHub(false)} />}

      <style>{`
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        .animate-fade-in-right { animation: fadeInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        .no-scrollbar::-webkit-scrollbar { display: none; }

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
