import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, Plus, MapPin, X, Camera, Image as ImageIcon, Compass } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';
import { useUserStore } from '../store/userStore';

const CATEGORIES = ['All Circles', 'Academic', 'Social', 'Sports', 'Music/Arts', 'Technology', 'Volunteer'];

interface Club {
  club_id: string;
  name: string;
  description: string;
  category: string;
  campus: string;
  member_count: number;
  logo_url?: string;
  banner_url?: string;
}

export default function Clubs() {
  const { user } = useUserStore();
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All Circles');
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'Academic', description: '', campus: user?.campus || '' });

  useEffect(() => {
    fetchClubs(activeCategory);
  }, [activeCategory]);

  const fetchClubs = async (cat: string) => {
    setLoading(true);
    try {
      const category = cat === 'All Circles' ? 'all' : cat;
      const res = await api.get(`/clubs?category=${category}`);
      setClubs(res.data.clubs || res.data || []);
    } catch (err) {
      console.error('Failed to fetch clubs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await api.post('/clubs', form);
      const clubId = res.data.club_id || res.data.clubId;
      if (clubId) navigate(`/clubs/${clubId}`);
    } catch (err) {
      console.error('Create club error:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="page-main-content">
        <main className="clubs-container">
          {/* Header */}
          <div className="clubs-discover-header">
            <div className="clubs-header-inner">
              <div>
                <h1>Communities</h1>
                <p>Connect with peers who share your passions at {user?.campus || 'your campus'}</p>
              </div>
              <button className="clubs-create-btn" onClick={() => setShowModal(true)}>
                <Plus size={18} /> Start a Club
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="clubs-category-scroll">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                className={`clubs-cat-tab ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid */}
          {loading ? (
            <div className="clubs-grid">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="club-card-skeleton">
                  <div className="skeleton-banner pulse" />
                  <div className="skeleton-content">
                    <div className="skeleton-line pulse" style={{ width: '60%', marginBottom: 8 }} />
                    <div className="skeleton-line pulse" style={{ width: '90%', marginBottom: 6 }} />
                    <div className="skeleton-line pulse" style={{ width: '70%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : clubs.length > 0 ? (
            <div className="clubs-grid">
              {clubs.map(club => (
                <Link key={club.club_id} to={`/clubs/${club.club_id}`} className="club-card">
                  <div className="club-card-banner" style={{
                    backgroundImage: `url('${club.banner_url || 'https://images.unsplash.com/photo-1541339907198-e08756ebafe3?w=800'}')`
                  }} />
                  <img
                    src={club.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(club.name)}&background=random&color=fff`}
                    className="club-card-logo"
                    alt={club.name}
                    onError={(e) => { (e.target as HTMLImageElement).src = '/uploads/avatars/default.png'; }}
                  />
                  <div className="club-card-content">
                    <div className="club-card-category">{club.category}</div>
                    <h3 className="club-card-name">{club.name}</h3>
                    <p className="club-card-bio">{club.description}</p>
                    <div className="club-card-footer">
                      <span><Users size={16} /> {club.member_count || 0} Members</span>
                      <span><MapPin size={14} /> {club.campus}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="clubs-empty">
              <div className="clubs-empty-icon"><Compass size={42} /></div>
              <h2>Untapped Potential</h2>
              <p>This category is waiting for its first community. Be the pioneer!</p>
              <button className="clubs-create-btn" onClick={() => setShowModal(true)}>Create the First Club</button>
            </div>
          )}
        </main>
      </div>

      {/* FAB */}
      <button className="clubs-fab" onClick={() => setShowModal(true)}>
        <Plus size={26} />
      </button>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal-card">
            <div className="modal-header">
              <h3>Launch Your Circle</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-branding-grid">
                <div className="upload-zone"><Camera size={24} /><span>Logo</span></div>
                <div className="upload-zone"><ImageIcon size={24} /><span>Banner</span></div>
              </div>
              <div className="modal-field">
                <label>Name of the Community</label>
                <input type="text" placeholder="e.g. Future Founders" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="modal-grid-2">
                <div className="modal-field">
                  <label>Sphere</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    {['Academic', 'Social', 'Sports', 'Music/Arts', 'Technology', 'Volunteer'].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="modal-field">
                  <label>Base</label>
                  <input type="text" value={form.campus} readOnly />
                </div>
              </div>
              <div className="modal-field">
                <label>The Mission</label>
                <textarea rows={4} placeholder="Tell potential members what to expect..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-secondary-modal" onClick={() => setShowModal(false)}>Wait, go back</button>
                <button type="submit" className="btn-primary-modal" disabled={creating}>
                  {creating ? 'Launching...' : 'Launch Club'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .page-wrapper { display: flex; background: var(--bg-main, #f8fafc); min-height: 100vh; }
        .page-main-content { flex: 1; overflow-y: auto; }
        .clubs-container { padding: 40px 60px 100px; max-width: 1400px; margin: 0 auto; }
        @media (max-width: 1024px) { .clubs-container { padding: 30px 20px 100px; } }
        @media (max-width: 768px) { .clubs-container { padding: 20px 15px 100px; } }

        .clubs-discover-header { margin-bottom: 40px; background: linear-gradient(135deg, white 0%, rgba(255,61,109,0.04) 100%); padding: 50px 40px; border-radius: 40px; border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 4px 20px rgba(0,0,0,0.04); position: relative; overflow: hidden; }
        .clubs-header-inner { position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: center; gap: 20px; }
        .clubs-discover-header h1 { font-size: 2.5rem; font-weight: 900; letter-spacing: -1.5px; margin: 0 0 8px; }
        .clubs-discover-header p { color: #64748b; font-size: 1.1rem; margin: 0; }

        .clubs-create-btn { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #FF6B8B, #FF3D6D); color: white; border: none; padding: 14px 28px; border-radius: 18px; font-weight: 800; font-size: 0.95rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 15px rgba(255,61,109,0.25); }
        .clubs-create-btn:hover { opacity: 0.9; transform: translateY(-2px); }

        .clubs-category-scroll { display: flex; gap: 10px; margin-bottom: 40px; overflow-x: auto; padding: 5px 2px 16px; scrollbar-width: none; }
        .clubs-category-scroll::-webkit-scrollbar { display: none; }

        .clubs-cat-tab { padding: 11px 26px; border-radius: 20px; background: white; border: 1px solid rgba(0,0,0,0.08); color: #64748b; font-weight: 700; cursor: pointer; transition: all 0.3s cubic-bezier(0.175,0.885,0.32,1.275); white-space: nowrap; font-size: 0.9rem; }
        .clubs-cat-tab:hover { border-color: #FF3D6D; color: #FF3D6D; transform: translateY(-3px); }
        .clubs-cat-tab.active { background: linear-gradient(135deg, #FF6B8B, #FF3D6D); color: white; border-color: transparent; box-shadow: 0 8px 20px rgba(255,61,109,0.2); }

        .clubs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 30px; }

        .club-card { background: white; border-radius: 28px; overflow: hidden; transition: all 0.5s var(--ease-out); border: 1px solid rgba(0,0,0,0.04); display: flex; flex-direction: column; box-shadow: var(--shadow-md); text-decoration: none; color: inherit; }
        .club-card:hover { transform: translateY(-8px); box-shadow: var(--shadow-lg); border-color: rgba(255, 61, 109, 0.1); }
        .club-card-banner { height: 170px; background-size: cover; background-position: center; position: relative; }
        .club-card-banner::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.55)); }
        .club-card-logo { width: 72px; height: 72px; border-radius: 22px; border: 5px solid white; position: absolute; bottom: -36px; left: 26px; z-index: 2; object-fit: cover; background: white; box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
        .club-card-content { padding: 50px 26px 24px; flex-grow: 1; display: flex; flex-direction: column; }
        .club-card-category { font-size: 0.72rem; font-weight: 900; text-transform: uppercase; color: var(--primary); letter-spacing: 1.5px; margin-bottom: 8px; }
        .club-card-name { font-size: 1.4rem; font-weight: 850; margin: 0 0 10px; color: #111; letter-spacing: -0.5px; font-family: 'Outfit', sans-serif; }
        .club-card-bio { font-size: 0.9rem; color: #555; line-height: 1.6; margin-bottom: 20px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .club-card-footer { margin-top: auto; display: flex; justify-content: space-between; align-items: center; padding-top: 16px; border-top: 1px solid rgba(0,0,0,0.05); font-size: 0.88rem; color: #666; font-weight: 700; }
        .club-card-footer span { display: flex; align-items: center; gap: 6px; }

        .club-card-skeleton { background: white; border-radius: 32px; overflow: hidden; border: 1px solid rgba(0,0,0,0.05); }
        .skeleton-banner { height: 170px; }
        .skeleton-content { padding: 20px; }
        .skeleton-line { height: 12px; border-radius: 6px; background: #e2e8f0; margin-bottom: 8px; }
        .pulse { animation: pulseAnim 1.5s ease-in-out infinite; }
        @keyframes pulseAnim { 0%,100%{opacity:1} 50%{opacity:0.5} }

        .clubs-empty { grid-column: 1/-1; text-align: center; padding: 80px 40px; background: white; border-radius: 40px; border: 2px dashed rgba(0,0,0,0.08); }
        .clubs-empty-icon { width: 90px; height: 90px; background: #f8fafc; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; color: #FF3D6D; opacity: 0.3; }
        .clubs-empty h2 { font-weight: 900; margin: 0 0 12px; letter-spacing: -1px; }
        .clubs-empty p { color: #64748b; font-size: 1rem; max-width: 360px; margin: 0 auto 28px; }

        .clubs-fab { position: fixed; bottom: 36px; right: 36px; width: 62px; height: 62px; border-radius: 20px; background: linear-gradient(135deg, #FF6B8B, #FF3D6D); color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 12px 28px rgba(255,61,109,0.35); cursor: pointer; z-index: 100; border: none; transition: all 0.3s cubic-bezier(0.175,0.885,0.32,1.275); }
        .clubs-fab:hover { transform: scale(1.1) rotate(90deg); }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); z-index: 1000; display: none; align-items: center; justify-content: center; padding: 20px; }
        .modal-overlay.active { display: flex; }
        .modal-card { background: white; width: 100%; max-width: 640px; border-radius: 32px; padding: 40px; box-shadow: 0 40px 80px rgba(0,0,0,0.4); max-height: 90vh; overflow-y: auto; animation: slideUp 0.3s ease; }
        @keyframes slideUp { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: translateY(0); } }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #f1f5f9; }
        .modal-header h3 { margin: 0; font-size: 1.6rem; font-weight: 900; letter-spacing: -1px; }
        .modal-close { background: #f1f5f9; border: none; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .modal-close:hover { background: #e2e8f0; }
        .modal-branding-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 24px; }
        .upload-zone { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 20px; padding: 24px; text-align: center; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 10px; color: #94a3b8; font-weight: 700; font-size: 0.9rem; transition: 0.2s; }
        .upload-zone:hover { border-color: #FF3D6D; color: #FF3D6D; background: #fff5f7; }
        .modal-field { margin-bottom: 20px; }
        .modal-field label { display: block; font-weight: 700; font-size: 0.9rem; color: #334155; margin-bottom: 8px; }
        .modal-field input, .modal-field select, .modal-field textarea { width: 100%; padding: 14px 16px; border: 2px solid #e2e8f0; border-radius: 16px; font-size: 0.95rem; color: #1e293b; background: #f8fafc; transition: 0.2s; box-sizing: border-box; font-family: inherit; }
        .modal-field input:focus, .modal-field select:focus, .modal-field textarea:focus { border-color: #FF3D6D; outline: none; background: white; }
        .modal-field textarea { resize: none; }
        .modal-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .modal-actions { display: flex; gap: 15px; margin-top: 10px; }
        .btn-secondary-modal { flex: 1; padding: 15px; border-radius: 18px; background: white; color: #334155; border: 1px solid #e2e8f0; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .btn-secondary-modal:hover { background: #f8fafc; }
        .btn-primary-modal { flex: 1; padding: 15px; border-radius: 18px; background: linear-gradient(135deg, #FF6B8B, #FF3D6D); color: white; border: none; font-weight: 800; font-size: 1rem; cursor: pointer; transition: 0.2s; }
        .btn-primary-modal:disabled { opacity: 0.6; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
