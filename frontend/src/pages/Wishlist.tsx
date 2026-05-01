import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Heart, Trash2, ShoppingBag, ExternalLink, MapPin } from 'lucide-react';
import api from '../api/api';
import type { Listing } from '../types/listing';
import { motion, AnimatePresence } from 'framer-motion';

export default function Wishlist() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWishlist = async () => {
      try {
        const response = await api.get('/marketplace/wishlist');
        if (response.data.success) {
          setItems(response.data.listings || []);
        }
      } catch (err) {
        console.error('Failed to fetch wishlist:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchWishlist();
  }, []);

  const removeItem = async (id: string) => {
    try {
      await api.post(`/marketplace/listings/${id}/wishlist`);
      setItems(prev => prev.filter(item => item.listing_id !== id));
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  };

  return (
    <div className="min-h-screen bg-white text-marketplace-text font-sans pb-20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-marketplace-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-marketplace-text hover:bg-marketplace-bg rounded-full transition-colors">
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          <h1 className="text-[19px] font-black tracking-tight">Saved Items</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-8">
        <div className="flex flex-col gap-2 mb-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-marketplace-bg rounded-2xl flex items-center justify-center text-rose-500 shadow-sm">
              <Heart size={24} fill="currentColor" />
            </div>
            <h2 className="text-3xl font-black tracking-tight">Your Wishlist</h2>
          </div>
          <p className="text-marketplace-muted font-bold text-sm">You have {items.length} items saved for later</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-marketplace-bg border-t-marketplace-text rounded-full animate-spin" />
            <p className="text-marketplace-muted font-bold animate-pulse">Opening vault...</p>
          </div>
        ) : items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            <AnimatePresence>
              {items.map(item => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  key={item.listing_id} 
                  className="group relative"
                >
                  <div className="aspect-square rounded-[32px] overflow-hidden bg-marketplace-bg border border-marketplace-border relative mb-3">
                    <img 
                      src={item.image_url || '/uploads/marketplace/default.png'} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                      alt="" 
                    />
                    <button 
                      onClick={() => removeItem(item.listing_id)}
                      className="absolute top-3 right-3 w-10 h-10 bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-center text-rose-500 shadow-lg hover:bg-rose-500 hover:text-white transition-all transform hover:scale-110"
                    >
                      <Trash2 size={18} />
                    </button>
                    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 shadow-sm">
                      <span className="text-[12px] font-black">KES {parseFloat(item.price as string).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="px-1" onClick={() => navigate(`/marketplace/listings/${item.listing_id}`)}>
                    <h3 className="font-bold text-[15px] text-marketplace-text truncate mb-1 cursor-pointer hover:text-blue-600 transition-colors">{item.title}</h3>
                    <div className="flex items-center gap-1.5 text-marketplace-muted text-[11px] font-bold uppercase tracking-wider">
                      <MapPin size={10} />
                      {item.campus || 'Main Campus'}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-6 bg-marketplace-bg rounded-[40px] border-2 border-dashed border-marketplace-border text-center">
            <ShoppingBag size={64} className="text-marketplace-muted/30 mb-6" />
            <h3 className="text-2xl font-black mb-2">Wishlist is empty</h3>
            <p className="text-marketplace-muted font-medium mb-8">Save items while browsing to see them here.</p>
            <button 
              onClick={() => navigate('/marketplace')} 
              className="px-10 py-4 bg-marketplace-text text-white rounded-2xl font-black hover:scale-105 transition-transform active:scale-95 shadow-xl shadow-slate-200"
            >
              Start Exploring
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

