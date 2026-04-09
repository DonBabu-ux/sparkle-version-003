import { useState, useEffect, useCallback } from 'react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import PostCard from '../components/PostCard';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useModalStore } from '../store/modalStore';

export default function Dashboard() {
  const { user } = useUserStore();
  const navigate = useNavigate();

  const [newPostContent, setNewPostContent] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [trendingTags, setTrendingTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchDashboardData = useCallback(async (pageNum = 1) => {
    if (pageNum === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const [dashRes, storiesRes, suggestionsRes] = await Promise.all([
        api.get(`/posts/feed?page=${pageNum}&limit=10`),
        pageNum === 1 ? api.get('/stories/active').catch(() => ({ data: { stories: [] } })) : Promise.resolve({ data: { stories: [] } }),
        pageNum === 1 ? api.get('/users/suggestions').catch(() => ({ data: { suggestions: [] } })) : Promise.resolve({ data: { suggestions: [] } })
      ]);
      
      const newPosts = Array.isArray(dashRes.data) ? dashRes.data : (dashRes.data.feed || dashRes.data.posts || []);
      
      if (pageNum === 1) {
        setPosts(newPosts);
        if (storiesRes.data.stories) setStories(storiesRes.data.stories);
        if (suggestionsRes.data.suggestions) setSuggestions(suggestionsRes.data.suggestions);
        setTrendingTags([
          { tag: 'CampusGossip', count: '2.4k' },
          { tag: 'MarketplaceSteals', count: '1.8k' },
          { tag: 'FinalsWeekCry', count: '5.1k' },
          { tag: 'Sparklev3', count: '942' }
        ]);
      } else {
        setPosts(prev => [...prev, ...newPosts]);
      }
      
      setHasMore(newPosts.length === 10);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const { refreshCounter } = useModalStore();

  useEffect(() => {
    fetchDashboardData(1);
  }, [fetchDashboardData, refreshCounter]);

  const handlePublish = async () => {
    if (!newPostContent.trim() && mediaFiles.length === 0) return;
    setIsPublishing(true);
    
    const formData = new FormData();
    formData.append('content', newPostContent.trim() || ' ');
    mediaFiles.forEach(file => formData.append('media', file));

    try {
      const response = await api.post('/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // The API returns 201, or { success: true } depending on which controller
      if (response.status === 201 || response.data.success || response.data) {
        setNewPostContent('');
        setMediaFiles([]);
        fetchDashboardData(1);
      }
    } catch (err) {
      console.error('Failed to publish spark:', err);
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="dashboard-root">
      <Navbar />

      <div className="dashboard-layout">
        {/* Center Column: Feed */}
        <main className="main-feed-column">
          {/* 🔷 PREMIUM COMPOSER */}
          <div className="composer-card animate-scale-in">
            <div className="composer-input-area">
              <img 
                src={user?.avatar_url || '/uploads/avatars/default.png'} 
                className="composer-avatar" 
                alt=""
              />
              <div className="composer-prompt-wrapper">
                <input 
                  type="text"
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder={`What's on your mind, ${user?.name?.split(' ')[0] || 'Sparkler'}?`}
                  className="composer-input-field"
                />
              </div>
            </div>
            <div className="composer-actions">
              <label className="composer-btn">
                <i className="fas fa-image" style={{ color: '#45bd62' }}></i> Photo
                <input type="file" multiple className="hidden-input" accept="image/*" onChange={(e) => setMediaFiles(prev => [...prev, ...Array.from(e.target.files || [])])} />
              </label>
              <div className="composer-btn" onClick={() => navigate('/moments/create')}><i className="fas fa-play-circle" style={{ color: '#f02849' }}></i> Moment</div>
              <div className="composer-btn" onClick={() => setActiveModal('listing')}><i className="fas fa-store" style={{ color: '#f7b928' }}></i> Sell</div>
              <div className="composer-btn hidden md:flex"><i className="fas fa-smile" style={{ color: '#f7b928' }}></i> Feeling</div>
            </div>
            {(newPostContent.trim() || mediaFiles.length > 0) && (
              <button 
                onClick={handlePublish}
                disabled={isPublishing}
                className="premium-btn publish-btn"
                style={{ width: '100%', marginTop: '16px', justifyContent: 'center' }}
              >
                {isPublishing ? 'Publishing...' : 'Publish Spark'}
              </button>
            )}
          </div>

          {/* 🔷 STORIES ROW (AFTERGLOW) */}
          <div className="stories-section animate-fade-in">
            <div className="stories-container">
              <div className="story-card story-add" onClick={() => navigate('/afterglow/create')}>
                <div className="story-add-bg">
                  <img src={user?.avatar_url || '/uploads/avatars/default.png'} className="story-media" style={{ filter: 'blur(5px) brightness(0.7)' }} />
                </div>
                <div className="plus-circle"><i className="fas fa-plus"></i></div>
                <div className="story-add-text">Afterglow</div>
              </div>

              {stories.map(group => (
                <div key={group.user_id} className="story-card animate-scale-in" onClick={() => navigate(`/stories/${group.user_id}`)}>
                  <img src={group.avatar_url || '/uploads/avatars/default.png'} className="story-media" alt="" />
                  <div className="story-overlay"></div>
                  <div className="story-avatar-wrapper">
                    <img src={group.avatar_url || '/uploads/avatars/default.png'} className="story-avatar" alt="" />
                  </div>
                  <div className="story-name">{group.username || group.user_name}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="feed-container">
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="post-skeleton animate-pulse mb-8 p-6 bg-white rounded-3xl border border-slate-100">
                  <div className="flex gap-4 mb-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-full"></div>
                    <div className="flex-1 space-y-2 py-2">
                       <div className="h-4 bg-slate-100 rounded w-1/4"></div>
                       <div className="h-3 bg-slate-100 rounded w-1/6"></div>
                    </div>
                  </div>
                  <div className="h-48 bg-slate-100 rounded-2xl mb-4"></div>
                  <div className="space-y-2">
                     <div className="h-3 bg-slate-100 rounded w-full"></div>
                     <div className="h-3 bg-slate-100 rounded w-5/6"></div>
                  </div>
                </div>
              ))
            ) : posts.length > 0 ? (
              <>
                {posts.map((post) => (
                  <div key={post.post_id} className="animate-fade-in">
                    <PostCard post={post} />
                  </div>
                ))}
                
                {loadingMore && (
                  <div className="load-more-spinner">
                    <i className="fas fa-circle-notch fa-spin"></i>
                  </div>
                )}

                {hasMore && (
                  <button className="premium-btn load-more-btn" onClick={() => { setPage(p => p + 1); fetchDashboardData(page + 1); }}>
                    <i className="fas fa-sync-alt"></i> Load More
                  </button>
                )}
              </>
            ) : (
              <div className="empty-feed-state">
                <i className="fas fa-ghost"></i>
                <p>No posts yet. Be the first to share something!</p>
              </div>
            )}
          </div>
        </main>

        {/* Right Column: Suggestions & Trending */}
        <aside className="suggestions-column animate-slide-in">
          <div className="sidebar-card">
            <div className="sidebar-title">
              <span>Suggested for you</span>
              <Link to="/connect" style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>See All</Link>
            </div>

            <div className="suggestions-list">
              {suggestions.length > 0 ? suggestions.map(s => (
                <div key={s.user_id} className="suggestion-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1 }} onClick={() => navigate(`/profile/${s.user_id}`)}>
                    <img src={s.avatar_url || '/uploads/avatars/default.png'} className="suggestion-avatar" alt="" />
                    <div style={{ overflow: 'hidden' }}>
                      <div className="suggestion-name">{s.username}</div>
                      <div className="suggestion-meta">{s.campus || 'Sparkler'}</div>
                    </div>
                  </div>
                  <button className="follow-btn">Follow</button>
                </div>
              )) : (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No suggestions right now</p>
              )}
            </div>
          </div>

          <div className="sidebar-card trending-card animate-scale-in">
            <div className="sidebar-title" style={{ color: 'white', marginBottom: '25px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="pulse-dot"></div>
                Trending Pulse
              </span>
            </div>
            <div className="trending-tags" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              {trendingTags.map(tag => (
                <Link key={tag.tag} to={`/search?q=${tag.tag}`} className="trending-pill">
                  #{tag.tag} <span style={{ fontSize: '0.7rem', opacity: 0.8, marginLeft: '4px' }}>{tag.count}</span>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        .dashboard-root {
          display: flex;
          background-color: var(--bg-main);
          min-height: 100vh;
        }
        .dashboard-layout {
          display: grid;
          grid-template-columns: 630px 320px;
          justify-content: center;
          gap: 40px;
          max-width: 1400px;
          margin: 0 auto;
          padding: 40px 20px;
          align-items: flex-start;
          flex: 1;
        }
        .main-feed-column {
          width: 630px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .suggestions-column {
          width: 320px;
          position: sticky;
          top: 40px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .composer-card {
          background: white;
          border-radius: 18px;
          padding: 20px;
          margin-bottom: 24px;
          box-shadow: var(--shadow-sm);
          border: 1px solid var(--border-light);
        }
        .composer-input-area {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }
        .composer-avatar {
          width: 48px; height: 48px; border-radius: 50%; object-fit: cover;
        }
        .composer-prompt-wrapper {
          flex: 1;
        }
        .composer-input-field {
          width: 100%;
          background: var(--bg-main);
          padding: 14px 20px;
          border-radius: 30px;
          border: none;
          outline: none;
          font-family: inherit;
          font-size: 0.95rem;
          font-weight: 500;
        }
        .composer-actions {
          display: flex;
          justify-content: space-around;
          padding-top: 16px;
          border-top: 1px solid #f1f5f9;
        }
        .composer-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--text-secondary);
          transition: all 0.2s;
          cursor: pointer;
        }
        .composer-btn:hover {
          background: #f8fafc;
          color: var(--primary);
        }
        .hidden-input { display: none; }
        
        .stories-section { margin-bottom: 32px; }
        .stories-container {
          display: flex; gap: 16px; overflow-x: auto; padding-bottom: 16px;
        }
        .stories-container::-webkit-scrollbar { display: none; }
        .story-card {
          position: relative; width: 120px; height: 200px; border-radius: 18px;
          overflow: hidden; flex-shrink: 0; cursor: pointer; transition: all 0.3s;
          box-shadow: var(--shadow-md);
        }
        .story-card:hover { transform: translateY(-5px); box-shadow: var(--shadow-lg); }
        .story-media { width: 100%; height: 100%; object-fit: cover; }
        .story-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%);
        }
        .story-avatar-wrapper {
          position: absolute; top: 12px; left: 12px; padding: 2px;
          background: var(--primary-gradient); border-radius: 50%;
          width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;
        }
        .story-avatar { width: 100%; height: 100%; border-radius: 50%; border: 2px solid white; object-fit: cover; }
        .story-name {
          position: absolute; bottom: 12px; left: 12px; right: 12px;
          color: white; font-size: 0.8rem; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .story-add { background: white; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; border: 1px solid var(--border-light); }
        .story-add-bg { position: absolute; top: 0; left: 0; width: 100%; height: 75%; background: #f1f5f9; }
        .plus-circle {
          width: 32px; height: 32px; background: var(--primary-gradient); border-radius: 50%;
          border: 3px solid white; display: flex; align-items: center; justify-content: center;
          color: white; font-size: 14px; position: relative; margin-top: -16px; z-index: 2;
        }
        .story-add-text { padding: 12px 6px; font-size: 0.8rem; font-weight: 800; }

        .sidebar-card { background: white; border-radius: 20px; padding: 24px; border: 1px solid var(--border-light); box-shadow: var(--shadow-sm); }
        .sidebar-title { font-size: 1.1rem; font-weight: 800; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
        .suggestion-item { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
        .suggestion-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; }
        .suggestion-name { font-weight: 700; font-size: 0.9rem; }
        .suggestion-meta { font-size: 0.75rem; color: var(--text-muted); }
        .follow-btn { color: var(--primary); font-weight: 700; font-size: 0.85rem; background: none; cursor: pointer; }
        
        .trending-card { background: var(--primary-gradient); color: white; border: none; }
        .pulse-dot { width: 10px; height: 10px; background: white; border-radius: 50%; position: relative; }
        .pulse-dot::after {
          content: ''; position: absolute; inset: 0; background: white; border-radius: 50%;
          animation: pulse-ring 1.5s infinite;
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.5; }
          100% { transform: scale(3); opacity: 0; }
        }
        .trending-pill {
          background: rgba(255,255,255,0.2); color: white; padding: 6px 14px;
          border-radius: 20px; border: 1px solid rgba(255,255,255,0.3); font-size: 0.85rem; font-weight: 600;
          text-decoration: none; transition: all 0.2s;
        }
        .trending-pill:hover { background: rgba(255,255,255,0.3); }

        .load-more-spinner { text-align: center; padding: 20px; color: var(--primary); font-size: 1.5rem; }
        .load-more-btn { width: 100%; margin-top: 20px; justify-content: center; }

        @media (max-width: 1024px) {
          .dashboard-layout { grid-template-columns: 1fr; padding: 100px 15px 120px; }
          .suggestions-column { display: none; }
          .main-feed-column { width: 100%; gap: 15px; }
          .composer-card { border-radius: 24px; padding: 15px; }
          .composer-input-field { font-size: 0.9rem; padding: 12px 18px; }
          .composer-btn { padding: 8px 12px; font-size: 0.8rem; }
        }
      `}</style>
    </div>
  );
}
