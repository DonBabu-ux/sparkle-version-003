import { useState, useEffect } from 'react';
import { X, MapPin, Navigation, Compass, ChevronRight, MessageCircle, ChevronDown } from 'lucide-react';
import { useMarketplaceStore } from '../../store/marketplaceStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLocationDetection } from '../../hooks/useLocationDetection';
import clsx from 'clsx';

export default function MarketplaceModals() {
  const navigate = useNavigate();
  const { detectLocation } = useLocationDetection();
  const activeModal = useMarketplaceStore(state => state.activeModal);
  const setActiveModal = useMarketplaceStore(state => state.setActiveModal);
  const { radiusKm, sortBy, setFilters, minPrice: storeMin, maxPrice: storeMax } = useMarketplaceStore();

  const [localMin, setLocalMin] = useState<string>(storeMin?.toString() || '');
  const [localMax, setLocalMax] = useState<string>(storeMax?.toString() || '');

  useEffect(() => {
    setLocalMin(storeMin?.toString() || '');
    setLocalMax(storeMax?.toString() || '');
  }, [storeMin, storeMax]);

  if (!activeModal) return null;

  const handleApplyFilters = () => {
    setFilters({
      minPrice: localMin === '' ? null : parseFloat(localMin),
      maxPrice: localMax === '' ? null : parseFloat(localMax),
    });
    setActiveModal(null);
  };

  const handleResetFilters = () => {
    setLocalMin('');
    setLocalMax('');
    setFilters({ minPrice: null, maxPrice: null });
  };

  return (
    <AnimatePresence>
      {activeModal && (
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end lg:items-center lg:justify-center bg-black/40 backdrop-blur-sm">
          {/* Overlay click to close */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0"
            onClick={() => setActiveModal(null)}
          />

          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={clsx(
              "relative bg-white w-full shadow-2xl flex flex-col overflow-hidden",
              activeModal === 'categories' || activeModal === 'inbox' 
                ? "h-[90vh] rounded-t-[30px] lg:h-[80vh] lg:max-w-2xl lg:rounded-3xl" // Almost full screen
                : "rounded-t-[30px] lg:max-w-md lg:rounded-3xl" // Bottom sheet
            )}
          >
            {/* Dragger handle for mobile */}
            <div className="w-full flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
            </div>

            {/* Common Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-slate-100">
              <h2 className="text-xl font-bold capitalize">
                {activeModal === 'distance' ? 'Radius' : activeModal}
              </h2>
              <button 
                onClick={() => setActiveModal(null)}
                className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-500 rounded-full hover:bg-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
              
              {/* DISTANCE MODAL */}
              {activeModal === 'distance' && (
                <div className="space-y-6">
                  <p className="text-sm text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    To provide more relevant results, your device's estimated location is used. Adjust the radius to see items further away.
                  </p>
                  <div className="space-y-2">
                    {[5, 10, 15, 25, 40, 50, 100, 150].map((dist) => (
                      <label key={dist} className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-100 transition-all">
                        <span className="font-semibold text-slate-800">{dist} km</span>
                        <input 
                          type="radio" 
                          name="distance" 
                          value={dist} 
                          checked={radiusKm === dist}
                          onChange={() => {
                            setFilters({ radiusKm: dist });
                            setTimeout(() => setActiveModal(null), 150);
                          }}
                          className="w-5 h-5 text-primary focus:ring-primary"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* SORT MODAL */}
              {activeModal === 'sort' && (
                <div className="space-y-2">
                  {[
                    { id: 'recommended', label: 'Recommended' },
                    { id: 'price_asc', label: 'Price: Lowest First' },
                    { id: 'price_desc', label: 'Price: Highest First' },
                    { id: 'distance_asc', label: 'Distance: Nearest First' },
                    { id: 'newest', label: 'Date Listed: Newest First' }
                  ].map((option) => (
                    <label key={option.id} className="flex items-center justify-between p-4 rounded-xl hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-100 transition-all">
                      <span className="font-semibold text-slate-800">{option.label}</span>
                      <input 
                        type="radio" 
                        name="sort" 
                        value={option.id} 
                        checked={sortBy === option.id}
                        onChange={() => {
                          setFilters({ sortBy: option.id as any });
                          setTimeout(() => setActiveModal(null), 150);
                        }}
                        className="w-5 h-5 text-primary focus:ring-primary"
                      />
                    </label>
                  ))}
                  <button 
                    onClick={() => setActiveModal(null)}
                    className="w-full mt-6 py-3.5 bg-primary text-white font-bold rounded-xl shadow-md hover:bg-primary/90 transition-all"
                  >
                    See Listings
                  </button>
                </div>
              )}

              {/* LOCATION MODAL */}
              {activeModal === 'location' && (
                <div className="space-y-6">
                  <button className="w-full flex items-center gap-3 p-4 bg-primary/10 text-primary rounded-xl font-bold hover:bg-primary/20 transition-all">
                    <Navigation size={20} /> Use Current Location
                  </button>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-lg">Change Location</h3>
                      <button onClick={detectLocation} className="text-[#1877F2] text-sm font-bold flex items-center gap-1">
                        <Navigation size={14} /> Use Current
                      </button>
                    </div>
                    
                    <p className="text-xs text-slate-500 mb-4 uppercase font-bold tracking-wider">Counties (2x2)</p>
                    <div className="grid grid-cols-2 gap-2 mb-6">
                      {[
                        { name: 'Nairobi', lat: -1.2921, lng: 36.8219 },
                        { name: 'Mombasa', lat: -4.0435, lng: 39.6682 },
                        { name: 'Kisumu', lat: -0.0917, lng: 34.768 },
                        { name: 'Nakuru', lat: -0.3031, lng: 36.08 }
                      ].map(loc => (
                        <button 
                          key={loc.name}
                          onClick={() => {
                            setFilters({ location: { ...loc, name: loc.name + ', Kenya', source: 'manual' } });
                            setActiveModal(null);
                          }}
                          className="p-4 bg-slate-100 rounded-xl font-bold text-slate-800 hover:bg-slate-200 transition-all text-sm"
                        >
                          {loc.name}
                        </button>
                      ))}
                    </div>

                    <p className="text-xs text-slate-500 mb-4 uppercase font-bold tracking-wider">Sub-locations (3x3)</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        'Othaya', 'Karatina', 'Nyeri', 
                        'Thika', 'Kiambu', 'Ruiru',
                        'Eldoret', 'Kericho', 'Kitale'
                      ].map(name => (
                        <button 
                          key={name}
                          onClick={() => {
                            // Dummy coordinates for sub-locations in this demo
                            setFilters({ location: { lat: -1.2921, lng: 36.8219, name: name + ', Kenya', source: 'manual' } });
                            setActiveModal(null);
                          }}
                          className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[13px] font-semibold text-slate-600 hover:bg-slate-100 transition-all"
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* CATEGORIES MODAL */}
              {activeModal === 'categories' && (
                <div className="space-y-1 pb-10">
                  {[
                    'Buy and Sell Groups', 'Vehicles', 'Housing', 'Home Sales', 
                    'Rentals', 'Home & Garden', 'Furniture', 'Household Appliances',
                    'Tools', 'Garden', 'Electronics', 'Clothing', 'Jewelry', 
                    'Baby & Kids', 'Health', 'Toys & Games', 'Pet Supplies', 
                    'Books', 'Movies & Music'
                  ].map((cat) => (
                    <button 
                      key={cat}
                      onClick={() => {
                        const slug = cat.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
                        navigate(`/marketplace/category/${slug}`);
                        setActiveModal(null);
                      }}
                      className="w-full flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-all border-b border-slate-50 last:border-0"
                    >
                      <span className="font-semibold text-slate-800">{cat}</span>
                      <ChevronRight size={18} className="text-slate-300" />
                    </button>
                  ))}
                </div>
              )}

              {/* FILTERS MODAL */}
              {activeModal === 'filters' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-bold text-lg mb-4">Price</h3>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Min</label>
                        <input 
                          type="number" 
                          placeholder="Any" 
                          value={localMin}
                          onChange={(e) => setLocalMin(e.target.value)}
                          className="w-full p-3 bg-slate-100 rounded-xl font-medium outline-none" 
                        />
                      </div>
                      <span className="text-slate-300 font-bold mt-4">-</span>
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-slate-500 mb-1 block">Max</label>
                        <input 
                          type="number" 
                          placeholder="Any" 
                          value={localMax}
                          onChange={(e) => setLocalMax(e.target.value)}
                          className="w-full p-3 bg-slate-100 rounded-xl font-medium outline-none" 
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-6 border-t border-slate-100 flex gap-3">
                    <button 
                      onClick={handleResetFilters}
                      className="flex-1 py-3.5 bg-slate-100 text-slate-800 font-bold rounded-xl hover:bg-slate-200 transition-all"
                    >
                      Reset
                    </button>
                    <button 
                      onClick={handleApplyFilters}
                      className="flex-1 py-3.5 bg-[#1877F2] text-white font-bold rounded-xl shadow-md hover:bg-blue-600 transition-all"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )}

              {/* INBOX MODAL */}
              {activeModal === 'inbox' && (
                <div className="flex flex-col h-full -mx-6 -my-6">
                  {/* Top Level Tabs */}
                  <div className="flex border-b border-slate-100 bg-white sticky top-0 z-10 px-4 pt-2">
                    <button className="flex-1 py-3 font-bold text-primary border-b-2 border-primary">Selling</button>
                    <button className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 transition-colors">Buying</button>
                  </div>

                  {/* Horizontal Sub-filters */}
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-3 px-4 bg-slate-50/50 border-b border-slate-100 sticky top-[48px] z-10">
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
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <div className="flex flex-col h-full items-center justify-center text-center pb-20 pt-10">
                      <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                        <MessageCircle size={32} className="text-slate-400" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 mb-2">No Messages Yet</h3>
                      <p className="text-sm text-slate-500 max-w-xs mx-auto">
                        Your marketplace conversations regarding items you are selling will appear here.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
