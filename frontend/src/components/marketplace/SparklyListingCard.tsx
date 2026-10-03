import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, MessageSquare, Heart, MapPin, ExternalLink, Check } from 'lucide-react';
import api from '../../api/api';
import { getMediaUrl } from '../../utils/imageUtils';

export interface SparklyListingItem {
  listing_id: string;
  title: string;
  price: number;
  image_url?: string;
  campus?: string;
  location?: string;
  condition?: string;
  seller_name?: string;
}

interface SparklyListingCardProps {
  listing: SparklyListingItem;
}

export const SparklyListingCard: React.FC<SparklyListingCardProps> = ({ listing }) => {
  const navigate = useNavigate();
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleToggleWishlist = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSaving) return;
    setIsSaving(true);
    try {
      await api.post(`/marketplace/listings/${listing.listing_id}/wishlist`);
      setIsSaved(!isSaved);
    } catch (err) {
      console.error('Failed to toggle wishlist:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const formattedPrice = new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    maximumFractionDigits: 0
  }).format(listing.price || 0);

  return (
    <div 
      onClick={() => navigate(`/marketplace/listings/${listing.listing_id}`)}
      className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden hover:border-purple-500/50 hover:shadow-xl transition-all duration-300 cursor-pointer group flex flex-col sm:flex-row my-2 max-w-lg"
    >
      <div className="sm:w-36 h-36 relative bg-slate-950 flex-shrink-0 overflow-hidden">
        {listing.image_url ? (
          <img 
            src={getMediaUrl(listing.image_url)} 
            alt={listing.title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-600">
            <ShoppingBag size={32} />
          </div>
        )}
        <button
          onClick={handleToggleWishlist}
          className={`absolute top-2 right-2 p-2 rounded-full backdrop-blur-md transition-all ${
            isSaved ? 'bg-rose-500 text-white' : 'bg-black/40 text-slate-300 hover:text-rose-400'
          }`}
        >
          <Heart size={14} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-800/40">
              {listing.condition || 'Verified'}
            </span>
            {listing.campus && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-bold">
                <MapPin size={10} className="text-purple-400" />
                {listing.campus}
              </span>
            )}
          </div>

          <h4 className="font-bold text-slate-100 text-sm line-clamp-1 group-hover:text-purple-300 transition-colors">
            {listing.title}
          </h4>

          <p className="text-purple-400 font-extrabold text-base mt-0.5">
            {formattedPrice}
          </p>
        </div>

        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-800/80">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/marketplace/listings/${listing.listing_id}`);
            }}
            className="flex-1 py-1.5 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95"
          >
            <span>View Item</span>
            <ExternalLink size={12} />
          </button>

          <button
            onClick={async (e) => {
              e.stopPropagation();
              try {
                const res = await api.post(`/marketplace/listings/${listing.listing_id}/contact`);
                if (res.data.redirect) {
                  navigate(res.data.redirect);
                }
              } catch (_) {
                navigate(`/marketplace/listings/${listing.listing_id}`);
              }
            }}
            className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <MessageSquare size={12} />
            <span className="hidden sm:inline">Message</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SparklyListingCard;
