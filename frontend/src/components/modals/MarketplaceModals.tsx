import { useState, useEffect } from 'react';
import { X, MapPin, Navigation, Compass, ChevronRight, MessageCircle, ChevronDown, ChevronLeft, FileWarning, UserPlus } from 'lucide-react';
import { useMarketplaceStore } from '../../store/marketplaceStore';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useLocationDetection } from '../../hooks/useLocationDetection';
import { useSocket } from '../../hooks/useSocket';
import api from '../../api/api';
import clsx from 'clsx';

export default function MarketplaceModals() {
  const navigate = useNavigate();
  const socket = useSocket();
  const { detectLocation } = useLocationDetection();
  const activeModal = useMarketplaceStore(state => state.activeModal);
  const setActiveModal = useMarketplaceStore(state => state.setActiveModal);
  const { radiusKm, sortBy, setFilters, minPrice: storeMin, maxPrice: storeMax, selectedListing } = useMarketplaceStore();

  const [localMin, setLocalMin] = useState<string>(storeMin?.toString() || '');
  const [localMax, setLocalMax] = useState<string>(storeMax?.toString() || '');
  const [offerPrice, setOfferPrice] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [jobStatus, setJobStatus] = useState<'IDLE' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'>('IDLE');
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [lastSequence, setLastSequence] = useState<number>(0);
  const [loadState, setLoadState] = useState<'NORMAL' | 'DEGRADED' | 'CRITICAL'>('NORMAL');

  useEffect(() => {
    setLocalMin(storeMin?.toString() || '');
    setLocalMax(storeMax?.toString() || '');
    if (selectedListing) setOfferPrice(selectedListing.price.toString());
  }, [storeMin, storeMax, selectedListing]);

  // Sync state if job exists (Recovery Logic: Delta Sync aware)
  useEffect(() => {
    if (currentJobId && (jobStatus === 'PENDING' || jobStatus === 'PROCESSING')) {
      const syncStatus = async () => {
        try {
          const res = await api.get(`/marketplace/jobs/${currentJobId}/status?after=${lastSequence}`);
          if (res.data.success && res.data.history && res.data.history.length > 0) {
            const latest = res.data.history[res.data.history.length - 1];
            setJobStatus(latest.status);
            setLastSequence(latest.sequence);
            if (latest.status === 'COMPLETED') {
               setTimeout(() => setActiveModal(null), 1000);
            }
          }
        } catch (e) {
          console.warn('Job delta-sync failed:', e);
        }
      };
      const interval = setInterval(syncStatus, 3000); // Polling as fallback for socket
      return () => clearInterval(interval);
    }
  }, [currentJobId, jobStatus, lastSequence, setActiveModal]);

  // Real-time Job Tracking with Sequencing
  useEffect(() => {
    if (!socket || !currentJobId) return;

    const handleStatus = (data: any) => {
      if (data.jobId === currentJobId && data.sequence > lastSequence) {
        setJobStatus(data.status);
        setLastSequence(data.sequence);

        if (data.status === 'COMPLETED') {
          setTimeout(() => {
            setActiveModal(null);
            setJobStatus('IDLE');
            setLastSequence(0);
          }, 1500);
        }
        if (data.status === 'FAILED') {
          alert(`Offer error: ${data.error || 'System backlog'}`);
          setJobStatus('IDLE');
          setLastSequence(0);
          setIsSending(false);
        }
      }
    };

    socket.on('marketplace:job_status', handleStatus);
    return () => { socket.off('marketplace:job_status', handleStatus); };
  }, [socket, currentJobId, lastSequence, setActiveModal]);

  const handleSendOffer = async () => {
    if (!selectedListing || !offerPrice) return;
    setIsSending(true);
    setJobStatus('PENDING');
    setLastSequence(0);
    try {
      const res = await api.post(`/marketplace/listings/${selectedListing.listing_id}/offer`, { 
        amount: offerPrice 
      });
      if (res.data.jobId) {
        setCurrentJobId(res.data.jobId);
        setLoadState(res.data.loadState || 'NORMAL');
      }
    } catch (err: any) {
      if (err.response?.status === 530) {
        alert("SYSTEM PEAK: Sparkle is serving too many people right now. Please try in 30 seconds.");
      } else {
        alert('Failed to submit offer. Please try again.');
      }
      setIsSending(false);
      setJobStatus('IDLE');
    }
  };

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

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin + `/marketplace/listings/${selectedListing?.listing_id}`);
    alert('Link copied to clipboard!');
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
                ? "h-[90vh] rounded-t-[30px] lg:h-[80vh] lg:max-w-2xl lg:rounded-3xl" 
                : "rounded-t-[30px] lg:max-w-md lg:rounded-3xl"
            )}
          >
            {/* Dragger handle for mobile */}
            <div className="w-full flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
            </div>

            {/* Premium Navigation Header */}
            <div className="sticky top-0 z-20 px-6 py-5 flex items-center bg-white/80 backdrop-blur-md border-b border-slate-100/50">
              <button 
                onClick={() => setActiveModal(null)}
                className="group w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-900 rounded-2xl hover:bg-slate-100 hover:scale-105 transition-all duration-200 active:scale-95"
                aria-label="Back"
              >
                <ChevronLeft size={22} strokeWidth={3} className="group-hover:-translate-x-0.5 transition-transform" />
              </button>
              
              <div className="flex-1 px-4">
                <h2 className="text-xl font-black capitalize text-slate-900 tracking-tight leading-tight">
                  {activeModal === 'distance' ? 'Search Radius' : activeModal}
                </h2>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  Sparkle Marketplace
                </div>
              </div>

              <button 
                onClick={() => setActiveModal(null)}
                className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 rounded-2xl hover:bg-slate-100 hover:text-slate-600 transition-all active:scale-90 lg:flex hidden"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto p-6 no-scrollbar pb-12">
              
              {/* OFFER MODAL */}
              {activeModal === 'offer' && selectedListing && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 bg-marketplace-bg rounded-2xl">
                    <img src={selectedListing.image_url} className="w-16 h-16 rounded-xl object-cover" alt="" />
                    <div>
                      <h4 className="font-bold text-sm truncate w-40">{selectedListing.title}</h4>
                      <p className="text-lg font-black text-[#1877F2]">KES {parseFloat(selectedListing.price).toLocaleString()}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-black text-marketplace-muted uppercase tracking-widest mb-2 block">Your Offer Price</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-marketplace-muted">KES</span>
                      <input 
                        type="number" 
                        value={offerPrice}
                        onChange={(e) => setOfferPrice(e.target.value)}
                        className="w-full bg-marketplace-bg rounded-2xl py-4 pl-14 pr-4 text-2xl font-black outline-none focus:ring-2 ring-[#1877F2]/20 transition-all"
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[0.9, 0.95, 1.0].map(mult => (
                      <button 
                        key={mult}
                        onClick={() => setOfferPrice((parseFloat(selectedListing.price) * mult).toString())}
                        className="py-3 bg-white border border-marketplace-border rounded-xl font-bold text-xs hover:bg-marketplace-bg transition-colors"
                      >
                        {mult === 1.0 ? 'Full Price' : `${Math.round((1-mult)*100)}% Off`}
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={handleSendOffer}
                    disabled={isSending || jobStatus === 'COMPLETED'}
                    className={clsx(
                      "w-full py-4 text-white font-black rounded-2xl shadow-xl shadow-slate-200 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70",
                      jobStatus === 'COMPLETED' ? "bg-green-500" : "bg-marketplace-text"
                    )}
                  >
                    {jobStatus === 'IDLE' && 'Send Custom Offer'}
                    {jobStatus === 'PENDING' && 'Submitting...'}
                    {jobStatus === 'PROCESSING' && 'Processing...'}
                    {jobStatus === 'COMPLETED' && 'Confirmed!'}
                    {jobStatus === 'FAILED' && 'Retry Offer'}
                  </button>
                </div>
              )}

              {/* SHARE MODAL */}
              {activeModal === 'share' && selectedListing && (
                <div className="space-y-8">
                  <div className="grid grid-cols-4 gap-6">
                    {[
                      { 
                        icon: (
                          <svg viewBox="0 0 24 24" className="w-7 h-7 fill-[#25D366]">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        ), 
                        name: 'WhatsApp' 
                      },
                      { 
                        icon: (
                          <svg viewBox="0 0 24 24" className="w-7 h-7 fill-[#0088cc]">
                            <path d="M12 24c6.627 0 12-5.373 12-12S18.627 0 12 0 0 5.373 0 12s5.373 12 12 12z" opacity=".1"/>
                            <path d="M5.491 11.721l13.117-5.059c.607-.221 1.139.141.942.897l-2.233 10.534c-.167.755-.616.942-1.25.586l-3.401-2.506-1.641 1.579c-.181.181-.334.334-.685.334l.244-3.461 6.299-5.69c.274-.244-.06-.381-.424-.137l-7.785 4.903-3.354-1.049c-.729-.228-.744-.729.152-1.081z"/>
                          </svg>
                        ), 
                        name: 'Telegram' 
                      },
                      { 
                        icon: (
                          <svg viewBox="0 0 24 24" className="w-7 h-7">
                            <defs>
                              <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                                <stop offset="0%" style={{stopColor:'#f09433'}} />
                                <stop offset="25%" style={{stopColor:'#e6683c'}} />
                                <stop offset="50%" style={{stopColor:'#dc2743'}} />
                                <stop offset="75%" style={{stopColor:'#cc2366'}} />
                                <stop offset="100%" style={{stopColor:'#bc1888'}} />
                              </linearGradient>
                            </defs>
                            <path fill="url(#ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
                          </svg>
                        ), 
                        name: 'Instagram' 
                      },
                      { 
                        icon: (
                          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-slate-900">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                          </svg>
                        ), 
                        name: 'X' 
                      },
                    ].map(app => (
                      <button key={app.name} className="flex flex-col items-center gap-2 group">
                        <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 group-hover:scale-110 group-hover:bg-white transition-all shadow-sm">
                          {app.icon}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-marketplace-muted">{app.name}</span>
                      </button>
                    ))}
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <div className="truncate text-xs font-bold text-slate-500 flex-1 pr-4">
                      {window.location.origin}/marketplace/listings/{selectedListing.listing_id}
                    </div>
                    <button 
                      onClick={handleCopyLink}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-black text-xs hover:bg-slate-100 transition-colors flex-shrink-0"
                    >
                      Copy Link
                    </button>
                  </div>
                </div>
              )}

              {/* MORE MODAL */}
              {activeModal === 'more' && selectedListing && (
                <div className="space-y-2">
                  <button 
                    onClick={() => {
                      setActiveModal(null);
                      navigate(`/marketplace/report/${selectedListing.listing_id}`);
                    }}
                    className="w-full flex items-center gap-4 p-4 hover:bg-red-50 rounded-2xl transition-all text-red-500 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-red-100/50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                      <FileWarning size={20} />
                    </div>
                    <div className="text-left">
                      <span className="font-black text-[15px] block">Report Listing</span>
                      <span className="text-[11px] font-bold opacity-60 block">Inappropriate or suspicious content</span>
                    </div>
                  </button>

                  <button className="w-full flex items-center gap-4 p-4 hover:bg-marketplace-bg rounded-2xl transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-marketplace-bg flex items-center justify-center group-hover:bg-white transition-colors">
                      <X size={20} />
                    </div>
                    <div className="text-left">
                      <span className="font-black text-[15px] block">Hide Listing</span>
                      <span className="text-[11px] font-bold opacity-60 block">Don't show this item in my feed</span>
                    </div>
                  </button>

                  <button className="w-full flex items-center gap-4 p-4 hover:bg-marketplace-bg rounded-2xl transition-all group">
                    <div className="w-10 h-10 rounded-xl bg-marketplace-bg flex items-center justify-center group-hover:bg-white transition-colors">
                      <UserPlus size={20} className="text-slate-400" />
                    </div>
                    <div className="text-left text-slate-400">
                      <span className="font-black text-[15px] block">Block Seller</span>
                      <span className="text-[11px] font-bold opacity-60 block">Mute all items from this user</span>
                    </div>
                  </button>
                </div>
              )}

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
                          className="p-4 bg-marketplace-bg rounded-xl font-bold text-marketplace-text hover:bg-slate-200 transition-all text-sm"
                        >
                          {loc.name}
                        </button>
                      ))}
                    </div>

                    <p className="text-xs text-marketplace-muted mb-4 uppercase font-bold tracking-wider">Sub-locations (3x3)</p>
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
                          className="p-2.5 bg-slate-50 border border-marketplace-border rounded-lg text-[13px] font-semibold text-marketplace-muted hover:bg-marketplace-bg transition-all"
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
                      className="w-full flex items-center justify-between p-4 hover:bg-marketplace-bg rounded-xl transition-all border-b border-marketplace-bg last:border-0"
                    >
                      <span className="font-semibold text-marketplace-text">{cat}</span>
                      <ChevronRight size={18} className="text-marketplace-muted/30" />
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
                  {/* Chat List Placeholder */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    <div className="flex flex-col h-full items-center justify-center text-center py-20 px-6">
                      <div className="relative mb-8">
                        <div className="w-24 h-24 bg-slate-50 rounded-[32px] flex items-center justify-center transform rotate-12" />
                        <div className="absolute inset-0 w-24 h-24 bg-white border-2 border-slate-100 rounded-[32px] flex items-center justify-center shadow-sm -rotate-6 group-hover:rotate-0 transition-transform">
                          <MessageCircle size={38} className="text-[#1877F2]" strokeWidth={1.5} />
                        </div>
                        <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-green-500 border-4 border-white rounded-full flex items-center justify-center">
                          <Plus size={20} className="text-white" />
                        </div>
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Your Inbox is Empty</h3>
                      <p className="text-[15px] font-medium text-slate-400 leading-relaxed max-w-[260px] mx-auto">
                        When you message sellers or receive offers, your conversations will appear here.
                      </p>
                      
                      <button 
                        onClick={() => setActiveModal(null)}
                        className="mt-10 px-8 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-slate-200"
                      >
                        Start Browsing
                      </button>
                    </div>
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
