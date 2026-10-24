import { showError } from '../utils/toast';
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ShieldCheck, MapPin, CreditCard, Clock, CheckCircle2 } from 'lucide-react';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import Spinner from '../components/ui/Spinner';
import { logger } from '../utils/logger';

export default function MarketplaceOrder() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const listingId = searchParams.get('listingId');

  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [agreedPrice, setAgreedPrice] = useState<string>('');
  const [campus, setCampus] = useState(user?.campus || '');
  const [location, setLocation] = useState('');
  const message = '';
  const [scheduledTime, setScheduledTime] = useState('');
  const [timeError, setTimeError] = useState('');

  useEffect(() => {
    if (!listingId) {
      navigate('/marketplace');
      return;
    }

    const fetchListing = async () => {
      setLoadError('');
      try {
        const res = await api.get(`/marketplace/listings/${listingId}`);
        if (res.data.success && res.data.listing) {
          setListing(res.data.listing);
          setAgreedPrice(String(res.data.listing.price ?? ''));
        } else {
          setLoadError('This listing is no longer available.');
        }
      } catch (err) {
        logger.error('Failed to fetch listing:', err);
        setLoadError('This listing is no longer available.');
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [listingId, navigate]);

  const handlePlaceOrder = async () => {
    if (!listing || !agreedPrice) return;

    let isoTime: string | null = null;
    if (scheduledTime) {
      const parsed = new Date(scheduledTime);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
        setTimeError('Choose a meetup time in the future.');
        return;
      }
      setTimeError('');
      isoTime = parsed.toISOString();
    }

    setPlacing(true);

    try {
      const res = await api.post('/marketplace/order', {
        listingId,
        agreedPrice: parseFloat(agreedPrice),
        message,
        campus,
        location,
        scheduledTime: isoTime
      });

      if (res.data.success) {
        setSuccess(true);
        setTimeout(() => navigate('/marketplace/orders'), 2000);
      }
    } catch (err: any) {
      showError(err.response?.data?.message || 'Failed to send request');
    } finally {
      setPlacing(false);
    }
  };

  if (loading) return (
    <div className="min-h-dvh bg-white flex items-center justify-center">
      <Spinner size="medium" color="text-primary" />
    </div>
  );

  if (!listing) return (
    <div className="min-h-dvh bg-slate-50 flex flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-black text-black mb-2">Listing unavailable</h1>
      <p className="text-sm text-black/60 mb-6">{loadError || 'This listing is no longer available.'}</p>
      <button
        onClick={() => navigate('/marketplace')}
        className="px-6 py-3 bg-black text-white rounded-2xl font-bold text-sm"
      >
        Back to Marketplace
      </button>
    </div>
  );

  const isOwner = user?.user_id && listing.seller_id === user.user_id;

  return (
    <div className="min-h-dvh bg-slate-50 pb-10">
      <div className="bg-white sticky top-0 z-50 border-b border-slate-100 px-4 h-16 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-slate-50 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="font-black text-xl text-black tracking-tight">Request to Buy</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-6">
          <div className="flex gap-4">
            <img 
              src={listing.media_url || listing.image_url || listing.thumbnail || '/uploads/defaults/no-image.png'}
              className="w-24 h-24 rounded-2xl object-cover" 
              alt={listing.title} 
            />
            <div className="flex-1">
              <h2 className="text-xl font-bold text-black mb-1">{listing.title}</h2>
              <p className="text-black text-sm mb-2">Seller: {listing.seller_name || listing.seller_username}</p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-[#1877F2]">KES {parseFloat(listing.price).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {isOwner ? (
          <div className="bg-white rounded-3xl p-6 border border-slate-100 text-center">
            <p className="font-bold text-black mb-1">This is your listing.</p>
            <p className="text-sm text-black/60 mb-4">You cannot send an order request to yourself.</p>
            <button onClick={() => navigate(`/marketplace/listings/${listingId}`)} className="px-6 py-3 bg-black text-white rounded-2xl font-bold text-sm">
              Back to listing
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <CreditCard className="text-blue-500" size={20} />
                <h3 className="font-black text-black">Agreed Price</h3>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-black">KES</span>
                <input 
                  type="number"
                  value={agreedPrice}
                  onChange={(e) => setAgreedPrice(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-14 pr-4 text-xl font-black text-black focus:ring-2 ring-blue-500/20 outline-none transition-all"
                />
              </div>
              <p className="text-xs text-black/50 mt-2">This is the price you propose to the seller. Nothing is charged in the app.</p>
            </div>

            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <MapPin className="text-emerald-500" size={20} />
                <h3 className="font-black text-black">Meetup Details</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black text-black uppercase tracking-widest mb-1.5 block ml-1">Campus</label>
                  <input 
                    type="text"
                    value={campus}
                    onChange={(e) => setCampus(e.target.value)}
                    placeholder="e.g. Main Campus"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold text-black focus:ring-2 ring-blue-500/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-black uppercase tracking-widest mb-1.5 block ml-1">Specific Location</label>
                  <input 
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Student Union, Library Gate"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold text-black focus:ring-2 ring-blue-500/20 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-black uppercase tracking-widest mb-1.5 block ml-1">Preferred Time</label>
                  <div className="relative">
                    <Clock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-black" />
                    <input 
                      type="datetime-local"
                      value={scheduledTime}
                      onChange={(e) => { setScheduledTime(e.target.value); setTimeError(''); }}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold text-black focus:ring-2 ring-blue-500/20 outline-none transition-all"
                    />
                  </div>
                  {timeError && <p className="text-xs font-bold text-rose-600 mt-2">{timeError}</p>}
                </div>
              </div>
            </div>

            <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-6 flex gap-4">
              <ShieldCheck className="text-[#1877F2] flex-shrink-0" size={24} />
              <div>
                <h4 className="font-bold text-black mb-1">Meet in person and pay directly</h4>
                <p className="text-black text-sm leading-relaxed">
                  This sends a meetup request to the seller. Sparkle does not take payment, hold money, or guarantee the item. Pay the seller only after you inspect it in person.
                </p>
              </div>
            </div>

            <button 
              onClick={handlePlaceOrder}
              disabled={placing || success || !location || !agreedPrice}
              className={`w-full py-5 rounded-3xl font-black text-lg shadow-xl transition-all active:scale-[0.98] ${
                success 
                  ? 'bg-emerald-500 text-white shadow-emerald-200' 
                  : 'bg-black text-white shadow-slate-200 hover:bg-black/80 disabled:opacity-50'
              }`}
            >
              {success ? (
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 size={24} /> Request Sent
                </div>
              ) : placing ? (
                <div className="flex items-center justify-center gap-2">
                  <Spinner size="small" color="text-white" />
                  Sending request...
                </div>
              ) : (
                'Send Request to Seller'
              )}
            </button>

            {!location && !success && (
              <p className="text-center text-xs font-bold text-black uppercase tracking-widest">
                Please enter a specific meetup location
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}



