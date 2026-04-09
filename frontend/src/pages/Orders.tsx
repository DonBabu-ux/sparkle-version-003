import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Package, ChevronLeft, CreditCard, Clock } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get('/marketplace/orders'); // Assuming this endpoint exists based on EJS
      setOrders(response.data.orders || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <main className="orders-container">
        <header className="orders-header">
          <button className="back-btn" onClick={() => navigate('/marketplace')}>
            <ChevronLeft size={20} />
          </button>
          <h1>Order History</h1>
        </header>

        {loading ? (
          <div className="loader">Reviewing the campus ledgers...</div>
        ) : orders.length === 0 ? (
          <div className="empty-state">
            <ShoppingCart size={48} className="icon" />
            <h3>No orders found</h3>
            <p>Your history is as clear as a fresh semester.</p>
            <button className="browse-btn" onClick={() => navigate('/marketplace')}>Start Shopping</button>
          </div>
        ) : (
          <div className="orders-list">
            {orders.map(order => (
              <div key={order.order_id} className="order-card premium-card">
                <div className="order-icon">
                  <Package size={24} />
                </div>
                <div className="order-main">
                  <div className="order-top">
                    <span className="order-id">#{order.order_id.slice(-6).toUpperCase()}</span>
                    <span className={`order-status ${order.status?.toLowerCase()}`}>{order.status || 'Pending'}</span>
                  </div>
                  <h3 className="item-name">{order.listing_title || 'Marketplace Item'}</h3>
                  <div className="order-meta">
                    <span><CreditCard size={12} /> KSh {order.amount || order.price}</span>
                    <span><Clock size={12} /> {new Date(order.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <button className="details-btn" onClick={() => navigate(`/marketplace/listings/${order.listing_id}`)}>View Item</button>
              </div>
            ))}
          </div>
        )}
      </main>

      <style>{`
        .page-wrapper { display: flex; background: #f8fafc; min-height: 100vh; }
        .orders-container { flex: 1; max-width: 800px; margin: 0 auto; padding: 40px 20px 100px; }
        
        .orders-header { display: flex; align-items: center; gap: 20px; margin-bottom: 40px; }
        .back-btn { background: white; border: 1px solid #e2e8f0; width: 44px; height: 44px; border-radius: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; }
        .back-btn:hover { background: #f1f5f9; }
        .orders-header h1 { font-size: 1.8rem; font-weight: 900; color: #0f172a; margin: 0; }

        .orders-list { display: flex; flex-direction: column; gap: 16px; }
        .order-card { display: flex; align-items: center; gap: 20px; padding: 20px; border-radius: 20px; }
        
        .order-icon { width: 48px; height: 48px; border-radius: 14px; background: #f1f5f9; color: #64748b; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        
        .order-main { flex: 1; }
        .order-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
        .order-id { font-size: 0.75rem; font-weight: 800; color: #94a3b8; letter-spacing: 1px; }
        .order-status { font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 4px 10px; border-radius: 8px; background: #f1f5f9; color: #64748b; }
        .order-status.completed { background: #dcfce7; color: #166534; }
        .order-status.pending { background: #fef3c7; color: #92400e; }

        .item-name { font-size: 1.1rem; font-weight: 800; color: #1e293b; margin: 0 0 8px; }
        
        .order-meta { display: flex; gap: 16px; font-size: 12px; color: #64748b; font-weight: 700; }
        .order-meta span { display: flex; align-items: center; gap: 5px; }

        .details-btn { padding: 10px 18px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; color: #334155; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: 0.2s; }
        .details-btn:hover { background: #f1f5f9; color: var(--primary); border-color: var(--primary); }

        .loader { text-align: center; padding: 100px; color: #64748b; font-weight: 800; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; }

        .empty-state { text-align: center; padding: 100px 40px; background: white; border-radius: 28px; border: 2px dashed #e2e8f0; display: flex; flex-direction: column; align-items: center; }
        .empty-state .icon { color: #cbd5e1; margin-bottom: 24px; }
        .empty-state h3 { font-size: 1.5rem; font-weight: 900; color: #1e293b; margin: 0 0 8px; }
        .empty-state p { color: #94a3b8; margin-bottom: 30px; }
        .empty-state .browse-btn { background: var(--primary-gradient); color: white; border: none; padding: 14px 28px; border-radius: 16px; font-weight: 800; cursor: pointer; }
      `}</style>
    </div>
  );
}
