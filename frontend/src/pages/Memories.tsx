import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, History, Calendar, Sparkles, ChevronRight, Share2 } from 'lucide-react';
import api from '../api/api';
import type { Post } from '../types/post';

export default function Memories() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [memories, setMemories] = useState<Post[]>([]);
  const [previewImage, setPreviewImage] = useState<Post | null>(null);

  useEffect(() => {
    const fetchMemories = async () => {
      setLoading(true);
      try {
        // Mocking memories as top posts from the past
        const res = await api.get('/posts/feed?limit=5');
        setMemories(res.data.posts || res.data || []);
      } catch (err) {
        console.error('Failed to fetch memories:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMemories();
  }, []);

  return (
    <div className="memories-root">
      <div className="memories-content">
        <div className="memories-container responsive-container">
          <header className="memories-header">
            <button onClick={() => navigate(-1)} className="back-btn">
              <ArrowLeft size={24} />
            </button>
            <div className="header-info">
              <h1>Memories</h1>
              <p>Relive your favorite Sparkle moments from the past.</p>
            </div>
          </header>

          <div className="memories-main">
            {/* Today's Special Memory */}
            <div className="on-this-day-card responsive-card">
              <div className="card-badge">
                <Calendar size={14} />
                <span>ON THIS DAY</span>
              </div>
              <div className="card-date">April 20, 2024</div>
              <h3>1 Year Ago Today</h3>
              <p>You shared a moment that sparkled!</p>
              
              {memories.length > 0 ? (
                <div className="featured-memory animate-scale-in" onClick={() => setPreviewImage(memories[0])}>
                  <img src={memories[0].media_url || '/uploads/posts/default.png'} alt="" />
                  <div className="memory-overlay">
                    <Sparkles size={24} className="text-white" />
                  </div>
                </div>
              ) : (
                <div className="empty-memory-box">
                  <History size={48} className="text-slate-200" />
                  <p>No posts from this day in previous years.</p>
                </div>
              )}
            </div>

            {/* List of Recent Memories */}
            <div className="memories-list-section">
              <h2 className="section-title">Past Highlights</h2>
              <div className="memories-grid responsive-grid">
                {loading ? (
                  [...Array(4)].map((_, i) => <div key={i} className="memory-skeleton animate-pulse" />)
                ) : memories.map(memory => (
                  <div key={memory.post_id} className="memory-card group" onClick={() => setPreviewImage(memory)}>
                    <div className="memory-thumb">
                      <img src={memory.media_url || '/uploads/posts/default.png'} alt="" />
                      <div className="memory-date-overlay">
                        <span>{new Date(memory.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                    <div className="memory-info">
                      <p className="truncate">{memory.content || 'A beautiful memory...'}</p>
                      <div className="memory-footer">
                        <span className="text-rose-500 font-bold"><Sparkles size={12} className="inline mr-1" /> {memory.sparks || 0}</span>
                        <ChevronRight size={16} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="memories-footer">
              <button className="share-memories-btn mobile-full-btn">
                <Share2 size={18} />
                <span>Share your memories</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {previewImage && (
        <div className="image-preview-overlay" onClick={() => setPreviewImage(null)}>
          <button className="preview-close" onClick={() => setPreviewImage(null)}>
            <ArrowLeft size={24} />
          </button>
          <img src={previewImage.media_url || '/uploads/posts/default.png'} alt="Memory" className="preview-image" onClick={e => e.stopPropagation()} />
          <button className="preview-footer-btn" onClick={(e) => { e.stopPropagation(); navigate(`/post/${previewImage.post_id}`); }}>
            View Full Post <ChevronRight size={16} />
          </button>
        </div>
      )}

      <style>{`
        .memories-root { display: flex; flex-direction: column; background: #F0F2F5; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .memories-content { flex: 1; height: 100vh; overflow-y: auto; padding: 20px; }
        .memories-container { max-width: 700px; margin: 20px auto; padding-bottom: 80px; }
        .memories-header { display: flex; gap: 16px; margin-bottom: 32px; align-items: flex-start; }
        .back-btn { background: white; border: none; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #1e293b; box-shadow: 0 4px 12px rgba(0,0,0,0.05); cursor: pointer; transition: transform 0.2s; flex-shrink: 0; }
        .back-btn:active { transform: scale(0.9); }
        .header-info h1 { font-size: 2rem; font-weight: 800; color: #0f172a; margin-bottom: 4px; font-family: 'Outfit', sans-serif; line-height: 1.1; }
        .header-info p { color: #64748b; font-size: 1rem; line-height: 1.4; }

        .on-this-day-card { background: white; border-radius: 28px; padding: 24px; margin-bottom: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.05); text-align: center; border: 1px solid rgba(255, 61, 109, 0.1); }
        .card-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255, 61, 109, 0.1); color: #FF3D6D; padding: 6px 14px; border-radius: 20px; font-weight: 800; font-size: 0.7rem; letter-spacing: 1px; margin-bottom: 16px; }
        .card-date { color: #94a3b8; font-weight: 700; font-size: 0.85rem; margin-bottom: 4px; }
        .on-this-day-card h3 { font-size: 1.4rem; font-weight: 800; color: #1e293b; margin-bottom: 8px; }
        .on-this-day-card p { color: #64748b; margin-bottom: 24px; font-size: 0.95rem; }

        .featured-memory { position: relative; width: 100%; aspect-ratio: 16/9; border-radius: 20px; overflow: hidden; cursor: pointer; }
        .featured-memory img { width: 100%; height: 100%; object-fit: cover; }
        .memory-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s; }
        .featured-memory:hover .memory-overlay { opacity: 1; }

        .empty-memory-box { padding: 40px 20px; background: #f8fafc; border-radius: 20px; color: #94a3b8; border: 2px dashed #e2e8f0; display: flex; flex-direction: column; align-items: center; gap: 12px; }

        .section-title { font-size: 1.1rem; font-weight: 800; color: #1e293b; margin-bottom: 16px; padding-left: 8px; }
        .memories-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
        .memory-card { background: white; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.03); border: 1px solid #f1f5f9; cursor: pointer; transition: transform 0.3s; }
        .memory-card:hover { transform: translateY(-3px); }
        .memory-thumb { position: relative; height: 140px; overflow: hidden; }
        .memory-thumb img { width: 100%; height: 100%; object-fit: cover; }
        .memory-date-overlay { position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); color: white; font-size: 0.65rem; font-weight: 800; padding: 4px 8px; border-radius: 6px; }
        .memory-info { padding: 14px; }
        .memory-info p { font-size: 0.85rem; color: #475569; font-weight: 600; margin-bottom: 8px; line-height: 1.4; }
        .memory-footer { display: flex; justify-content: space-between; align-items: center; }

        .share-memories-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 16px; background: white; border: 2px solid #e2e8f0; border-radius: 20px; color: #1e293b; font-weight: 800; font-size: 0.95rem; cursor: pointer; transition: all 0.2s; margin-top: 32px; }
        .share-memories-btn:hover { border-color: #FF3D6D; color: #FF3D6D; background: rgba(255, 61, 109, 0.05); }

        .memory-skeleton { aspect-ratio: 1/1; background: white; border-radius: 24px; }

        .image-preview-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,0.9); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; }
        .preview-close { position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.1); border: none; width: 44px; height: 44px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s; }
        .preview-close:hover { background: rgba(255,255,255,0.2); }
        .preview-image { max-width: 90vw; max-height: 85vh; border-radius: 12px; object-fit: contain; box-shadow: 0 10px 40px rgba(0,0,0,0.5); animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .preview-footer-btn { position: absolute; bottom: 30px; padding: 12px 24px; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2); border-radius: 20px; color: white; font-weight: 800; display: flex; gap: 8px; align-items: center; cursor: pointer; backdrop-filter: blur(4px); transition: all 0.2s; }
        .preview-footer-btn:hover { background: rgba(255,255,255,0.25); }

        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }

        @media (max-width: 600px) {
          .memories-content { padding: 16px; }
          .memories-container { margin: 10px auto; padding-bottom: 60px; }
          .memories-grid { grid-template-columns: 1fr; gap: 12px; }
          .header-info h1 { font-size: 1.6rem; }
          .on-this-day-card { padding: 20px 16px; }
          .featured-memory { aspect-ratio: 4/3; }
        }
      `}</style>
    </div>
  );
}
