import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Package, ChevronLeft, CreditCard, Clock, ChevronRight, CheckCircle2 } from 'lucide-react';
import api from '../api/api';
import clsx from 'clsx';
import { motion } from 'framer-motion';

interface Order {
  order_id: string;
  listing_id: string;
  listing_title?: string;
  amount?: number;
  price?: number;
  status?: string;
  created_at: string;
}

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get('/marketplace/orders');
      setOrders(response.data.orders || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-marketplace-text font-sans pb-20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-marketplace-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/marketplace')} className="w-10 h-10 flex items-center justify-center text-marketplace-text hover:bg-marketplace-bg rounded-full transition-colors">
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          <h1 className="text-[19px] font-black tracking-tight">Order History</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 pt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-marketplace-bg border-t-marketplace-text rounded-full animate-spin" />
            <p className="text-marketplace-muted font-bold animate-pulse">Reading ledgers...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 bg-marketplace-bg rounded-[40px] border-2 border-dashed border-marketplace-border text-center">
            <ShoppingCart size={64} className="text-marketplace-muted/30 mb-6" />
            <h3 className="text-2xl font-black mb-2">No orders found</h3>
            <p className="text-marketplace-muted font-medium mb-8">Your transaction history is empty.</p>
            <button 
              onClick={() => navigate('/marketplace')} 
              className="px-10 py-4 bg-marketplace-text text-white rounded-2xl font-black hover:scale-105 transition-transform active:scale-95 shadow-xl shadow-slate-200"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order, i) => (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                key={order.order_id} 
                onClick={() => navigate(`/marketplace/listings/${order.listing_id}`)}
                className="bg-white p-5 rounded-[32px] border border-marketplace-border shadow-sm flex items-center gap-5 cursor-pointer hover:bg-marketplace-bg transition-colors group"
              >
                <div className="w-16 h-16 rounded-2xl bg-marketplace-bg flex items-center justify-center text-marketplace-muted group-hover:bg-white transition-colors">
                  <Package size={28} />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] font-black text-marketplace-muted uppercase tracking-[0.2em]">#{order.order_id.slice(-6).toUpperCase()}</span>
                    <span className={clsx(
                      "text-[10px] font-black uppercase px-2 py-1 rounded-lg",
                      order.status?.toLowerCase() === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                    )}>
                      {order.status || 'Pending'}
                    </span>
                  </div>
                  <h3 className="font-black text-lg text-marketplace-text truncate mb-2 leading-tight">{order.listing_title || 'Marketplace Item'}</h3>
                  <div className="flex items-center gap-4 text-xs font-bold text-marketplace-muted">
                    <span className="flex items-center gap-1.5"><CreditCard size={14} className="text-marketplace-text" /> KES {parseFloat((order.amount || order.price || 0).toString()).toLocaleString()}</span>
                    <span className="flex items-center gap-1.5"><Clock size={14} /> {new Date(order.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="w-10 h-10 flex items-center justify-center text-marketplace-muted group-hover:text-marketplace-text transition-colors">
                  <ChevronRight size={24} />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
