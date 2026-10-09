import { motion } from 'framer-motion';
import clsx from 'clsx';
import {
  MapPin,
  Clock,
  CheckCircle2,
  ExternalLink,
  Trash2,
  ChevronRight,
} from 'lucide-react';
import MarketplaceImageSlider from './MarketplaceImageSlider';

/**
 * Shared marketplace listing card.
 *
 * Each `variant` preserves the exact markup/classes that previously lived
 * inline in its call site:
 *  - 'grid'    → Marketplace home/category grid (src/pages/Marketplace.tsx)
 *  - 'shop'    → Seller profile shop grid (src/pages/SellerProfile.tsx)
 *  - 'manage'  → My listings management card (src/pages/MyListings.tsx)
 *  - 'saved'   → Wishlist saved card (src/pages/Wishlist.tsx)
 *  - 'compact' → Search results marketplace row (src/pages/Search.tsx)
 */
export type ListingCardVariant = 'grid' | 'shop' | 'manage' | 'saved' | 'compact';

interface ListingCardMedia {
  media_url?: string;
  url?: string;
  media_type?: string;
}

/** Structural shape of a listing across all call sites (all fields optional except identity-free). */
export interface ListingCardData {
  listing_id?: string;
  id?: string;
  title?: string;
  price?: number | string;
  /** Search results render the price as a preformatted string. */
  subtitle?: string;
  image_url?: string;
  image?: string;
  condition?: string;
  campus?: string;
  location_name?: string;
  distance_km?: number | null;
  created_at?: string;
  status?: string;
  media?: (ListingCardMedia | string)[];
  image_urls?: string[];
}

interface ListingCardProps {
  variant: ListingCardVariant;
  listing: ListingCardData;
  /** Navigates to the listing detail (grid/shop/compact) or its "View" button (manage) / body (saved). */
  onClick?: () => void;
  /** saved: trash button. */
  onRemove?: () => void;
  /** manage: "Mark Sold" button. */
  onMarkSold?: () => void;
  /** manage: "Delete" button (shown when sold). */
  onDelete?: () => void;
  /** grid: renders the vehicle-style stacked price/title block. */
  isVehicle?: boolean;
}

