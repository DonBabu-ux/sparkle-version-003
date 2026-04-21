import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';
import type { User } from '../types/user';
import type { Post } from '../types/post';
import { Grid, Bookmark, UserSquare, Clapperboard, Settings as SettingsIcon, Link as LinkIcon, Plus, ArrowLeft, MoreHorizontal } from 'lucide-react';
import UserActionModal from '../components/modals/UserActionModal';

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
  const [actionItem, setActionItem] = useState<User | null>(null);

  // List Modal State
  const [listModal, setListModal] = useState<{ open: boolean; type: 'followers' | 'following'; data: User[] }>({
    open: false,
    type: 'followers',
    data: []
  });

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setActiveTab('posts'); // Reset tab when switching profiles
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

  const fetchSaved = useCallback(async () => {
    try {
      const res = await api.get('/posts/saved');
      setSavedPosts(res.data || []);
    } catch (err) {
      console.error('Failed to fetch saved posts:', err);
    }
  }, []);

  const fetchList = async (type: 'followers' | 'following') => {
    if (!profile) return;
    try {
      const res = await api.get(`/users/${profile.id || profile.user_id}/${type}`);
      setListModal({ open: true, type, data: res.data || [] });
    } catch (err) {
      console.error(`Failed to fetch ${type}:`, err);
    }
  };

  useEffect(() => {
    if (currentUser) fetchProfile();
  }, [fetchProfile, currentUser]);

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
      
      // Update stats count locally
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

  const handleListFollowToggle = async (userId: string, currentIndex: number) => {
    try {
      const res = await api.post(`/users/${userId}/follow`);
      const newData = [...listModal.data];
      newData[currentIndex] = {
        ...newData[currentIndex],
        is_followed_by_me: res.data.status === 'following'
      };
      setListModal(prev => ({ ...prev, data: newData }));
    } catch (err) {
      console.error('List follow toggle failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="profile-loading-screen">
        <i className="fas fa-sparkles animate-pulse text-4xl text-[#FF3D6D]"></i>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="ig-profile-root">
        <Navbar />
        <div className="ig-main-scroll flex items-center justify-center flex-col gap-4">
           <h2 className="text-2xl font-bold">Sorry, this page isn't available.</h2>
           <p className="text-slate-400">The link you followed may be broken, or the page may have been removed. <Link to="/" className="text-blue-500">Go back to Sparkle.</Link></p>
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
    <div className="ig-profile-root">
      <Navbar />
      
      <div className="ig-main-scroll">
        <div className="ig-profile-container">
          {/* Top Navigation Bar */}
          <nav className="ig-top-nav">
            <div className="ig-nav-left">
              <button onClick={() => navigate(-1)} className="ig-nav-btn">
                <ArrowLeft size={24} />
              </button>
              <h2 className="ig-nav-title">{profile?.username}</h2>
            </div>
            <div className="ig-nav-right">
              {!showOwnerActions && (
                <button 
                  className="ig-nav-btn"
                  onClick={() => {
                    const action = window.prompt("Type 'report' to report this user, or 'block' to block them:");
                    if (action === 'report') {
                      api.post(`/users/${profile?.user_id || profile?.id}/report`, { reason: 'inappropriate' })
                        .then(() => alert('User reported.'))
                        .catch(err => console.error(err));
                    } else if (action === 'block') {
                      api.post(`/users/${profile?.user_id || profile?.id}/block`)
                        .then(() => {
                          alert('User blocked.');
                          navigate(-1);
                        })
                        .catch(err => console.error(err));
                    }
                  }}
                >
                  <MoreHorizontal size={24} />
                </button>
              )}
            </div>
          </nav>

          {/* Header Section */}
          <header className="ig-profile-header">
            <div className="ig-avatar-column">
              <div className="ig-avatar-wrapper">
                <img src={profile?.avatar_url || '/uploads/avatars/default.png'} alt="" className="ig-avatar-img" />
              </div>
            </div>

            <section className="ig-info-column">
              <div className="ig-username-section">
                <h2 className="ig-username">{profile?.username}</h2>
                {profile?.is_verified && <i className="fas fa-certificate ig-verified-check"></i>}
              </div>

              <div className="ig-action-btns">
                {showOwnerActions ? (
                  <>
                    <button onClick={() => navigate('/settings')} className="ig-btn-subtle">Edit Profile</button>
                    <button className="ig-btn-subtle">View Archive</button>
                    <button className="ig-cog-btn"><SettingsIcon size={20} /></button>
                  </>
                ) : (
                  <>
                    {isFollowing ? (
                      <button onClick={handleFollowToggle} className="ig-btn-secondary">Following</button>
                    ) : isRequested ? (
                      <button className="ig-btn-secondary" disabled>Requested</button>
                    ) : (
                      <button onClick={handleFollowToggle} className="ig-btn-primary">Follow</button>
                    )}
                    <button onClick={() => navigate(`/messages/${profile?.user_id || profile?.id}`)} className="ig-btn-secondary">Message</button>
                  </>
                )}
              </div>

              <div className="ig-stats-row">
                <span><strong>{posts.length}</strong> posts</span>
                <span onClick={() => fetchList('followers')} className="cursor-pointer"><strong>{profile?.followers_count || 0}</strong> followers</span>
                <span onClick={() => fetchList('following')} className="cursor-pointer"><strong>{profile?.following_count || 0}</strong> following</span>
              </div>

              <div className="ig-bio-section">
                <h1 className="ig-full-name">{profile?.name || profile?.username}</h1>
                {profile?.major && <p className="ig-category text-[#a8a8a8]">{profile.major}</p>}
                <div className="ig-bio-text whitespace-pre-wrap">
                  {profile?.bio || (showOwnerActions ? "Add a bio to your profile." : "")}
                </div>
                {profile?.website && (
                  <a href={`https://${profile.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer" className="ig-website-link">
                    <LinkIcon size={12} style={{marginRight: 4}} />
                    {profile.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            </section>
          </header>

          {/* Highlights Section */}
          <div className="ig-highlights-row">
            {profile?.highlights?.map((h: { id: string, img: string, title: string }) => (
              <div key={h.id} className="ig-highlight-item">
                <div className="ig-highlight-circle">
                  <div className="ig-highlight-inner">
                    <img src={h.img} alt="" />
                  </div>
                </div>
                <span>{h.title}</span>
              </div>
            ))}
            {showOwnerActions && (
              <div className="ig-highlight-item" onClick={() => navigate('/afterglow/create')}>
                <div className="ig-highlight-circle ig-new-highlight">
                  <Plus size={44} strokeWidth={1} />
                </div>
                <span>New</span>
              </div>
            )}
          </div>

          {/* Tabs Section */}
          <div className="ig-tabs-border">
            <div className="ig-tabs-list">
              <button className={`ig-tab-item ${activeTab === 'posts' ? 'active' : ''}`} onClick={() => setActiveTab('posts')}>
                <Grid size={12} /> POSTS
              </button>
              <button className={`ig-tab-item ${activeTab === 'reels' ? 'active' : ''}`} onClick={() => setActiveTab('reels')}>
                <Clapperboard size={12} /> REELS
              </button>
              {showOwnerActions && (
                <button className={`ig-tab-item ${activeTab === 'saved' ? 'active' : ''}`} onClick={() => setActiveTab('saved')}>
                  <Bookmark size={12} /> SAVED
                </button>
              )}
              <button className={`ig-tab-item ${activeTab === 'tagged' ? 'active' : ''}`} onClick={() => setActiveTab('tagged')}>
                <UserSquare size={12} /> TAGGED
              </button>
            </div>
          </div>

          {/* Grid Section */}
          <div className="ig-posts-grid">
            {(activeTab === 'posts' ? posts : activeTab === 'reels' ? reels : activeTab === 'saved' ? savedPosts : []).length > 0 ? (activeTab === 'posts' ? posts : activeTab === 'reels' ? reels : activeTab === 'saved' ? savedPosts : []).map(post => (
              <div key={post.post_id} className="ig-post-square animate-fade-in" onClick={() => navigate(`/post/${post.post_id}`)}>
                {post.media_type === 'video' || (post.media_url && post.media_url.match(/\.(mp4|webm|ogg|mov)$/i)) ? (
                  <video src={post.media_url} className="w-full h-full object-cover" />
                ) : (
                  <img src={post.media_url || post.image_url || '/uploads/posts/default.png'} alt="" />
                )}
                
                {(post.media_type === 'video' || (post.media_url && post.media_url.match(/\.(mp4|webm|ogg|mov)$/i))) && <div className="ig-post-type-icon"><Clapperboard size={18} /></div>}
                <div className="ig-post-overlay">
                  <div className="ig-overlay-stats">
                    <span><i className="fas fa-heart"></i> {post.likes_count || post.sparks || 0}</span>
                    <span><i className="fas fa-comment"></i> {post.comments_count || post.comments || 0}</span>
                  </div>
                </div>
              </div>
            )) : (
              <div className="ig-empty-posts col-span-3">
                <div className="ig-empty-camera">
                  {activeTab === 'posts' ? <Grid size={48} /> : 
                   activeTab === 'reels' ? <Clapperboard size={48} /> : 
                   activeTab === 'saved' ? <Bookmark size={48} /> : 
                   <UserSquare size={48} />}
                </div>
                <h3>{activeTab === 'posts' ? 'Start Sparking' : 
                     activeTab === 'reels' ? 'Capture Moments' :
                     activeTab === 'saved' ? 'Save for Later' :
                     'No Photos of You'}</h3>
                <p>{activeTab === 'posts' ? 'Share your campus moments with friends and your community.' :
                    activeTab === 'reels' ? 'Share videos with your campus community.' :
                    activeTab === 'saved' ? 'Save posts you want to see again here.' :
                    'When people tag you in photos, they\'ll appear here.'}</p>
              </div>
            )}
          </div>
        </div>

        <footer className="ig-footer">
          <div className="ig-footer-links">
            <span>Sparkle</span><span>About</span><span>Support</span><span>Press</span><span>API</span><span>Privacy</span><span>Terms</span><span>Safety</span>
          </div>
          <div className="ig-footer-copy">
            © 2026 Sparkle by DonBabu Tech
          </div>
        </footer>
      </div>

      {/* User List Modal (Followers/Following) */}
      {listModal.open && (
        <div className="ig-modal-overlay" onClick={() => setListModal(prev => ({ ...prev, open: false }))}>
          <div className="ig-list-modal" onClick={e => e.stopPropagation()}>
            <div className="ig-modal-header">
              <h3>{listModal.type === 'followers' ? 'Followers' : 'Following'}</h3>
              <button onClick={() => setListModal(prev => ({ ...prev, open: false }))} className="ig-modal-close"><Plus size={32} style={{ transform: 'rotate(45deg)' }} /></button>
            </div>
            <div className="ig-modal-search">
              <input type="text" placeholder="Search" />
            </div>
            <div className="ig-modal-list scrollbar-hide">
              {listModal.data.length > 0 ? listModal.data.map((u, i) => (
                <div key={u.user_id} className="ig-user-row">
                  <div className="ig-user-info" onClick={() => { setListModal(prev => ({ ...prev, open: false })); navigate(`/profile/${u.username}`); }}>
                    <img src={u.avatar_url || '/uploads/avatars/default.png'} alt="" className="ig-user-avatar" />
                    <div className="ig-user-names">
                      <span className="ig-username-sm">{u.username}</span>
                      <span className="ig-fullname-sm">{u.name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                      {u.user_id !== currentUser?.id && u.user_id !== currentUser?.user_id && (
                        <button 
                          onClick={() => handleListFollowToggle(u.user_id, i)}
                          className={u.is_followed_by_me ? "ig-btn-secondary-sm" : "ig-btn-primary-sm"}
                        >
                          {u.is_followed_by_me ? 'Following' : 'Follow'}
                        </button>
                      )}
                      <button 
                        onClick={(e) => { e.stopPropagation(); setActionItem(u); }}
                        className="p-1.5 hover:bg-[#363636] rounded-full text-[#a8a8a8] hover:text-white transition-colors"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                  </div>
                </div>
              )) : (
                <div className="ig-empty-list">
                  <p>No {listModal.type} found.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {actionItem && (
        <UserActionModal user={actionItem} onClose={() => setActionItem(null)} />
      )}

      <style>{`
        .ig-profile-root {
          display: flex;
          background: #000;
          color: #fff;
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .ig-main-scroll {
          flex: 1;
          height: 100vh;
          overflow-y: auto;
          scrollbar-width: none;
        }
        .ig-main-scroll::-webkit-scrollbar { display: none; }
        
        .ig-profile-container {
          max-width: 935px;
          margin: 0 auto;
        }

        .ig-top-nav {
          position: sticky;
          top: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid #262626;
          z-index: 1000;
          height: 52px;
        }
        .ig-nav-left { display: flex; align-items: center; gap: 24px; }
        .ig-nav-title { font-weight: 700; font-size: 16px; color: #fff; }
        .ig-nav-right { display: flex; align-items: center; }
        .ig-nav-btn { background: none; border: none; color: #fff; cursor: pointer; padding: 8px; display: flex; align-items: center; }
        .ig-nav-btn:hover { opacity: 0.7; }

        .ig-profile-header {
          display: flex;
          margin-top: 30px;
          margin-bottom: 24px;
          gap: 40px;
          padding: 0 16px;
        }
        .ig-avatar-column {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: flex-start;
        }
        .ig-avatar-wrapper {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.2);
          overflow: hidden;
          background: #121212;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
        .ig-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ig-info-column {
          flex: 2;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .ig-username-section {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }
        .ig-username {
          font-size: 20px;
          font-weight: 600;
          color: #fff;
        }
        .ig-action-btns {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 16px;
        }
        .ig-verified-check {
          color: #0095f6;
          font-size: 18px;
        }
        .ig-btn-primary {
          background: #0095f6;
          color: #fff;
          border: none;
          padding: 6px 16px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
        }
        .ig-btn-primary-sm {
          background: #0095f6;
          color: #fff;
          border: none;
          padding: 6px 12px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
        }
        .ig-btn-secondary {
          background: #363636;
          color: #fff;
          border: none;
          padding: 6px 16px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
        }
        .ig-btn-secondary-sm {
          background: #363636;
          color: #fff;
          border: none;
          padding: 6px 12px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
        }
        .ig-btn-secondary:hover { background: #262626; }
        .ig-btn-subtle {
          background: transparent;
          color: #fff;
          border: 1px solid #363636;
          padding: 6px 16px;
          border-radius: 8px;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .ig-btn-subtle:hover { background: rgba(255,255,255,0.05); border-color: #a8a8a8; }
        .ig-cog-btn {
          background: none;
          border: none;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          padding: 4px;
          opacity: 0.7;
          transition: opacity 0.2s;
        }
        .ig-cog-btn:hover { opacity: 1; }

        .ig-stats-row {
          display: flex;
          gap: 40px;
          font-size: 16px;
        }
        .ig-stats-row span { cursor: pointer; }
        .ig-stats-row strong { font-weight: 600; }

        .ig-bio-section {
          font-size: 14px;
          line-height: 1.5;
        }
        .ig-full-name {
          font-weight: 600;
          margin-bottom: 2px;
        }
        .ig-category {
          color: #a8a8a8;
          margin-bottom: 2px;
        }
        .ig-bio-text { color: #fff; white-space: pre-line; }
        .ig-website-link {
          color: #e0f1ff;
          font-weight: 600;
          text-decoration: none;
          display: flex;
          align-items: center;
          margin-top: 4px;
        }
        .ig-website-link:hover { text-decoration: underline; }

        .ig-highlights-row {
          display: flex;
          gap: 45px;
          padding: 0 40px;
          margin-bottom: 52px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .ig-highlight-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          min-width: 80px;
        }
        .ig-highlight-circle {
          width: 77px;
          height: 77px;
          border-radius: 50%;
          border: 1px solid #262626;
          padding: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .ig-highlight-inner {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          overflow: hidden;
          background: #121212;
        }
        .ig-highlight-inner img { width: 100%; height: 100%; object-fit: cover; }
        .ig-new-highlight {
          border: 1px solid #363636;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ig-highlight-item span {
          font-size: 12px;
          font-weight: 600;
          color: #fff;
        }

        .ig-tabs-border {
          border-top: 1px solid #262626;
          display: flex;
          justify-content: center;
        }
        .ig-tabs-list {
          display: flex;
          gap: 60px;
        }
        .ig-tab-item {
          background: none;
          border: none;
          border-top: 1px solid transparent;
          color: #a8a8a8;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 1px;
          padding: 16px 0;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: -1px;
        }
        .ig-tab-item.active {
          color: #fff;
          border-top: 1px solid #fff;
        }

        .ig-posts-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4px;
          margin-bottom: 40px;
        }
        .ig-post-square {
          aspect-ratio: 1 / 1;
          background: #262626;
          position: relative;
          cursor: pointer;
          overflow: hidden;
        }
        .ig-post-square img, .ig-post-square video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .ig-post-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .ig-post-square:hover .ig-post-overlay { opacity: 1; }
        .ig-overlay-stats {
          display: flex;
          gap: 30px;
          font-weight: 700;
          font-size: 18px;
        }
        .ig-overlay-stats span { display: flex; align-items: center; gap: 8px; }
        .ig-post-type-icon {
          position: absolute;
          top: 10px;
          right: 10px;
          color: #fff;
          text-shadow: 0 0 4px rgba(0,0,0,0.5);
        }

        .ig-empty-posts {
          padding: 60px 0;
          text-align: center;
          color: #fff;
        }
        .ig-empty-camera {
          width: 62px;
          height: 62px;
          border: 2px solid #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }
        .ig-empty-posts h3 { font-size: 30px; font-weight: 800; margin-bottom: 8px; }
        .ig-empty-posts p { font-size: 14px; }

        /* Modal Styles */
        .ig-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.65);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ig-list-modal {
          background: #262626;
          width: 400px;
          max-height: 400px;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .ig-modal-header {
          display: flex;
          align-items: center;
          border-bottom: 1px solid #363636;
          padding: 8px 16px;
        }
        .ig-modal-header h3 { flex: 1; text-align: center; font-size: 16px; font-weight: 600; margin-left: 32px; }
        .ig-modal-close { background: none; border: none; color: #fff; cursor: pointer; padding: 0; }
        
        .ig-modal-search { padding: 12px 16px; }
        .ig-modal-search input {
          width: 100%;
          background: #363636;
          border: none;
          border-radius: 8px;
          padding: 8px 12px;
          color: #fff;
          font-size: 14px;
          outline: none;
        }
        
        .ig-modal-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px 16px 16px;
        }
        .ig-user-row {
          display: flex;
          align-items: center;
          padding: 8px 0;
          justify-content: space-between;
        }
        .ig-user-info {
          display: flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
        }
        .ig-user-avatar {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
          background: #121212;
        }
        .ig-user-names {
          display: flex;
          flex-direction: column;
        }
        .ig-username-sm { font-size: 14px; font-weight: 600; }
        .ig-fullname-sm { font-size: 14px; color: #a8a8a8; }
        .ig-empty-list { text-align: center; padding: 40px 0; color: #a8a8a8; }

        .ig-footer {
          padding: 40px 16px;
          max-width: 935px;
          margin: 0 auto;
          text-align: center;
        }
        .ig-footer-links {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 16px;
          font-size: 12px;
          color: #a8a8a8;
          margin-bottom: 20px;
        }
        .ig-footer-links span { cursor: pointer; }
        .ig-footer-links span:hover { text-decoration: underline; }
        .ig-footer-copy {
          font-size: 12px;
          color: #a8a8a8;
        }

        .profile-loading-screen {
          height: 100vh;
          background: #000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }

        /* Navbar Overrides for Dark Mode */
        .ig-profile-root .fb-sidebar {
          background: #000;
          border-right: 1px solid #262626;
        }
        .ig-profile-root .nav-items-card, .ig-profile-root .profile-switcher-container {
          background: #121212;
          border-color: #262626;
        }
        .ig-profile-root .nav-item, .ig-profile-root .profile-name {
          color: #fff;
        }
        .ig-profile-root .nav-item:hover {
          background: #262626;
        }
        .ig-profile-root .sidebar-item { color: #fff; }
        .ig-profile-root .sidebar-item:hover { background: rgba(255,255,255,0.05); }
        .ig-profile-root .sidebar-icon-box { color: #fff; }
        .ig-profile-root .sidebar-item.active .sidebar-icon-box { color: #fff; }
        .ig-profile-root .logo-text { -webkit-text-fill-color: #fff; }
        .ig-profile-root .hub-dropdown { background: #121212; border: 1px solid #262626; }
        .ig-profile-root .hub-sub-item { color: #a8a8a8; }
        .ig-profile-root .hub-sub-item:hover { background: #262626; color: #fff; }
        .ig-profile-root .hub-divider { background: #262626; }

        @media (max-width: 768px) {
          .ig-profile-header {
            flex-direction: column;
            gap: 20px;
            padding: 0 16px;
          }
          .ig-avatar-ring { width: 77px; height: 77px; }
          .ig-username-row { flex-direction: column; align-items: flex-start; gap: 12px; }
          .ig-stats-row { border-top: 1px solid #262626; padding: 12px 0; justify-content: space-around; width: 100%; border-bottom: 1px solid #262626; }
          .ig-posts-grid { gap: 1px; }
          .ig-highlights-row { padding: 0 16px; gap: 12px; }
          .ig-tabs-list { gap: 0; width: 100%; }
          .ig-tab-item { flex: 1; justify-content: center; font-size: 0; }
          .ig-tab-item svg { width: 24px; height: 24px; }
        }
      `}</style>
    </div>
  );
}
