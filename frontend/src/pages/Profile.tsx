import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import PostCard from '../components/PostCard';
import Navbar from '../components/Navbar';

export default function Profile() {
  const { username } = useParams();
  const { user: currentUser } = useUserStore();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRequested, setIsRequested] = useState(false);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const targetUsername = username === 'me' ? (currentUser?.username || '') : username;
      const profileRes = await api.get(`/users/${targetUsername}`);
      if (profileRes.data) {
        const profileData = profileRes.data;
        setProfile(profileData);
        setIsFollowing(profileData.is_followed_by_me);
        setIsRequested(profileData.is_requested_by_me);

        const postsRes = await api.get(`/users/${profileData.id || profileData.user_id}/posts`);
        if (postsRes.data && Array.isArray(postsRes.data)) {
          setPosts(postsRes.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    } finally {
      setLoading(false);
    }
  }, [username, currentUser]);

  useEffect(() => {
    if (currentUser) fetchProfile();
  }, [fetchProfile, currentUser]);

  const handleFollowToggle = async () => {
    if (isRequested) return;

    const originalFollowing = isFollowing;
    const oldFollowersCount = profile.followers_count;
    
    // Optimistic Update
    setIsFollowing(!originalFollowing);
    setProfile((prev: any) => ({
      ...prev,
      followers_count: originalFollowing ? prev.followers_count - 1 : prev.followers_count + 1
    }));

    try {
      if (originalFollowing) {
        // Unfollow
        await api.delete(`/users/${profile.user_id}/follow`);
      } else {
        // Follow
        const res = await api.post(`/users/${profile.user_id}/follow`);
        if (res.data.status === 'requested') {
          setIsRequested(true);
          setIsFollowing(false);
          setProfile((prev: any) => ({ ...prev, followers_count: oldFollowersCount }));
          return;
        }
      }
    } catch (err) {
      // Revert on failure
      setIsFollowing(originalFollowing);
      setProfile((prev: any) => ({ ...prev, followers_count: oldFollowersCount }));
      console.error('Follow action failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="profile-loading">
        <div className="spinner"></div>
        <p>Fetching Sparkler Data...</p>
      </div>
    );
  }

  const isOwnProfile = profile?.user_id === currentUser?.id || profile?.user_id === currentUser?.user_id;

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="profile-main-content">
        <main className="profile-container">
          <div className="profile-header-card">
            <div className="profile-header-top">
              <div className="avatar-section">
                <div className="profile-avatar-container">
                  <img src={profile?.avatar_url || '/uploads/avatars/default.png'} alt={profile?.name} />
                </div>
              </div>

              <div className="profile-stats">
                <div className="stat-item">
                  <div className="stat-value">{posts.length}</div>
                  <div className="stat-label">Posts</div>
                </div>
                <div className="stat-item clickable">
                  <div className="stat-value">{profile?.followers_count || 0}</div>
                  <div className="stat-label">Followers</div>
                </div>
                <div className="stat-item clickable">
                  <div className="stat-value">{profile?.following_count || 0}</div>
                  <div className="stat-label">Following</div>
                </div>
              </div>
            </div>

            <div className="profile-identity">
              <div className="username-row">
                <span className="profile-username">@{profile?.username}</span>
                {profile?.is_verified && <i className="fas fa-check-circle verified-icon"></i>}
              </div>
              <h1 className="profile-headline">{profile?.headline || profile?.name || profile?.username}</h1>
              {profile?.bio && (
                <div className="profile-bio">
                  {profile.bio}
                </div>
              )}
              {profile?.website && (
                <a href={`https://${profile.website.replace(/^https?:\/\//, '')}`} target="_blank" rel="noopener noreferrer" className="profile-website">
                  <i className="fas fa-link"></i> {profile.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>

            <div className="profile-actions-row">
              {isOwnProfile ? (
                <>
                  <button onClick={() => navigate('/settings')} className="action-btn-primary">Edit Profile</button>
                  <button onClick={() => navigate('/settings')} className="action-btn-icon"><i className="fas fa-cog"></i></button>
                </>
              ) : (
                <>
                  {isFollowing ? (
                    <button onClick={handleFollowToggle} className="action-btn-secondary">Following</button>
                  ) : isRequested ? (
                    <button className="action-btn-disabled" disabled>Requested</button>
                  ) : (
                    <button onClick={handleFollowToggle} className="action-btn-primary">Follow</button>
                  )}
                  <button onClick={() => navigate(`/messages?chat=${profile.user_id}`)} className="action-btn-secondary">Message</button>
                  <button className="action-btn-icon"><i className="fas fa-ellipsis-h"></i></button>
                </>
              )}
            </div>

            <div className="profile-details-list">
              {(profile?.campus || profile?.major) && (
                <div className="detail-item">
                  <i className="fas fa-graduation-cap"></i>
                  <span>{profile?.major ? `${profile.major} • ` : ''}{profile?.campus || 'Sparkle Campus'}</span>
                </div>
              )}
              {profile?.email && (
                <div className="detail-item">
                  <i className="fas fa-envelope"></i>
                  <span>{profile.email}</span>
                </div>
              )}
            </div>
          </div>

          <div className="profile-content-section">
            <div className="profile-tabs">
              <div className={`tab ${activeTab === 'posts' ? 'active' : ''}`} onClick={() => setActiveTab('posts')}>
                <i className="fas fa-th"></i> POSTS
              </div>
              {isOwnProfile && (
                <>
                  <div className={`tab ${activeTab === 'liked' ? 'active' : ''}`} onClick={() => setActiveTab('liked')}>
                    <i className="fas fa-heart"></i> LIKED
                  </div>
                  <div className={`tab ${activeTab === 'saved' ? 'active' : ''}`} onClick={() => setActiveTab('saved')}>
                    <i className="fas fa-bookmark"></i> SAVED
                  </div>
                </>
              )}
            </div>

            <div className="posts-grid-container">
              {posts.length > 0 ? (
                <div className="posts-list">
                  {posts.map(post => <PostCard key={post.post_id} post={post} />)}
                </div>
              ) : (
                <div className="empty-state">
                  <i className="fas fa-camera"></i>
                  <h3>No Posts Yet</h3>
                  <p>When {isOwnProfile ? 'you' : profile?.username} share sparkles, they'll appear here.</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <style>{`
        .page-wrapper { display: flex; background: var(--bg-main); min-height: 100vh; }
        .profile-main-content { flex: 1; padding: 40px 20px; }
        .profile-container { max-width: 630px; margin: 0 auto; }
        
        .profile-header-card { background: white; border-radius: 20px; padding: 25px; box-shadow: var(--shadow-sm); border: 1px solid var(--border-light); margin-bottom: 25px; }
        .profile-header-top { display: flex; align-items: center; justify-content: space-between; gap: 30px; margin-bottom: 20px; }
        
        .profile-avatar-container { width: 90px; height: 90px; border-radius: 50%; overflow: hidden; border: 3px solid var(--primary); background: #eee; }
        .profile-avatar-container img { width: 100%; height: 100%; object-fit: cover; }
        
        .profile-stats { flex: 1; display: flex; justify-content: space-around; }
        .stat-item { text-align: center; }
        .stat-value { font-size: 1.25rem; font-weight: 800; color: var(--text-main); }
        .stat-label { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; }
        .stat-item.clickable { cursor: pointer; transition: opacity 0.2s; }
        .stat-item.clickable:hover { opacity: 0.7; }
        
        .profile-identity { margin-bottom: 20px; }
        .username-row { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
        .profile-username { font-size: 0.9rem; font-weight: 600; color: var(--text-muted); }
        .verified-icon { color: var(--primary); font-size: 0.9rem; }
        .profile-headline { font-size: 1.5rem; font-weight: 800; color: var(--text-main); margin-bottom: 8px; }
        .profile-bio { font-size: 0.95rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 10px; }
        .profile-website { font-size: 0.9rem; color: var(--primary); text-decoration: none; font-weight: 600; display: flex; align-items: center; gap: 6px; }
        
        .profile-actions-row { display: flex; gap: 10px; margin-bottom: 20px; }
        .action-btn-primary { flex: 1; background: var(--primary); color: white; border: none; padding: 10px; border-radius: 10px; font-weight: 700; cursor: pointer; }
        .action-btn-secondary { flex: 1; background: #f1f5f9; color: var(--text-main); border: none; padding: 10px; border-radius: 10px; font-weight: 700; cursor: pointer; }
        .action-btn-disabled { flex: 1; background: #e2e8f0; color: #94a3b8; border: none; padding: 10px; border-radius: 10px; font-weight: 700; cursor: not-allowed; }
        .action-btn-icon { background: #f1f5f9; color: var(--text-main); border: none; padding: 10px 15px; border-radius: 10px; cursor: pointer; }
        
        .profile-details-list { display: flex; flex-direction: column; gap: 10px; border-top: 1px solid #f8fafc; pt: 15px; }
        .detail-item { display: flex; align-items: center; gap: 10px; font-size: 0.9rem; color: var(--text-secondary); font-weight: 500; }
        .detail-item i { color: var(--text-muted); width: 16px; text-align: center; }
        
        .profile-tabs { display: flex; justify-content: space-around; border-bottom: 1px solid var(--border-light); margin-bottom: 20px; }
        .tab { padding: 15px 0; font-size: 0.75rem; font-weight: 800; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 8px; letter-spacing: 1px; }
        .tab.active { color: var(--text-main); border-bottom: 2px solid var(--text-main); }
        
        .posts-list { display: flex; flex-direction: column; gap: 20px; }
        
        .empty-state { text-align: center; padding: 60px 20px; color: var(--text-muted); }
        .empty-state i { font-size: 3rem; margin-bottom: 15px; opacity: 0.3; }
        .empty-state h3 { font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-bottom: 5px; }
        
        .profile-loading { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--bg-main); }
        .spinner { width: 40px; height: 40px; border: 4px solid var(--primary); border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 15px; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .profile-main-content { padding: 0; }
          .profile-header-card { border-radius: 0; border: none; border-bottom: 1px solid #f1f5f9; }
          .profile-container { width: 100%; }
        }
      `}</style>
    </div>
  );
}
