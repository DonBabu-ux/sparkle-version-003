import ErrorRetry from '../components/ui/ErrorRetry';
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link, useParams, useLocation } from 'react-router-dom';
import { Search, ShoppingBag, Plus, MapPin, Grid, MessageCircle, SlidersHorizontal, ChevronDown, ListFilter, Sparkles, ChevronLeft, X } from 'lucide-react';
import api from '../api/api';
import MarketplaceModals from '../components/modals/MarketplaceModals';
import MarketplaceInbox from '../components/marketplace/MarketplaceInbox';
import SparklyMiniChat from '../components/marketplace/SparklyMiniChat';
import { useModalStore } from '../store/modalStore';
import { useUserStore } from '../store/userStore';
import { useMarketplaceStore } from '../store/marketplaceStore';
import { useLocationDetection } from '../hooks/useLocationDetection';
import { motion, AnimatePresence } from 'framer-motion';
import { getAvatarUrl } from '../utils/imageUtils';
import clsx from 'clsx';
import { useDebounce } from '../hooks/useDebounce'; // Assuming this exists or I will create it

<<<<<<< HEAD
import ListingCard from '../components/marketplace/ListingCard';
import { logger } from '../utils/logger';
=======
import MarketplaceImageSlider from '../components/marketplace/MarketplaceImageSlider';
>>>>>>> 2c63d82

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
  image_urls?: string[];
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
  const reportedListings = useMarketplaceStore(state => state.reportedListings);
  
  const setSearchQuery = (q: string) => setFilters({ searchQuery: q });

  const [listings, setListings] = useState<Listing[]>([]);
  const filteredListings = listings.filter(item => !reportedListings.includes(item.listing_id));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Sync route param with store category
  useEffect(() => {
    if (categoryId) {
      setFilters({ category: categoryId });
    } else if (location.pathname === '/marketplace') {
      setFilters({ category: 'all' });
    }
  }, [categoryId, location.pathname, setFilters]);

  const [isSearching, setIsSearching] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const debouncedSearch = useDebounce(localSearch, 500);
  const [sparklyOpen, setSparklyOpen] = useState(false);
  const [sparklyInitialMsg, setSparklyInitialMsg] = useState<string | undefined>();

  useEffect(() => {
    setFilters({ searchQuery: debouncedSearch });
  }, [debouncedSearch, setFilters]);

  const [isFallback, setIsFallback] = useState(false);

  const fetchListings = useCallback(async (isRetry = false) => {
    if (!isRetry) setLoading(true);
    setError(false);
    try {
      const currentCategory = categoryId || 'all';
      const params = new URLSearchParams({
        category: currentCategory !== 'all' ? currentCategory : '',
        search: searchQuery,
        sort: sortBy
      });

      // Apply location filters only if not in "Global Fallback" mode
      if (!isFallback) {
        params.append('lat', filterLocation.lat.toString());
        params.append('lng', filterLocation.lng.toString());
        params.append('radius', (isRetry ? '1000' : radiusKm.toString()));
      }
      
      if (minPrice) params.append('minPrice', minPrice.toString());
      if (maxPrice) params.append('maxPrice', maxPrice.toString());
      
      const response = await api.get(`/marketplace/listings?${params.toString()}`);
      const resData = response.data;
      const list = resData.listings || resData.data || (Array.isArray(resData) ? resData : []);
      
      // Genius Fallback Logic:
      // 1. If local (short radius) is empty, try expanding to 1000km
      if (list.length === 0 && !isRetry && !isFallback && !searchQuery) {
        console.log('No local results, expanding radius...');
        fetchListings(true); 
        return;
      }

      // 2. If still empty after expansion, go Global
      if (list.length === 0 && (isRetry || isFallback) && !searchQuery) {
        console.log('No results in expanded radius, showing global feed...');
        setIsFallback(true);
        const globalRes = await api.get(`/marketplace/listings?category=${currentCategory !== 'all' ? currentCategory : ''}&sort=${sortBy}`);
        setListings(globalRes.data.listings || []);
        return;
      }

      setListings(list);
      // Only reset fallback if we actually found items with the original filters
      if (!isRetry && list.length > 0) setIsFallback(false);
    } catch (err) {
<<<<<<< HEAD
      logger.error('Failed to fetch marketplace:', err);
      setError(true);
=======
      console.error('Failed to fetch marketplace:', err);
>>>>>>> 2c63d82
    } finally {
      if (!isRetry) setLoading(false);
    }
  }, [searchQuery, categoryId, filterLocation, radiusKm, sortBy, minPrice, maxPrice]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings, refreshCounter]);

  const isCategoryView = !!categoryId;
  const isInboxView = location.pathname === '/marketplace/inbox';

  return (
    <div className={clsx(
        "flex bg-white min-h-dvh text-marketplace-text font-sans",
        !isInboxView && "pb-[calc(6rem+env(safe-area-inset-bottom))]"
    )}>

<<<<<<< HEAD
      <div className="flex-1 w-full max-w-screen-md mx-auto shadow-sm min-h-dvh bg-white">
=======
      <div className="flex-1 lg:ml-72 w-full max-w-screen-md mx-auto shadow-sm min-h-screen bg-white">
>>>>>>> 2c63d82
        
        {/* 1. FB Style Header */}
        <header className="sticky top-0 z-40 bg-white/40 backdrop-blur-3xl flex flex-col transition-all">
          {/* Top Row */}
          <div className="flex items-center justify-between px-3 pt-[env(safe-area-inset-top)] pb-2.5 min-h-[60px]">
            <AnimatePresence mode="wait">
              {!isSearching ? (
                <motion.div 
                  key="title"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center gap-3 flex-1"
                >
                  <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-marketplace-text hover:bg-marketplace-bg rounded-full transition-colors">
                    <ChevronLeft size={26} strokeWidth={2.5} />
                  </button>
                  <h1 className="text-[20px] font-bold text-marketplace-text tracking-tight">
                    {isInboxView ? 'Inbox' : isCategoryView ? categoryId : 'Marketplace'}
                  </h1>
                </motion.div>
              ) : (
                <motion.div 
                  key="search"
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: '100%' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="flex items-center gap-2 flex-1"
                >
                  <button onClick={() => { setIsSearching(false); setLocalSearch(''); }} className="w-10 h-10 flex items-center justify-center text-marketplace-text hover:bg-marketplace-bg rounded-full transition-colors">
                    <ChevronLeft size={26} strokeWidth={2.5} />
                  </button>
                  <div className="flex-1 relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-marketplace-muted">
                      <Search size={18} />
                    </div>
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="Search marketplace..." 
                      value={localSearch}
                      onChange={(e) => setLocalSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && localSearch.trim()) {
                          setSparklyInitialMsg(`Find me "${localSearch.trim()}" on Sparkle Marketplace`);
                          setSparklyOpen(true);
                          setIsSearching(false);
                        }
                      }}
                      className="w-full bg-marketplace-bg rounded-full py-2 px-10 text-[15px] font-medium outline-none focus:bg-slate-200 transition-colors text-center"
                    />
                    {localSearch ? (
                      <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                        <button
                          onClick={() => {
                            setSparklyInitialMsg(`Find me "${localSearch.trim()}" on Sparkle Marketplace`);
                            setSparklyOpen(true);
                            setIsSearching(false);
                          }}
                          className="flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:text-purple-700 bg-purple-100 hover:bg-purple-200 transition-colors px-2 py-1 rounded-full"
                        >
                          <Sparkles size={11} /> AI
                        </button>
                        <button 
                          onClick={() => setLocalSearch('')}
                          className="flex items-center text-marketplace-muted hover:text-marketplace-text"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    ) : null}
                  </div>
                </motion.div>

              )}
            </AnimatePresence>
            
            {!isSearching && (
              <button 
                onClick={() => setIsSearching(true)}
                className="w-10 h-10 flex items-center justify-center text-marketplace-text hover:bg-marketplace-bg rounded-full transition-colors"
              >
                <Search size={24} strokeWidth={2.5} />
              </button>
            )}
          </div>

          {/* Action Pills Row (only on main home) */}
          {!isCategoryView && !isInboxView && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar px-3 pb-3">
              <Link to="/marketplace/my-shop" className="flex items-center justify-center bg-marketplace-bg hover:bg-slate-200 transition-colors h-9 px-4 rounded-full font-bold text-sm text-marketplace-text flex-shrink-0">
                <img src={getAvatarUrl(user?.avatar_url, user?.username)} alt="Profile" className="w-5 h-5 rounded-full mr-2" />
                Profile
              </Link>
              <Link to="/marketplace/inbox" className="flex items-center justify-center bg-marketplace-bg hover:bg-slate-200 transition-colors h-9 px-4 rounded-full font-bold text-[15px] text-marketplace-text whitespace-nowrap flex-shrink-0">
                Inbox
              </Link>
              <Link to="/marketplace/sell" className="flex items-center justify-center bg-marketplace-bg hover:bg-slate-200 transition-colors h-9 px-4 rounded-full font-bold text-[15px] text-marketplace-text whitespace-nowrap flex-shrink-0">
                Sell
              </Link>
              <button 
                onClick={() => setActiveModal('categories')}
                className="flex items-center justify-center bg-marketplace-bg hover:bg-slate-200 transition-colors h-9 px-4 rounded-full font-bold text-[15px] text-marketplace-text whitespace-nowrap flex-shrink-0"
              >
                Categories
              </button>
              <button 
                onClick={() => setIsSearching(true)}
                className="flex items-center justify-center bg-marketplace-bg hover:bg-slate-200 transition-colors h-9 px-4 rounded-full font-bold text-[15px] text-marketplace-text whitespace-nowrap flex-shrink-0"
              >
                Search
              </button>
            </div>
          )}

          {/* Category Sub-header (Image 4 Style) */}
          {isCategoryView && (
            <div className="flex flex-col gap-3 px-3 pb-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-marketplace-muted">
                  <Search size={18} />
                </div>
                <input 
                  type="text" 
                  placeholder={`Search in ${categoryId}...`}
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="w-full bg-marketplace-bg rounded-full py-2 px-10 text-[15px] font-medium capitalize outline-none focus:bg-slate-200 transition-colors text-center"
                />
                {localSearch && (
                  <button 
                    onClick={() => setLocalSearch('')}
                    className="absolute inset-y-0 right-3 flex items-center text-marketplace-muted hover:text-marketplace-text"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <button className="flex items-center justify-center w-8 h-8 rounded border border-marketplace-border text-[#1877F2] flex-shrink-0 bg-white">
                  <Grid size={14} />
                </button>
                <button 
                  onClick={() => setActiveModal('location')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-marketplace-border rounded text-[13px] font-bold text-[#1877F2] whitespace-nowrap flex-shrink-0"
                >
                  <span className="flex flex-col items-start leading-none">
                    <span className="text-[10px] text-marketplace-muted font-normal">
                      {filterLocation.source === 'gps' ? 'Using current location' : 
                       filterLocation.source === 'ip' ? 'Using estimated location' : 
                       filterLocation.source === 'manual' ? 'Using selected location' : 'Location'}
                    </span>
                    <span>{filterLocation.name.split(',')[0]} <ChevronDown size={14} className="inline ml-1" /></span>
                  </span>
                </button>
                <button 
                  onClick={() => setActiveModal('distance')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-marketplace-border rounded text-[13px] font-bold text-[#1877F2] whitespace-nowrap flex-shrink-0"
                >
                  {radiusKm} km <ChevronDown size={14} />
                </button>
                <button 
                  onClick={() => setActiveModal('filters')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-marketplace-border rounded text-[13px] font-bold text-marketplace-text whitespace-nowrap flex-shrink-0"
                >
                  <SlidersHorizontal size={14} /> Filters
                </button>
                <button 
                  onClick={() => {
                    setSparklyInitialMsg(undefined);
                    setSparklyOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded text-[13px] font-extrabold whitespace-nowrap flex-shrink-0 shadow-sm active:scale-95 transition-all"
                >
                  <Sparkles size={14} className="animate-pulse" /> Sparkly AI
                </button>
                <button 
                  onClick={() => setActiveModal('sort')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-marketplace-border rounded text-[13px] font-bold text-marketplace-text whitespace-nowrap flex-shrink-0"
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
              {/* Fallback Notice */}
              {isFallback && filteredListings.length > 0 && (
                <div className="px-4 py-3 bg-marketplace-bg/50 border-b border-marketplace-border flex items-center justify-center gap-2">
                  <MapPin size={14} className="text-marketplace-muted" />
                  <p className="text-[11px] font-black text-marketplace-muted uppercase tracking-[0.2em]">Showing items from all locations</p>
                </div>
              )}
              {/* Home Sub-header (Today's Picks) */}
              {!isCategoryView && (
                <div className="flex items-center justify-between px-3 py-4">
                  <h2 className="text-[17px] font-bold text-marketplace-text">Today's picks</h2>
                  <button 
                    onClick={() => setActiveModal('location')}
                    className="flex items-center gap-1.5 text-[#1877F2] font-semibold text-[15px]"
                  >
                    <MapPin size={16} className="fill-[#1877F2] text-white" />
                    <div className="flex flex-col items-start leading-none">
                      <span className="text-[10px] text-marketplace-muted font-normal">
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
                    <div key={i} className="aspect-square bg-marketplace-bg animate-pulse" />
                  ))}
                </div>
              ) : error ? (
                <ErrorRetry onRetry={() => fetchListings()} />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-[2px]">
                  {filteredListings.length > 0 ? (
                    filteredListings.map((item) => (
                      <ListingCard
                        key={item.listing_id}
                        variant="grid"
                        listing={item}
                        isVehicle={categoryId === 'vehicles'}
                        onClick={() => navigate(`/marketplace/listings/${item.listing_id}`)}
                      />
                    ))
                  ) : (
                    <div className="col-span-full py-20 flex flex-col items-center text-center">
                      <div className="bg-marketplace-bg p-5 rounded-full mb-4">
                        <ShoppingBag size={32} className="text-marketplace-muted" />
                      </div>
                      <h3 className="text-lg font-bold">No results found</h3>
                      <p className="text-marketplace-muted text-sm mt-1">Try expanding your radius or changing filters.</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Anchored Sparkly AI Shopping Assistant Launcher */}
      <motion.button
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.06, translateY: -3 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => {
          setSparklyInitialMsg(undefined);
          setSparklyOpen(true);
        }}
        className="fixed bottom-20 mb-safe right-4 sm:right-6 z-40 cursor-pointer"
        title="Ask Sparkly AI Shopping Assistant"
      >
        {/* Pulsing ring */}
        <span className="absolute inset-0 rounded-full animate-ping opacity-30 bg-purple-500" style={{ animationDuration: '2.5s' }} />
        <div className="relative flex items-center gap-2.5 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2.5 rounded-full shadow-xl shadow-purple-950/40 border border-purple-500/40 hover:border-purple-400/70 transition-all group">
          <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md">
            <Sparkles size={15} className="text-white" />
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-slate-900" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-xs font-black tracking-wide text-white leading-tight">Sparkly AI</span>
            <span className="text-[10px] text-purple-300/80 font-medium leading-none">Ask me anything</span>
          </div>
        </div>
      </motion.button>

      {/* Sparkly Mini Chat Panel */}
      <SparklyMiniChat
        isOpen={sparklyOpen}
        onClose={() => setSparklyOpen(false)}
        initialMessage={sparklyInitialMsg}
      />

      <MarketplaceModals />
    </div>
  );
}
