import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Image as ImageIcon, Grid, Layers, PlayCircle, Eye, Heart } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';
import type { Post } from '../types/post';

export default function Gallery() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState<Post[]>([]);
  const [filter, setFilter] = useState<'all' | 'photos' | 'videos'>('all');

  useEffect(() => {
    const fetchMedia = async () => {
      setLoading(true);
      try {
        const res = await api.get('/posts/feed?limit=24');
        const items = res.data.posts || res.data || [];
        // Filter out posts without media
        setMedia(items.filter((i: Post) => i.media_url && i.media_url !== '/uploads/defaults/no-image.png'));
      } catch (err) {
        console.error('Failed to fetch gallery:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMedia();
  }, []);

  const filteredMedia = media.filter(m => {
    if (filter === 'all') return true;
    const isVideo = m.media_type === 'video' || (m.media_url && m.media_url.match(/\.(mp4|webm|ogg|mov)$/i));
    return filter === 'videos' ? isVideo : !isVideo;
  });

  return (
    <div className="gallery-root">
      <Navbar />
      <div className="gallery-content">
        <div className="gallery-container responsive-container">
          <header className="gallery-header">
            <div className="header-top">
              <button onClick={() => navigate(-1)} className="back-btn">
                <ArrowLeft size={24} />
              </button>
              <div className="header-info">
                <h1>Media Gallery</h1>
                <p>{media.length} items shared by you</p>
              </div>
            </div>

            <div className="gallery-filters">
              <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
                <Grid size={18} />
                <span>All</span>
              </button>
              <button className={`filter-btn ${filter === 'photos' ? 'active' : ''}`} onClick={() => setFilter('photos')}>
                <ImageIcon size={18} />
                <span>Photos</span>
              </button>
              <button className={`filter-btn ${filter === 'videos' ? 'active' : ''}`} onClick={() => setFilter('videos')}>
                <PlayCircle size={18} />
                <span>Videos</span>
              </button>
            </div>
          </header>

          <div className="gallery-main">
            {loading ? (
              <div className="gallery-grid">
                {[...Array(12)].map((_, i) => <div key={i} className="gallery-skeleton animate-pulse" />)}
              </div>
            ) : filteredMedia.length === 0 ? (
              <div className="empty-gallery">
                <Layers size={64} className="text-slate-200" />
                <h3>No {filter !== 'all' ? filter : 'media'} yet</h3>
                <p>Start sharing photos and videos to see them here.</p>
              </div>
            ) : (
              <div className="gallery-grid">
                {filteredMedia.map(m => (
                  <div key={m.post_id} className="gallery-item group" onClick={() => navigate(`/post/${m.post_id}`)}>
                    {m.media_type === 'video' || (m.media_url && m.media_url.match(/\.(mp4|webm|ogg|mov)$/i)) ? (
                      <div className="item-media-container">
                        <video src={m.media_url} />
                        <div className="video-icon"><PlayCircle size={20} fill="white" /></div>
                      </div>
                    ) : (
                      <img src={m.media_url || '/uploads/posts/default.png'} alt="" />
                    )}
                    <div className="gallery-overlay">
                      <div className="overlay-stats">
                        <span><Heart size={16} fill="white" /> {m.sparks || 0}</span>
                        <span><Eye size={16} fill="white" /> {m.comments || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .gallery-root { display: flex; background: #000; color: #fff; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .gallery-content { flex: 1; height: 100vh; overflow-y: auto; scrollbar-width: none; }
        .gallery-content::-webkit-scrollbar { display: none; }
        .gallery-container { max-width: 935px; margin: 40px auto; padding: 0 16px 100px; }
        
        .gallery-header { margin-bottom: 40px; }
        .header-top { display: flex; gap: 24px; align-items: flex-start; margin-bottom: 30px; }
        .back-btn { background: #262626; border: none; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; cursor: pointer; transition: background 0.2s; }
        .back-btn:hover { background: #363636; }
        .header-info h1 { font-size: 2.2rem; font-weight: 800; color: #fff; margin-bottom: 4px; font-family: 'Outfit', sans-serif; }
        .header-info p { color: #a8a8a8; font-size: 1.1rem; }

        .gallery-filters { display: flex; gap: 12px; border-top: 1px solid #262626; padding-top: 20px; justify-content: center; }
        .filter-btn { display: flex; align-items: center; gap: 8px; background: none; border: none; color: #a8a8a8; font-weight: 700; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; cursor: pointer; padding: 12px 24px; border-radius: 12px; transition: all 0.2s; }
        .filter-btn:hover { background: #1a1a1a; color: #fff; }
        .filter-btn.active { color: #fff; background: #262626; }

        .gallery-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
        .gallery-item { aspect-ratio: 1/1; position: relative; overflow: hidden; background: #262626; cursor: pointer; }
        .gallery-item img, .gallery-item video { width: 100%; height: 100%; object-fit: cover; transition: transform 0.8s cubic-bezier(0.16, 1, 0.3, 1); }
        .gallery-item:hover img, .gallery-item:hover video { transform: scale(1.05); }
        
        .item-media-container { position: relative; width: 100%; height: 100%; }
        .video-icon { position: absolute; top: 10px; right: 10px; color: #fff; text-shadow: 0 0 4px rgba(0,0,0,0.5); }

        .gallery-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; }
        .gallery-item:hover .gallery-overlay { opacity: 1; }
        .overlay-stats { display: flex; gap: 30px; font-weight: 800; font-size: 1.1rem; }
        .overlay-stats span { display: flex; align-items: center; gap: 8px; }

        .gallery-skeleton { aspect-ratio: 1/1; background: #1a1a1a; border-radius: 4px; }
        .empty-gallery { grid-column: 1 / -1; padding: 100px 0; text-align: center; color: #a8a8a8; }
        .empty-gallery h3 { font-size: 1.5rem; color: #fff; margin: 20px 0 10px; font-weight: 800; }

        @media (max-width: 768px) {
          .gallery-grid { gap: 2px; }
          .header-info h1 { font-size: 1.8rem; }
          .gallery-filters { gap: 0; justify-content: space-around; }
          .filter-btn { padding: 12px 10px; font-size: 0.7rem; }
        }
      `}</style>
    </div>
  );
}
