import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Trash2, Edit3, ExternalLink, ChevronLeft, MoreVertical, CheckCircle2, Clock } from 'lucide-react';
import api from '../api/api';
import type { Listing } from '../types/listing';
import clsx from 'clsx';
import { motion } from 'framer-motion';

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
    } catch {
      alert('Failed to delete listing');
    }
  };

  const handleMarkSold = async (id: string) => {
    try {
      await api.patch(`/marketplace/listings/${id}/status`, { status: 'sold' });
      setListings(l => l.map(item => item.listing_id === id ? { ...item, status: 'sold' } : item));
    } catch {
      alert('Failed to update status');
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
          <h1 className="text-[19px] font-black tracking-tight">Your Listings</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-marketplace-bg border-t-marketplace-text rounded-full animate-spin" />
            <p className="text-marketplace-muted font-bold animate-pulse">Loading your shop...</p>
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 bg-marketplace-bg rounded-[40px] border-2 border-dashed border-marketplace-border text-center">
            <Package size={64} className="text-marketplace-muted/30 mb-6" />
            <h3 className="text-2xl font-black mb-2">No active listings</h3>
            <p className="text-marketplace-muted font-medium mb-8">You haven't posted any items for sale yet.</p>
            <button 
              onClick={() => navigate('/marketplace/sell')} 
              className="px-10 py-4 bg-marketplace-text text-white rounded-2xl font-black hover:scale-105 transition-transform active:scale-95 shadow-xl shadow-slate-200"
            >
              Create First Listing
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map(item => (
              <motion.div 
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key={item.listing_id} 
                className="bg-white rounded-[32px] overflow-hidden border border-marketplace-border shadow-sm group hover:shadow-xl transition-all duration-300"
              >
                <div className="aspect-[16/10] relative overflow-hidden bg-marketplace-bg">
                  <img 
                    src={item.image_url || '/uploads/marketplace/default.png'} 
                    alt={item.title} 
                    className={clsx(
                      "w-full h-full object-cover transition-transform duration-700 group-hover:scale-110",
                      item.status === 'sold' && "grayscale opacity-60"
                    )}
                  />
                  {item.status === 'sold' && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
                      <div className="bg-white px-6 py-2 rounded-full font-black text-xs uppercase tracking-[0.2em]">Sold</div>
                    </div>
                  )}
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button className="w-10 h-10 bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-lg text-marketplace-text hover:bg-white transition-colors">
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <h3 className="font-black text-lg line-clamp-1 flex-1 leading-tight">{item.title}</h3>
                    <div className="text-lg font-black text-[#1877F2]">KES {parseFloat(item.price as string).toLocaleString()}</div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-bold text-marketplace-muted uppercase tracking-widest mb-6">
                    <span className="flex items-center gap-1.5"><Clock size={12} /> {new Date(item.created_at || Date.now()).toLocaleDateString()}</span>
                    <span className={clsx(
                      "flex items-center gap-1.5",
                      item.status === 'sold' ? "text-emerald-500" : "text-blue-500"
                    )}>
                      <CheckCircle2 size={12} /> {item.status || 'Active'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => navigate(`/marketplace/listings/${item.listing_id}`)}
                      className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-marketplace-bg text-marketplace-text font-black text-sm hover:bg-slate-200 transition-all"
                    >
                      <ExternalLink size={16} /> View
                    </button>
                    {item.status !== 'sold' ? (
                      <button 
                        onClick={() => handleMarkSold(item.listing_id)}
                        className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-emerald-50 text-emerald-600 font-black text-sm hover:bg-emerald-100 transition-all border border-emerald-100"
                      >
                        <CheckCircle2 size={16} /> Mark Sold
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleDelete(item.listing_id)}
                        className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-red-50 text-red-500 font-black text-sm hover:bg-red-100 transition-all border border-red-100"
                      >
                        <Trash2 size={16} /> Delete
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
