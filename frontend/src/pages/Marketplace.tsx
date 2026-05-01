import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useParams, useLocation } from 'react-router-dom';
import { Search, ShoppingBag, Plus, MapPin, Grid, MessageCircle, SlidersHorizontal, ChevronDown, ListFilter, Sparkles, ArrowLeft, X } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';
import { useModalStore } from '../store/modalStore';
import { useUserStore } from '../store/userStore';
import { useMarketplaceStore } from '../store/marketplaceStore';
import MarketplaceModals from '../components/modals/MarketplaceModals';
import { useLocationDetection } from '../hooks/useLocationDetection';
import { motion, AnimatePresence } from 'framer-motion';
import { getAvatarUrl } from '../utils/imageUtils';
import clsx from 'clsx';

interface Listing {
  listing_id: string;
  title: string;
  description: string;
  price: number | string;
  image_url?: string;
  condition?: string;
  seller_name?: string;
  seller_avatar?: string;
  campus?: string;
  location_name?: string;
  distance_km?: number;
  created_at?: string;
  media?: any[];
}

export default function Marketplace() {
  const navigate = useNavigate();
  const location = useLocation();
  const { categoryId } = useParams();
  const { user } = useUserStore();
  const { refreshCounter } = useModalStore();
  const { detectLocation } = useLocationDetection();
  
  // Detect location once on mount
  useEffect(() => {
    detectLocation();
  }, [detectLocation]);

  // Zustand Store for Marketplace State
  const searchQuery = useMarketplaceStore(state => state.searchQuery);
  const storeCategory = useMarketplaceStore(state => state.category);
  const filterLocation = useMarketplaceStore(state => state.location);
  const radiusKm = useMarketplaceStore(state => state.radiusKm);
  const minPrice = useMarketplaceStore(state => state.minPrice);
  const maxPrice = useMarketplaceStore(state => state.maxPrice);
  const sortBy = useMarketplaceStore(state => state.sortBy);
  const setFilters = useMarketplaceStore(state => state.setFilters);
  const setActiveModal = useMarketplaceStore(state => state.setActiveModal);
  
  const setSearchQuery = (q: string) => setFilters({ searchQuery: q });

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync route param with store category
  useEffect(() => {
    if (categoryId) {
      setFilters({ category: categoryId });
    } else if (location.pathname === '/marketplace') {
      setFilters({ category: 'all' });
    }
  }, [categoryId, location.pathname, setFilters]);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const currentCategory = categoryId || 'all';
      const params = new URLSearchParams({
        category: currentCategory !== 'all' ? currentCategory : '',
        search: searchQuery,
        lat: filterLocation.lat.toString(),
        lng: filterLocation.lng.toString(),
        radius: radiusKm.toString(),
        sort: sortBy
      });
      
      if (minPrice) params.append('minPrice', minPrice.toString());
      if (maxPrice) params.append('maxPrice', maxPrice.toString());
      
      const response = await api.get(`/marketplace/listings?${params.toString()}`);
      const resData = response.data;
      const list = resData.listings || resData.data || (Array.isArray(resData) ? resData : []);
      
      setListings(list);
    } catch (err) {
      console.error('Failed to fetch marketplace:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, categoryId, filterLocation, radiusKm, sortBy, minPrice, maxPrice]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings, refreshCounter]);

  const isCategoryView = !!categoryId;
  const isInboxView = location.pathname === '/marketplace/inbox';

  return (
    <div className="flex bg-white min-h-screen text-slate-900 font-sans pb-24">
      <Navbar />

      <div className="flex-1 lg:ml-72 w-full max-w-screen-md mx-auto shadow-sm min-h-screen bg-white">
        
        {/* 1. FB Style Header */}
        <header className="sticky top-0 z-40 bg-white border-b border-slate-200 flex flex-col shadow-sm">
          {/* Top Row */}
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate(-1)} className="p-1 text-slate-900">
                <ArrowLeft size={26} strokeWidth={2.5} />
              </button>
              <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Marketplace</h1>
            </div>
            <button className="p-1 text-slate-900">
              <Search size={24} strokeWidth={2.5} />
            </button>
          </div>

          {/* Action Pills Row (only on main home) */}
          {!isCategoryView && !isInboxView && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-3 pb-3">
              <Link to="/marketplace/profile" className="flex items-center justify-center bg-slate-100 hover:bg-slate-200 transition-colors h-9 px-4 rounded-full font-bold text-sm text-slate-900 flex-shrink-0">
                <img src={getAvatarUrl(user?.avatar_url, user?.username)} alt="Profile" className="w-5 h-5 rounded-full mr-2" />
                Profile
              </Link>
              <Link to="/marketplace/inbox" className="flex items-center justify-center bg-slate-100 hover:bg-slate-200 transition-colors h-9 px-4 rounded-full font-bold text-[15px] text-slate-900 whitespace-nowrap flex-shrink-0">
                Inbox
              </Link>
              <Link to="/marketplace/sell" className="flex items-center justify-center bg-slate-100 hover:bg-slate-200 transition-colors h-9 px-4 rounded-full font-bold text-[15px] text-slate-900 whitespace-nowrap flex-shrink-0">
                Sell
              </Link>
              <button 
                onClick={() => setActiveModal('categories')}
                className="flex items-center justify-center bg-slate-100 hover:bg-slate-200 transition-colors h-9 px-4 rounded-full font-bold text-[15px] text-slate-900 whitespace-nowrap flex-shrink-0"
              >
                Categories
              </button>
              <button className="flex items-center justify-center bg-slate-100 hover:bg-slate-200 transition-colors h-9 px-4 rounded-full font-bold text-[15px] text-slate-900 whitespace-nowrap flex-shrink-0">
                Search
              </button>
            </div>
          )}

          {/* Category Sub-header (Image 4 Style) */}
          {isCategoryView && (
            <div className="flex flex-col gap-3 px-3 pb-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-500">
                  <Search size={18} />
                </div>
                <input 
                  type="text" 
                  value={categoryId}
                  readOnly
                  className="w-full bg-slate-100 rounded-full py-2 pl-10 pr-3 text-[15px] font-medium capitalize outline-none"
                />
              </div>
              
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <button className="flex items-center justify-center w-8 h-8 rounded border border-slate-300 text-[#1877F2] flex-shrink-0 bg-white">
                  <Grid size={14} />
                </button>
                <button 
                  onClick={() => setActiveModal('location')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-[13px] font-bold text-[#1877F2] whitespace-nowrap flex-shrink-0"
                >
                  <span className="flex flex-col items-start leading-none">
                    <span className="text-[10px] text-slate-400 font-normal">
                      {filterLocation.source === 'gps' ? 'Using current location' : 
                       filterLocation.source === 'ip' ? 'Using estimated location' : 
                       filterLocation.source === 'manual' ? 'Using selected location' : 'Location'}
                    </span>
                    <span>{filterLocation.name.split(',')[0]} <ChevronDown size={14} className="inline ml-1" /></span>
                  </span>
                </button>
                <button 
                  onClick={() => setActiveModal('distance')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-[13px] font-bold text-[#1877F2] whitespace-nowrap flex-shrink-0"
                >
                  {radiusKm} km <ChevronDown size={14} />
                </button>
                <button 
                  onClick={() => setActiveModal('filters')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-[13px] font-bold text-slate-700 whitespace-nowrap flex-shrink-0"
                >
                  <SlidersHorizontal size={14} /> Filters
                </button>
                <button 
                  onClick={() => setActiveModal('sort')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded text-[13px] font-bold text-slate-700 whitespace-nowrap flex-shrink-0"
                >
                  <ListFilter size={14} /> Sort
                </button>
              </div>
            </div>
          )}
        </header>

        <main className="flex flex-col">
          {/* View Controller */}
          {isInboxView ? (
             <MarketplaceInbox />
          ) : (
            <>
              {/* Home Sub-header (Today's Picks) */}
              {!isCategoryView && (
                <div className="flex items-center justify-between px-3 py-4">
                  <h2 className="text-[17px] font-bold text-slate-900">Today's picks</h2>
                  <button 
                    onClick={() => setActiveModal('location')}
                    className="flex items-center gap-1.5 text-[#1877F2] font-semibold text-[15px]"
                  >
                    <MapPin size={16} className="fill-[#1877F2] text-white" />
                    <div className="flex flex-col items-start leading-none">
                      <span className="text-[10px] text-slate-400 font-normal">
                         {filterLocation.source === 'gps' ? 'Using current location' : 
                          filterLocation.source === 'ip' ? 'Using estimated location' : 
                          filterLocation.source === 'manual' ? 'Using selected location' : 'Location'}
                      </span>
                      <span>{filterLocation.name.split(',')[0]} · {radiusKm} km</span>
                    </div>
                  </button>
                </div>
              )}

              {/* Listings Grid */}
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-[2px]">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="aspect-square bg-slate-100 animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-[2px]">
                  {listings.length > 0 ? (
                    listings.map((item) => (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        key={item.listing_id} 
                        className="bg-white cursor-pointer flex flex-col pb-4" 
                        onClick={() => navigate(`/marketplace/listings/${item.listing_id}`)}
                      >
                        <div className="aspect-[4/5] relative bg-slate-100 overflow-hidden">
                          <img 
                            src={item.image_url || (item.media && item.media.length > 0 ? item.media[0].media_url : '/uploads/defaults/no-image.png')} 
                            alt={item.title} 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="px-2 pt-2 flex flex-col">
                          {categoryId === 'vehicles' ? (
                            <>
                              <p className="text-[15px] font-bold text-slate-900 leading-tight">KES{parseFloat(item.price as string).toLocaleString()}</p>
                              <p className="text-[13px] text-slate-800 line-clamp-1 mt-0.5">{item.title}</p>
                              <p className="text-[12px] text-slate-500 mt-1">{item.condition || 'Used'}</p>
                              <p className="text-[12px] text-slate-500">{item.location_name || item.campus}</p>
                            </>
                          ) : (
                            <p className="text-[15px] text-slate-900 leading-tight line-clamp-1">
                              <span className="font-semibold">KES{parseFloat(item.price as string).toLocaleString()}</span> <span className="mx-0.5">·</span> {item.title}
                            </p>
                          )}
                          {item.distance_km !== undefined && item.distance_km !== null && (
                            <p className="text-[12px] text-slate-500 mt-1 flex items-center gap-1">
                              <MapPin size={10} /> {item.distance_km < 1 ? 'Less than 1 km' : `${item.distance_km.toFixed(1)} km`} away
                            </p>
                          )}
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="col-span-full py-20 flex flex-col items-center text-center">
                      <div className="bg-slate-100 p-5 rounded-full mb-4">
                        <ShoppingBag size={32} className="text-slate-400" />
                      </div>
                      <h3 className="text-lg font-bold">No results found</h3>
                      <p className="text-slate-500 text-sm mt-1">Try expanding your radius or changing filters.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
      <MarketplaceModals />
    </div>
  );
}

function MarketplaceInbox() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top Level Tabs */}
      <div className="flex border-b border-slate-100 sticky top-0 z-10 bg-white px-2 pt-2">
        <button className="flex-1 py-3 font-bold text-[#1877F2] border-b-2 border-[#1877F2]">Selling</button>
        <button className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50">Buying</button>
      </div>

      {/* Horizontal Sub-filters */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-3 px-3 bg-slate-50/50 border-b border-slate-100">
        {['All', 'Pending', 'Payment', 'Paid', 'Completed'].map((filter, i) => (
          <button 
            key={filter}
            className={clsx(
              "px-4 py-1.5 rounded-full text-sm font-bold whitespace-nowrap shadow-sm border transition-colors",
              i === 0 
                ? "bg-slate-800 text-white border-slate-800" 
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Chat List Placeholder */}
      <div className="flex-1 flex flex-col items-center justify-center text-center py-20 px-6">
        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
          <MessageCircle size={32} className="text-slate-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">No Messages Yet</h3>
        <p className="text-sm text-slate-500 max-w-xs mx-auto">
          Your marketplace conversations will appear here.
        </p>
      </div>
    </div>
  );
}
