import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, Plus, Filter, ShieldCheck, ChevronRight } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';
import { useModalStore } from '../store/modalStore';
import { useUserStore } from '../store/userStore';

export default function Marketplace() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const { refreshCounter } = useModalStore();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [campus, setCampus] = useState(user?.campus || 'all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { id: 'all', label: 'All Items', icon: <Filter size={14} /> },
    { id: 'student_market', label: 'Student Market', icon: <ShoppingBag size={14} /> },
    { id: 'blackmarket', label: 'Black Market', icon: <Search size={14} /> },
    { id: 'electronics', label: 'Electronics', icon: <Search size={14} /> },
    { id: 'books', label: 'Books', icon: <Search size={14} /> }
  ];

  useEffect(() => {
    fetchListings();
  }, [category, campus, searchQuery, refreshCounter]);

  const fetchListings = async () => {
    setLoading(true);
    try {
      let endpoint = `/marketplace/listings?category=${category}&campus=${campus}`;
      if (searchQuery) endpoint += `&search=${searchQuery}`;
      
      const response = await api.get(endpoint);
      const resData = response.data;
      const list = resData.listings || resData.data || (Array.isArray(resData) ? resData : []);
      setListings(list);
    } catch (err) {
      console.error('Failed to fetch marketplace:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchListings();
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="market-layout">
        <header className="market-hero">
          <div className="hero-content">
            <div className="hero-badge">
              <ShoppingBag size={18} />
              <span>SPARKLE MARKET</span>
            </div>
            <h1>Campus Marketplace</h1>
            <p>Buy and sell treasures with your fellow Sparklers.</p>
          </div>
          
          <form className="market-search-bar" onSubmit={handleSearch}>
            <Search className="search-icon" size={20} />
            <input 
              type="text" 
              placeholder="Search for books, tech, housing..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit">Search</button>
          </form>
        </header>

        <div className="market-main-grid">
          <aside className="market-sidebar">
            <div className="sidebar-section">
              <h3 className="section-title">Categories</h3>
              <div className="category-list">
                {categories.map(cat => (
                  <button 
                    key={cat.id}
                    className={`cat-item ${category === cat.id ? 'active' : ''}`}
                    onClick={() => setCategory(cat.id)}
                  >
                    {cat.icon}
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="sidebar-section">
              <h3 className="section-title">Campus</h3>
              <div className="category-list">
                {[
                  { id: 'all', label: 'All Campuses' },
                  { id: 'Main Campus', label: 'Main Campus' },
                  { id: 'North Campus', label: 'North Campus' },
                  { id: 'South Campus', label: 'South Campus' }
                ].map(c => (
                  <button 
                    key={c.id}
                    className={`cat-item ${campus === c.id ? 'active' : ''}`}
                    onClick={() => setCampus(c.id)}
                  >
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="safety-card premium-card">
              <ShieldCheck className="safety-icon" size={32} />
              <h4>Safe Trading</h4>
              <p>Meet in public campus areas and verify items before paying.</p>
            </div>
          </aside>

          <section className="market-listings">
            <div className="listings-header">
              <h2>{categories.find(c => c.id === category)?.label}</h2>
              <button className="sell-btn-premium" onClick={() => {
                alert('Please use the "+" center button in the Navbar to "Sell Item"!');
              }}>
                <Plus size={18} /> Sell Something
              </button>
            </div>

            {loading ? (
              <div className="loader-container">
                <div className="spinner"></div>
                <p>Loading marketplace...</p>
              </div>
            ) : (
              <div className="listings-grid">
                {listings.length > 0 ? (
                  listings.map((item: any) => (
                    <div key={item.listing_id} className="market-card premium-card" onClick={() => navigate(`/marketplace/listings/${item.listing_id}`)}>
                      <div className="card-media">
                        <img src={item.image_url || '/uploads/defaults/no-image.png'} alt={item.title} />
                        <div className="price-tag">KSh {item.price}</div>
                        <div className="condition-label">{item.condition || 'Used'}</div>
                      </div>
                      <div className="card-info">
                        <h3 className="title">{item.title}</h3>
                        <p className="description">{item.description}</p>
                        <div className="card-footer">
                          <div className="seller">
                            <img src={item.seller_avatar || '/uploads/avatars/default.png'} alt="" />
                            <span>{item.seller_name || 'Seller'}</span>
                          </div>
                          <ChevronRight size={16} />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">🏜️</div>
                    <h3>Nothing here yet</h3>
                    <p>Try a different category or be the first to sell!</p>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      <style>{`
        .page-wrapper { display: flex; background: #f8fafc; min-height: 100vh; }
        .market-layout { flex: 1; overflow-y: auto; padding: 40px 20px 100px; }
        
        .market-hero { max-width: 1200px; margin: 0 auto 40px; display: flex; flex-direction: column; align-items: center; text-align: center; }
        .hero-badge { display: flex; align-items: center; gap: 8px; background: rgba(255,107,139,0.1); color: var(--primary); padding: 8px 16px; border-radius: 20px; font-weight: 800; font-size: 0.75rem; letter-spacing: 1px; margin-bottom: 20px; }
        .market-hero h1 { font-size: 3rem; font-weight: 900; margin: 0 0 10px; color: #0f172a; letter-spacing: -1px; }
        .market-hero p { color: #64748b; font-size: 1.1rem; max-width: 600px; margin-bottom: 30px; }

        .market-search-bar { width: 100%; max-width: 700px; background: white; border-radius: 24px; display: flex; align-items: center; padding: 8px 8px 8px 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.05); }
        .search-icon { color: #94a3b8; }
        .market-search-bar input { flex: 1; border: none; outline: none; padding: 12px 16px; font-size: 1rem; font-family: inherit; }
        .market-search-bar button { background: var(--primary-gradient); color: white; border: none; padding: 12px 30px; border-radius: 18px; font-weight: 800; cursor: pointer; transition: 0.2s; }
        .market-search-bar button:hover { transform: scale(1.02); }

        .market-main-grid { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 280px 1fr; gap: 40px; }

        .market-sidebar { display: flex; flex-direction: column; gap: 30px; }
        .section-title { font-size: 0.8rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; padding-left: 12px; }
        .category-list { display: flex; flex-direction: column; gap: 6px; }
        .cat-item { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-radius: 16px; border: none; background: transparent; color: #64748b; font-weight: 700; font-size: 0.95rem; text-align: left; cursor: pointer; transition: 0.2s; }
        .cat-item:hover { background: white; color: var(--primary); }
        .cat-item.active { background: white; color: var(--primary); box-shadow: 0 4px 12px rgba(0,0,0,0.03); }

        .safety-card { background: var(--primary-gradient); color: white; padding: 30px 24px; border: none; }
        .safety-icon { margin-bottom: 16px; opacity: 0.9; }
        .safety-card h4 { font-size: 1.1rem; font-weight: 800; margin: 0 0 10px; }
        .safety-card p { font-size: 0.85rem; opacity: 0.8; line-height: 1.5; margin: 0; }

        .market-listings { flex: 1; }
        .listings-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .listings-header h2 { font-size: 1.5rem; font-weight: 900; color: #0f172a; }
        .sell-btn-premium { display: flex; align-items: center; gap: 8px; border: 2px solid #e2e8f0; background: white; padding: 10px 20px; border-radius: 14px; font-weight: 800; font-size: 0.9rem; color: #1e293b; cursor: pointer; transition: 0.2s; }
        .sell-btn-premium:hover { border-color: var(--primary); color: var(--primary); }

        .listings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 24px; }
        .market-card { cursor: pointer; padding: 0; overflow: hidden; display: flex; flex-direction: column; height: 100%; }
        .card-media { position: relative; height: 200px; background: #f1f5f9; }
        .card-media img { width: 100%; height: 100%; object-fit: cover; transition: 0.5s; }
        .market-card:hover .card-media img { transform: scale(1.1); }
        .price-tag { position: absolute; bottom: 12px; right: 12px; background: white; color: #059669; font-weight: 900; font-size: 1.1rem; padding: 6px 14px; border-radius: 12px; box-shadow: 0 8px 16px rgba(0,0,0,0.1); }
        .condition-label { position: absolute; top: 12px; left: 12px; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); color: white; font-size: 0.7rem; font-weight: 800; padding: 4px 10px; border-radius: 8px; text-transform: uppercase; }

        .card-info { padding: 20px; flex: 1; display: flex; flex-direction: column; }
        .card-info .title { font-size: 1.1rem; font-weight: 800; color: #1e293b; margin: 0 0 8px; line-clamp: 1; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; }
        .card-info .description { font-size: 0.85rem; color: #64748b; line-height: 1.4; margin-bottom: 20px; flex: 1; line-clamp: 2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        
        .card-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 16px; border-top: 1px solid #f1f5f9; color: #94a3b8; }
        .card-footer .seller { display: flex; align-items: center; gap: 8px; }
        .card-footer .seller img { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
        .card-footer .seller span { font-size: 0.75rem; font-weight: 700; color: #64748b; }

        .empty-state { grid-column: 1 / -1; height: 400px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: white; border-radius: 24px; border: 2px dashed #e2e8f0; }
        .empty-icon { font-size: 4rem; margin-bottom: 20px; opacity: 0.3; }
        .empty-state h3 { font-size: 1.5rem; font-weight: 800; color: #1e293b; margin: 0; }
        .empty-state p { color: #94a3b8; }

        .loader-container { grid-column: 1 / -1; height: 400px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #64748b; }
        .spinner { width: 40px; height: 40px; border: 4px solid #f1f5f9; border-top: 4px solid var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 16px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        @media (max-width: 1024px) {
          .market-main-grid { grid-template-columns: 1fr; }
          .market-sidebar { display: none; }
          .market-hero h1 { font-size: 2rem; }
        }
      `}</style>
    </div>
  );
}
