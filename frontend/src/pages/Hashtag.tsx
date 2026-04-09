import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Hash, ArrowLeft } from 'lucide-react';
import Navbar from '../components/Navbar';
import PostCard from '../components/PostCard';
import api from '../api/api';

export default function Hashtag() {
  const { tag } = useParams();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tag) fetchPosts();
  }, [tag]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/search?type=posts&q=${encodeURIComponent(tag || '')}`);
      setPosts(res.data.posts || res.data || []);
    } catch (err) {
      console.error('Hashtag fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="htag-content">
        <main className="htag-container">
          <button className="htag-back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Back
          </button>

          <div className="htag-header">
            <div className="htag-icon-wrap">
              <Hash size={30} />
            </div>
            <div>
              <h1 className="htag-title">#{tag}</h1>
              <p className="htag-count">{posts.length} posts</p>
            </div>
          </div>

          {loading ? (
            <div className="htag-list">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="htag-skeleton">
                  <div className="htsk-avatar pulse" />
                  <div className="htsk-content">
                    <div className="htsk-line pulse" style={{ width: '40%', marginBottom: 8 }} />
                    <div className="htsk-line pulse" style={{ width: '90%', marginBottom: 6 }} />
                    <div className="htsk-line pulse" style={{ width: '70%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="htag-empty">
              <Hash size={44} className="htag-empty-icon" />
              <h3>No posts yet</h3>
              <p>Be the first to post with <strong>#{tag}</strong>!</p>
            </div>
          ) : (
            <div className="htag-list">
              {posts.map(post => <PostCard key={post.post_id} post={post} />)}
            </div>
          )}
        </main>
      </div>

      <style>{`
        .page-wrapper { display: flex; background: var(--bg-main, #f8fafc); min-height: 100vh; }
        .htag-content { flex: 1; }
        .htag-container { max-width: 640px; margin: 0 auto; padding: 30px 20px 80px; }
        .htag-back-btn { display: inline-flex; align-items: center; gap: 7px; background: white; border: 1px solid #e2e8f0; padding: 9px 16px; border-radius: 12px; font-weight: 700; font-size: 14px; color: #334155; cursor: pointer; margin-bottom: 24px; transition: 0.2s; }
        .htag-back-btn:hover { border-color: #FF3D6D; color: #FF3D6D; }
        .htag-header { display: flex; align-items: center; gap: 20px; background: white; border-radius: 24px; padding: 30px; margin-bottom: 24px; border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 4px 20px rgba(0,0,0,0.04); }
        .htag-icon-wrap { width: 64px; height: 64px; background: linear-gradient(135deg, #FF6B8B, #FF3D6D); border-radius: 20px; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; box-shadow: 0 8px 20px rgba(255,61,109,0.25); }
        .htag-title { font-size: 2rem; font-weight: 900; color: #0f172a; margin: 0 0 4px; letter-spacing: -1px; }
        .htag-count { font-size: 14px; color: #64748b; margin: 0; font-weight: 600; }
        .htag-list { display: flex; flex-direction: column; gap: 16px; }
        .htag-skeleton { display: flex; gap: 14px; background: white; padding: 20px; border-radius: 20px; border: 1px solid rgba(0,0,0,0.05); }
        .htsk-avatar { width: 44px; height: 44px; border-radius: 50%; background: #f1f5f9; flex-shrink: 0; }
        .htsk-content { flex: 1; }
        .htsk-line { height: 12px; border-radius: 6px; background: #f1f5f9; }
        .pulse { animation: htagPulse 1.5s ease-in-out infinite; }
        @keyframes htagPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .htag-empty { text-align: center; padding: 80px 40px; background: white; border-radius: 24px; border: 1px solid rgba(0,0,0,0.05); }
        .htag-empty-icon { color: #cbd5e1; margin-bottom: 16px; }
        .htag-empty h3 { font-size: 1.3rem; font-weight: 800; color: #1e293b; margin: 0 0 8px; }
        .htag-empty p { color: #64748b; }
      `}</style>
    </div>
  );
}