export default function ListingCard({
  variant,
  listing,
  onClick,
  onRemove,
  onMarkSold,
  onDelete,
  isVehicle,
}: ListingCardProps) {
  switch (variant) {
    case 'grid':
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white cursor-pointer flex flex-col pb-4"
          onClick={onClick}
        >
          <MarketplaceImageSlider
            media={listing.media}
            imageUrls={listing.image_urls}
            fallbackUrl={listing.image_url}
            alt={listing.title}
            aspectRatio="aspect-[4/5]"
          />
          <div className="px-2 pt-2 flex flex-col">
            {isVehicle ? (
              <>
                <p className="text-[15px] font-bold text-marketplace-text leading-tight">KES{parseFloat(listing.price as string).toLocaleString()}</p>
                <p className="text-[13px] text-marketplace-text line-clamp-1 mt-0.5">{listing.title}</p>
                <p className="text-[12px] text-marketplace-muted mt-1">{listing.condition || 'Used'}</p>
                <p className="text-[12px] text-marketplace-muted">{listing.location_name || listing.campus || 'Sparkle Network'}</p>
              </>
            ) : (
              <p className="text-[15px] text-marketplace-text leading-tight line-clamp-1">
                <span className="font-semibold">KES{parseFloat(listing.price as string).toLocaleString()}</span> <span className="mx-0.5">·</span> {listing.title}
              </p>
            )}
            {listing.distance_km !== undefined && listing.distance_km !== null && (
              <p className="text-[12px] text-marketplace-muted mt-1 flex items-center gap-1">
                <MapPin size={10} /> {listing.distance_km < 1 ? 'Less than 1 km' : `${listing.distance_km.toFixed(1)} km`} away
              </p>
            )}
          </div>
        </motion.div>
      );
    case 'manage':
      return (
        <motion.div
          layout
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[32px] overflow-hidden border border-marketplace-border shadow-sm group hover:shadow-xl transition-all duration-300"
        >
          <div className="relative overflow-hidden">
            <MarketplaceImageSlider
              media={listing.media}
              imageUrls={listing.image_urls}
              fallbackUrl={listing.image_url}
              alt={listing.title}
              aspectRatio="aspect-[16/10]"
              className={listing.status === 'sold' ? 'grayscale opacity-60' : ''}
            />
            {listing.status === 'sold' && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
                <div className="bg-white px-6 py-2 rounded-full font-black text-xs uppercase tracking-[0.2em]">Sold</div>
              </div>
            )}
          </div>

          <div className="p-6">
            <div className="flex justify-between items-start gap-4 mb-3">
              <h3 className="font-black text-lg line-clamp-1 flex-1 leading-tight">{listing.title}</h3>
              <div className="text-lg font-black text-[#1877F2]">KES {parseFloat(listing.price as string).toLocaleString()}</div>
            </div>

            <div className="flex items-center gap-4 text-xs font-bold text-marketplace-muted uppercase tracking-widest mb-6">
              <span className="flex items-center gap-1.5"><Clock size={12} /> {new Date(listing.created_at || Date.now()).toLocaleDateString()}</span>
              <span className={clsx(
                "flex items-center gap-1.5",
                listing.status === 'sold' ? "text-emerald-500" : "text-blue-500"
              )}>
                <CheckCircle2 size={12} /> {listing.status || 'Active'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onClick}
                className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-marketplace-bg text-marketplace-text font-black text-sm hover:bg-slate-200 transition-all"
              >
                <ExternalLink size={16} /> View
              </button>
              {listing.status !== 'sold' ? (
                <button
                  onClick={onMarkSold}
                  className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-emerald-50 text-emerald-600 font-black text-sm hover:bg-emerald-100 transition-all border border-emerald-100"
                >
                  <CheckCircle2 size={16} /> Mark Sold
                </button>
              ) : (
                <button
                  onClick={onDelete}
                  className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-red-50 text-red-500 font-black text-sm hover:bg-red-100 transition-all border border-red-100"
                >
                  <Trash2 size={16} /> Delete
                </button>
              )}
            </div>
          </div>
        </motion.div>
      );
    case 'shop':
      return (
        <div onClick={onClick} className="group cursor-pointer">
          <div className="aspect-square rounded-3xl overflow-hidden bg-marketplace-bg border border-marketplace-border relative mb-3">
            <MarketplaceImageSlider
              media={listing.media}
              imageUrls={listing.image_urls}
              fallbackUrl={listing.image_url}
              alt={listing.title}
              aspectRatio="aspect-square"
            />
            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 shadow-sm pointer-events-none z-10">
              <span className="text-[12px] font-black">KES {parseFloat(listing.price as string).toLocaleString()}</span>
            </div>
          </div>
          <h4 className="font-bold text-[15px] line-clamp-1 mb-1">{listing.title}</h4>
          <div className="flex items-center gap-1.5 text-marketplace-muted text-[11px] font-bold uppercase tracking-wider">
            <MapPin size={10} />
            {listing.campus || 'Main Campus'}
          </div>
        </div>
      );
    case 'saved':
      return (
        <motion.div
          layout
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="group relative"
        >
          <div className="aspect-square rounded-[32px] overflow-hidden bg-marketplace-bg border border-marketplace-border relative mb-3 cursor-pointer" onClick={onClick}>
            <MarketplaceImageSlider
              media={listing.media}
              imageUrls={listing.image_urls}
              fallbackUrl={listing.image_url}
              alt={listing.title}
              aspectRatio="aspect-square"
            />
            <button
              onClick={onRemove}
              className="absolute top-3 right-3 w-10 h-10 bg-white/90 backdrop-blur-md rounded-2xl flex items-center justify-center text-rose-500 shadow-lg hover:bg-rose-500 hover:text-white transition-all transform hover:scale-110"
            >
              <Trash2 size={18} />
            </button>
            <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 shadow-sm">
              <span className="text-[12px] font-black">KES {parseFloat(listing.price as string).toLocaleString()}</span>
            </div>
          </div>

          <div className="px-1" onClick={onClick}>
            <h3 className="font-bold text-[15px] text-marketplace-text truncate mb-1 cursor-pointer hover:text-blue-600 transition-colors">{listing.title}</h3>
            <div className="flex items-center gap-1.5 text-marketplace-muted text-[11px] font-bold uppercase tracking-wider">
              <MapPin size={10} />
              {listing.campus || 'Main Campus'}
            </div>
          </div>
        </motion.div>
      );
    case 'compact':
      return (
        <div
          onClick={onClick}
          className="flex items-center gap-4 p-5 bg-white dark:bg-[#101217] border border-black/5 dark:border-white/10 hover:border-primary/20 rounded-2xl transition-all cursor-pointer group active:scale-[0.98] duration-300 shadow-sm"
        >
          <img src={listing.image || '/uploads/avatars/default.png'} className="w-16 h-16 rounded-xl object-cover border border-gray-100 group-hover:scale-105 transition-all shrink-0" alt="" />
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold text-gray-900 leading-none mb-2 italic uppercase tracking-tight truncate">{listing.title}</div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-black text-primary tracking-tighter">KSh {listing.subtitle}</span>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Market</span>
            </div>
          </div>
          <ChevronRight size={18} className="text-gray-300 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
        </div>
      );
  }
}
