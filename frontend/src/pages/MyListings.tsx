import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Trash2, Edit3, ExternalLink, ChevronLeft } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';
import type { Listing } from '../types/listing';

export default function MyListings() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMyListings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/marketplace/my-listings');
      setListings(response.data.listings || []);
    } catch (err) {
      console.error('Failed to fetch listings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyListings();
  }, [fetchMyListings]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    try {
      await api.delete(`/marketplace/listings/${id}`);
      setListings(l => l.filter(item => item.listing_id !== id));
    } catch (err) {
      alert('Failed to delete listing');
    }
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <main className="mylist-container">
        <header className="mylist-header">
          <button className="back-btn" onClick={() => navigate('/marketplace')}>
            <ChevronLeft size={20} />
          </button>
          <h1>My Marketplace items</h1>
        </header>

        {loading ? (
          <div className="loader">Summoning your inventory...</div>
        ) : listings.length === 0 ? (
          <div className="empty-state">
            <Package size={48} className="icon" />
            <h3>Your inventory is hollow</h3>
            <p>You haven't listed anything for sale yet.</p>
            <button className="create-btn" onClick={() => navigate('/marketplace')}>Browse Marketplace</button>
          </div>
        ) : (
          <div className="listings-list">
            {listings.map(item => (
              <div key={item.listing_id} className="list-card premium-card">
                <div className="card-thumb">
                  <img src={item.image_url || '/uploads/defaults/no-image.png'} alt="" />
                </div>
                <div className="card-details">
                  <h3 className="title">{item.title}</h3>
                  <div className="price">KSh {item.price}</div>
                  <div className="status-badge">{item.status || 'Active'}</div>
                </div>
                <div className="card-actions">
                  <button onClick={() => navigate(`/marketplace/listings/${item.listing_id}`)} className="action-btn" title="View">
                    <ExternalLink size={18} />
                  </button>
                  <button className="action-btn" title="Edit">
                    <Edit3 size={18} />
                  </button>
                  <button onClick={() => handleDelete(item.listing_id)} className="action-btn delete" title="Delete">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <style>{`
        .page-wrapper { display: flex; background: #f8fafc; min-height: 100vh; }
        .mylist-container { flex: 1; max-width: 900px; margin: 0 auto; padding: 40px 20px 100px; }
        
        .mylist-header { display: flex; align-items: center; gap: 20px; margin-bottom: 40px; }
        .back-btn { background: white; border: 1px solid #e2e8f0; width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .back-btn:hover { background: #f1f5f9; }
        .mylist-header h1 { font-size: 1.8rem; font-weight: 900; color: #0f172a; margin: 0; }

        .listings-list { display: flex; flex-direction: column; gap: 16px; }
        .list-card { display: flex; align-items: center; gap: 24px; padding: 16px; border-radius: 20px; }
        
        .card-thumb { width: 100px; height: 100px; border-radius: 14px; overflow: hidden; background: #f1f5f9; flex-shrink: 0; }
        .card-thumb img { width: 100%; height: 100%; object-fit: cover; }
        
        .card-details { flex: 1; }
        .card-details .title { font-size: 1.1rem; font-weight: 800; color: #1e293b; margin: 0 0 4px; }
        .card-details .price { font-weight: 800; color: #059669; font-size: 1rem; margin-bottom: 8px; }
        .status-badge { display: inline-block; background: #f1f5f9; padding: 4px 10px; border-radius: 8px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; color: #64748b; }

        .card-actions { display: flex; gap: 8px; }
        .action-btn { width: 40px; height: 40px; border-radius: 12px; border: 1px solid #e2e8f0; background: white; color: #64748b; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .action-btn:hover { background: #f8fafc; color: var(--primary); border-color: var(--primary); }
        .action-btn.delete:hover { background: #fef2f2; color: #ef4444; border-color: #ef4444; }

        .loader { text-align: center; padding: 100px; color: #64748b; font-weight: 800; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; }

        .empty-state { text-align: center; padding: 100px 40px; background: white; border-radius: 28px; border: 2px dashed #e2e8f0; display: flex; flex-direction: column; align-items: center; }
        .empty-state .icon { color: #cbd5e1; margin-bottom: 24px; }
        .empty-state h3 { font-size: 1.5rem; font-weight: 900; color: #1e293b; margin: 0 0 8px; }
        .empty-state p { color: #94a3b8; margin-bottom: 30px; }
        .empty-state .create-btn { background: var(--primary-gradient); color: white; border: none; padding: 14px 28px; border-radius: 16px; font-weight: 800; cursor: pointer; }
      `}</style>
    </div>
  );
}
