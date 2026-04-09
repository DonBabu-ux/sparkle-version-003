import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Play, Eye, Heart, Camera } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';

interface Moment {
  moment_id: string;
  title?: string;
  username: string;
  avatar_url?: string;
  thumbnail_url?: string;
  video_url?: string;
  view_count?: number;
  like_count?: number;
  created_at: string;
  is_video?: boolean;
}

export default function Moments() {
  const navigate = useNavigate();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchMoments(); }, []);

  const fetchMoments = async () => {
    setLoading(true);
    try {
      const res = await api.get('/moments/stream');
      setMoments(res.data.moments || res.data || []);
    } catch (err) {
      console.error('Moments fetch error:', err);
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
              <Camera size={26} className="mom-header-icon" />
              <div>
                <h1>Moments</h1>
                <p>Fleeting glimpses of campus life</p>
              </div>
            </div>
            <button className="mom-create-btn" onClick={() => navigate('/moments/create')}>
              <Plus size={18} /> Share Moment
            </button>
          </div>

          {/* Grid */}
          {loading ? (
            <div className="mom-grid">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="mom-skeleton pulse" />
              ))}
            </div>
          ) : moments.length === 0 ? (
            <div className="mom-empty">
              <Camera size={52} />
              <h3>No moments yet</h3>
              <p>Be the first to share a moment with your campus!</p>
              <button className="mom-create-btn" onClick={() => navigate('/moments/create')}>Create Moment</button>
            </div>
          ) : (
            <div className="mom-grid">
              {moments.map(m => (
                <div key={m.moment_id} className="mom-card" onClick={() => navigate(`/moments/${m.moment_id}`)}>
                  <div className="mom-thumb">
                    <img
                      src={m.thumbnail_url || m.video_url || 'https://placehold.co/400x600?text=Moment'}
                      alt={m.title || m.username}
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/400x600?text=Moment'; }}
                    />
                    {m.is_video && (
                      <div className="mom-play-btn"><Play size={20} fill="white" /></div>
                    )}
                    <div className="mom-overlay">
                      <div className="mom-user">
                        <img
                          src={m.avatar_url || '/uploads/avatars/default.png'}
                          className="mom-avatar"
                          alt={m.username}
                          onError={(e) => { (e.target as HTMLImageElement).src = '/uploads/avatars/default.png'; }}
                        />
                        <span className="mom-username">@{m.username}</span>
                      </div>
                      <div className="mom-stats">
                        {m.view_count !== undefined && (
                          <span><Eye size={12} /> {m.view_count}</span>
                        )}
                        {m.like_count !== undefined && (
                          <span><Heart size={12} /> {m.like_count}</span>
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
        
        .mom-create-btn { display: inline-flex; align-items: center; gap: 10px; background: var(--primary-gradient); color: white; border: none; padding: 14px 24px; border-radius: 16px; font-weight: 800; font-size: 0.95rem; cursor: pointer; transition: 0.3s; white-space: nowrap; }
        .mom-create-btn:hover { transform: translateY(-3px); box-shadow: 0 10px 20px rgba(255, 61, 109, 0.3); }

        .mom-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }
        @media (max-width: 600px) { .mom-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; } }

        .mom-card { cursor: pointer; aspect-ratio: 9/16; position: relative; overflow: hidden; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); }
        .mom-thumb { width: 100%; height: 100%; position: relative; background: #1a1b1e; }
        .mom-thumb img { width: 100%; height: 100%; object-fit: cover; transition: 0.8s cubic-bezier(0.4, 0, 0.2, 1); display: block; }
        .mom-card:hover .mom-thumb img { transform: scale(1.15); }
        
        .mom-play-btn { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 60px; height: 60px; background: rgba(255,255,255,0.2); backdrop-filter: blur(10px); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; border: 1px solid rgba(255,255,255,0.3); }
        .mom-overlay { position: absolute; bottom: 0; left: 0; right: 0; padding: 30px 20px 20px; background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%); opacity: 0.9; transition: 0.3s; }
        .mom-user { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .mom-avatar { width: 32px; height: 32px; border-radius: 10px; object-fit: cover; border: 1.5px solid white; }
        .mom-username { color: white; font-size: 0.9rem; font-weight: 800; }
        .mom-stats { display: flex; gap: 15px; font-size: 0.75rem; color: rgba(255,255,255,0.7); font-weight: 700; }
        .mom-stats span { display: flex; align-items: center; gap: 6px; }

        .mom-skeleton { aspect-ratio: 9/16; background: rgba(255,255,255,0.05); border-radius: 20px; }
        .pulse { animation: momPulse 1.5s ease-in-out infinite; }
        @keyframes momPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

        .mom-empty { text-align: center; padding: 100px 40px; color: rgba(255,255,255,0.3); }
        .mom-empty svg { margin-bottom: 24px; opacity: 0.2; }
        .mom-empty h3 { font-size: 1.8rem; font-weight: 900; color: white; margin: 0 0 10px; }
        .mom-empty p { margin: 0 0 30px; font-size: 1.1rem; }
      `}</style>
    </div>
  );
}
