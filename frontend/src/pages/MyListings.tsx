import { showError } from '../utils/toast';
import { confirmDialog } from '../store/dialogStore';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, ChevronLeft } from 'lucide-react';
import api from '../api/api';
import type { Listing } from '../types/listing';
import ListingCard from '../components/marketplace/ListingCard';
import Spinner from '../components/ui/Spinner';
import { logger } from '../utils/logger';
import ErrorRetry from '../components/ui/ErrorRetry';

export default function MyListings() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchMyListings = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await api.get('/marketplace/my-listings');
      setListings(response.data.listings || []);
    } catch (err) {
      logger.error('Failed to fetch listings:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyListings();
  }, [fetchMyListings]);

  const handleDelete = async (id: string) => {
    if (!await confirmDialog('Are you sure you want to remove this listing?')) return;
    try {
      await api.delete(`/marketplace/listings/${id}`);
      await fetchMyListings();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to remove listing');
    }
  };

  const handleMarkSold = async (id: string) => {
    try {
      await api.put(`/marketplace/listings/${id}/sold`);
      await fetchMyListings();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to mark listing as sold');
    }
  };

  const handleRelist = async (id: string) => {
    try {
      await api.post(`/marketplace/listings/${id}/relist`);
      await fetchMyListings();
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to relist item');
    }
  };

  return (
    <div className="min-h-dvh bg-[#fdf2f4] dark:bg-[#1b1b24] text-marketplace-text font-sans pb-[env(safe-area-inset-bottom)]">
      {/* Sticky Header */}
      <header className="sticky top-0 z-[1100] bg-white/90 backdrop-blur-md border-b border-marketplace-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/marketplace')} className="w-11 h-11 flex items-center justify-center text-marketplace-text hover:bg-marketplace-bg rounded-full transition-colors">
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          <h1 className="text-[19px] font-black tracking-tight">Your Listings</h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Spinner size="large" color="text-primary" />
            <p className="text-marketplace-muted font-bold animate-pulse">Loading your shop...</p>
          </div>
        ) : error ? (
          <ErrorRetry onRetry={fetchMyListings} />
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 bg-marketplace-bg rounded-[40px] border-2 border-dashed border-marketplace-border text-center">
            <Package size={64} className="text-marketplace-muted/30 mb-6" />
            <h3 className="text-2xl font-black mb-2">No listings yet</h3>
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
              <ListingCard
                key={item.listing_id}
                variant="manage"
                listing={item}
                onClick={() => navigate(`/marketplace/listings/${item.listing_id}`)}
                onEdit={() => navigate(`/marketplace/sell?edit=${item.listing_id}`)}
                onMarkSold={() => handleMarkSold(item.listing_id)}
                onRelist={() => handleRelist(item.listing_id)}
                onDelete={() => handleDelete(item.listing_id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}



