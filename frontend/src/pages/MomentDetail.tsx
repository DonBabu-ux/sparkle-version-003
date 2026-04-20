import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, MessageSquare, Eye, Share2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';

interface MomentData {
  moment_id: string;
  username: string;
  avatar_url?: string;
  caption?: string;
  media_url?: string;
  thumbnail_url?: string;
  is_video?: boolean;
  like_count?: number;
  view_count?: number;
  comment_count?: number;
  created_at: string;
  is_liked?: boolean;
}

export default function MomentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [moment, setMoment] = useState<MomentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [liking, setLiking] = useState(false);

  const fetchMoment = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/moments/${id}`);
      setMoment(res.data.moment || res.data);
    } catch (err) {
      console.error('Moment detail error:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { if (id) fetchMoment(); }, [id, fetchMoment]);

  const handleLike = async () => {
    if (!moment || liking) return;
    setLiking(true);
    const wasLiked = moment.is_liked;
    setMoment(prev => prev ? { ...prev, is_liked: !wasLiked, like_count: (prev.like_count || 0) + (wasLiked ? -1 : 1) } : prev);
    try {
      await api.post(`/moments/${id}/spark`);
    } catch {
      setMoment(prev => prev ? { ...prev, is_liked: wasLiked, like_count: (prev.like_count || 0) + (wasLiked ? 1 : -1) } : prev);
    } finally {
      setLiking(false);
    }
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="md-content">
        <main className="md-container">
          <button className="md-back-btn" onClick={() => navigate('/moments')}>
            <ArrowLeft size={16} /> Moments
          </button>

          {loading ? (
            <div className="md-skeleton">
              <div className="mds-media pulse" />
              <div className="mds-info">
                <div className="mds-line pulse" style={{ width: '40%', height: 14, marginBottom: 10 }} />
                <div className="mds-line pulse" style={{ width: '80%', height: 11 }} />
              </div>
            </div>
          ) : !moment ? (
            <div className="md-not-found">
              <p>Moment not found or has expired.</p>
              <button onClick={() => navigate('/moments')}>Browse Moments</button>
            </div>
          ) : (
            <div className="md-card">
              {/* Media */}
              <div className="md-media-wrap">
                {moment.is_video ? (
                  <video src={moment.media_url} className="md-media" controls autoPlay poster={moment.thumbnail_url} />
                ) : (
                  <img src={moment.media_url || moment.thumbnail_url} className="md-media" alt="Moment" />
                )}

                {/* Side Actions */}
                <div className="md-side-actions">
                  <button className={`md-action-btn ${moment.is_liked ? 'liked' : ''}`} onClick={handleLike}>
                    <Heart size={24} fill={moment.is_liked ? 'currentColor' : 'none'} />
                    <span>{moment.like_count || 0}</span>
                  </button>
                  <button className="md-action-btn">
                    <MessageSquare size={24} />
                    <span>{moment.comment_count || 0}</span>
                  </button>
                  <button className="md-action-btn">
                    <Share2 size={24} />
                    <span>Share</span>
                  </button>
                </div>

                {/* Bottom Info */}
                <div className="md-bottom-info">
                  <div className="md-user-row" onClick={() => navigate(`/profile/${moment.username}`)}>
                    <img
                      src={moment.avatar_url || '/uploads/avatars/default.png'}
                      className="md-avatar"
                      alt={moment.username}
                      onError={(e) => { (e.target as HTMLImageElement).src = '/uploads/avatars/default.png'; }}
                    />
                    <span className="md-username">@{moment.username}</span>
                  </div>
                  {moment.caption && <p className="md-caption">{moment.caption}</p>}
                  <div className="md-view-count">
                    <Eye size={13} /> {moment.view_count || 0} views
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <style>{`
        .page-wrapper { display: flex; background: #000; min-height: 100vh; }
        .md-content { flex: 1; overflow-y: auto; }
        .md-container { max-width: 480px; margin: 0 auto; padding: 20px 16px 80px; }
        .md-back-btn { display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.1); border: none; padding: 10px 16px; border-radius: 12px; font-weight: 700; font-size: 14px; color: white; cursor: pointer; margin-bottom: 16px; transition: 0.2s; }
        .md-back-btn:hover { background: rgba(255,255,255,0.15); }

        .md-card { position: relative; }
        .md-media-wrap { position: relative; border-radius: 20px; overflow: hidden; background: #111; aspect-ratio: 9/16; max-height: 85vh; }
        .md-media { width: 100%; height: 100%; object-fit: contain; display: block; }
        
        .md-side-actions { position: absolute; right: 14px; bottom: 100px; display: flex; flex-direction: column; gap: 18px; }
        .md-action-btn { display: flex; flex-direction: column; align-items: center; gap: 4px; background: none; border: none; color: white; cursor: pointer; font-size: 11px; font-weight: 700; text-shadow: 0 1px 3px rgba(0,0,0,0.8); transition: 0.2s; filter: drop-shadow(0 1px 3px rgba(0,0,0,0.5)); }
        .md-action-btn.liked { color: #FF3D6D; }
        .md-action-btn:hover { transform: scale(1.1); }

        .md-bottom-info { position: absolute; bottom: 0; left: 0; right: 60px; padding: 20px 16px; background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%); }
        .md-user-row { display: flex; align-items: center; gap: 10px; cursor: pointer; margin-bottom: 8px; }
        .md-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid white; }
        .md-username { color: white; font-weight: 800; font-size: 14px; }
        .md-caption { color: rgba(255,255,255,0.9); font-size: 13px; line-height: 1.5; margin: 0 0 8px; }
        .md-view-count { display: flex; align-items: center; gap: 5px; font-size: 12px; color: rgba(255,255,255,0.6); font-weight: 600; }

        .md-skeleton { border-radius: 20px; overflow: hidden; aspect-ratio: 9/16; max-height: 85vh; }
        .mds-media { height: 80%; background: rgba(255,255,255,0.08); }
        .mds-info { padding: 16px; }
        .mds-line { border-radius: 6px; background: rgba(255,255,255,0.1); }
        .pulse { animation: mdPulse 1.5s ease-in-out infinite; }
        @keyframes mdPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }

        .md-not-found { text-align: center; padding: 60px 20px; color: rgba(255,255,255,0.5); }
        .md-not-found button { background: linear-gradient(135deg,#FF6B8B,#FF3D6D); color: white; border: none; padding: 12px 24px; border-radius: 14px; font-weight: 700; cursor: pointer; margin-top: 16px; }
      `}</style>
    </div>
  );
}
