import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Eye, Heart, Compass } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';

interface ExploreMedia {
  post_id: string;
  content?: string;
  username: string;
  avatar_url?: string;
  media_url?: string;
  media_type?: string;
  sparks?: number;
  comments?: number;
  created_at: string;
}

export default function Explore() {
  const navigate = useNavigate();
  const [mediaItems, setMediaItems] = useState<ExploreMedia[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchExploreMedia(); }, []);

  const fetchExploreMedia = async () => {
    setLoading(true);
    try {
      const res = await api.get('/posts/feed?limit=50&tab=trending');
      const data = Array.isArray(res.data) ? res.data : (res.data.posts || []);
      // Filter out posts without media
      const itemsWithMedia = data.filter((item: ExploreMedia) => item.media_url && item.media_url !== '/uploads/defaults/no-image.png');
      setMediaItems(itemsWithMedia);
    } catch (err) {
      console.error('Explore fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="mom-content">
        <main className="mom-container">
          {/* Header */}
          <div className="mom-header">
            <div className="mom-header-left">
              <Compass size={26} className="mom-header-icon" />
              <div>
                <h1>Explore</h1>
                <p>Discover amazing moments from across campus</p>
              </div>
            </div>
          </div>

          {/* Masonry Grid */}
          {loading ? (
            <div className="mom-grid">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="mom-skeleton pulse" style={{ height: `${200 + Math.random() * 200}px` }} />
              ))}
            </div>
          ) : mediaItems.length === 0 ? (
            <div className="mom-empty">
              <Compass size={52} />
              <h3>No content yet</h3>
              <p>Be the first to share something amazing with your campus!</p>
            </div>
          ) : (
            <div className="mom-grid">
              {mediaItems.map(m => (
                <div key={m.post_id} className="mom-card" onClick={() => navigate(`/post/${m.post_id}`)}>
                  <div className="mom-thumb">
                    <img
                      src={m.media_url || 'https://placehold.co/400x600?text=Explore'}
                      alt={m.content || m.username}
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/400x600?text=Explore'; }}
                      loading="lazy"
                    />
                    {m.media_type === 'video' && (
                      <div className="mom-play-btn"><Play size={20} fill="white" /></div>
                    )}
                    <div className="mom-overlay">
                      <div className="mom-user">
                        <span className="mom-username">@{m.username}</span>
                      </div>
                      <div className="mom-stats">
                        {m.sparks !== undefined && (
                          <span><Heart size={12} className={m.sparks > 0 ? "fill-white" : ""} /> {m.sparks}</span>
                        )}
                        {m.comments !== undefined && m.comments > 0 && (
                          <span><Eye size={12} /> {m.comments}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <style>{`
        .page-wrapper { display: flex; background: #0b0e14; min-height: 100vh; }
        .mom-content { flex: 1; overflow-y: auto; height: 100vh; }
        .mom-container { max-width: 1200px; margin: 0 auto; padding: 40px 20px 100px; }

        .mom-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; background: rgba(255,255,255,0.03); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 30px; margin-bottom: 40px; }
        .mom-header-left { display: flex; align-items: center; gap: 18px; }
        .mom-header-icon { color: var(--primary); }
        .mom-header h1 { font-size: 2rem; font-weight: 900; color: white; margin: 0 0 5px; letter-spacing: -1px; }
        .mom-header p { font-size: 0.95rem; color: rgba(255,255,255,0.5); margin: 0; }
        
        .mom-grid { column-count: 3; column-gap: 20px; }
        @media (max-width: 900px) { .mom-grid { column-count: 2; column-gap: 16px; } }
        @media (max-width: 600px) { .mom-grid { column-count: 2; column-gap: 8px; } }

        .mom-card { cursor: pointer; position: relative; overflow: hidden; border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); break-inside: avoid; margin-bottom: 20px; background: #1a1b1e; }
        @media (max-width: 600px) { .mom-card { margin-bottom: 8px; border-radius: 12px; } }

        .mom-thumb { position: relative; width: 100%; display: block; }
        .mom-thumb img { width: 100%; height: auto; display: block; transition: 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
        .mom-card:hover .mom-thumb img { transform: scale(1.05); }
        
        .mom-play-btn { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 50px; height: 50px; background: rgba(0,0,0,0.5); backdrop-filter: blur(5px); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 1px solid rgba(255,255,255,0.2); }
        .mom-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 40px 16px 16px; background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%); opacity: 0; transition: opacity 0.3s ease; }
        .mom-card:hover .mom-overlay { opacity: 1; }
        
        /* Always show overlay softly on mobile */
        @media (max-width: 768px) {
          .mom-overlay { opacity: 1; padding: 30px 12px 12px; background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%); }
        }

        .mom-user { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .mom-username { color: white; font-size: 0.85rem; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
        .mom-stats { display: flex; gap: 12px; font-size: 0.75rem; color: rgba(255,255,255,0.9); font-weight: 700; }
        .mom-stats span { display: flex; align-items: center; gap: 4px; text-shadow: 0 1px 3px rgba(0,0,0,0.5); }

        .mom-skeleton { background: rgba(255,255,255,0.05); border-radius: 20px; break-inside: avoid; margin-bottom: 20px; }
        .pulse { animation: momPulse 1.5s ease-in-out infinite; }
        @keyframes momPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

        .mom-empty { text-align: center; padding: 100px 40px; color: rgba(255,255,255,0.3); column-span: all; }
        .mom-empty svg { margin-bottom: 24px; opacity: 0.2; }
        .mom-empty h3 { font-size: 1.8rem; font-weight: 900; color: white; margin: 0 0 10px; }
        .mom-empty p { margin: 0 0 30px; font-size: 1.1rem; }

        /* Sidebar Dark Mode Overrides */
        .fb-sidebar {
          background: #0b0e14;
          border-right: 1px solid rgba(255,255,255,0.05);
        }
        .nav-items-card, .profile-switcher-container {
          background: #1a1b1e;
          border-color: rgba(255,255,255,0.05);
        }
        .nav-item, .profile-name, .nav-group-title {
          color: rgba(255,255,255,0.8);
        }
        .nav-item:hover {
          background: rgba(255,255,255,0.05);
        }
        .profile-username {
          color: rgba(255,255,255,0.4);
        }
      `}</style>
    </div>
  );
}
