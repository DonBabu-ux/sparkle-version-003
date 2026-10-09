import { showError } from '../utils/toast';
import ErrorRetry from '../components/ui/ErrorRetry';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Heart, ShoppingBag } from 'lucide-react';
import api from '../api/api';
import type { Listing } from '../types/listing';
import { AnimatePresence } from 'framer-motion';
import ListingCard from '../components/marketplace/ListingCard';
import Spinner from '../components/ui/Spinner';
import { logger } from '../utils/logger';

export default function Wishlist() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchWishlist = async () => {
    setError(false);
    try {
      const response = await api.get('/marketplace/wishlist');
      if (response.data.success) {
        setItems(response.data.listings || []);
      }
    } catch (err) {
      logger.error('Failed to fetch wishlist:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, []);

  const removeItem = async (id: string) => {
    try {
      await api.post(`/marketplace/listings/${id}/wishlist`);
      setItems(prev => prev.filter(item => item.listing_id !== id));
    } catch (err) {
      logger.error('Failed to remove item:', err);
      showError('Failed to remove item.');
    }
  };

  return (
    <div className="min-h-dvh bg-white text-marketplace-text font-sans pb-20">
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
            <Spinner size="large" color="text-primary" />
            <p className="text-marketplace-muted font-bold animate-pulse">Opening vault...</p>
          </div>
        ) : error ? (
          <ErrorRetry onRetry={fetchWishlist} />
        ) : items.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            <AnimatePresence>
              {items.map(item => (
                <ListingCard
                  key={item.listing_id}
                  variant="saved"
                  listing={item}
                  onClick={() => navigate(`/marketplace/listings/${item.listing_id}`)}
                  onRemove={() => removeItem(item.listing_id)}
                />
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

