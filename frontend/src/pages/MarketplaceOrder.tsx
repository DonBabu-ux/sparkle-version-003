import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, ShieldCheck, MapPin, CreditCard, 
  Clock, MessageSquare, AlertCircle, CheckCircle2 
} from 'lucide-react';
import api from '../api/api';
import { useUserStore } from '../store/userStore';

export default function MarketplaceOrder() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const listingId = searchParams.get('listingId');

  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form State
  const [agreedPrice, setAgreedPrice] = useState<string>('');
  const [campus, setCampus] = useState(user?.campus || '');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  useEffect(() => {
    if (!listingId) {
      navigate('/marketplace');
      return;
    }

    const fetchListing = async () => {
      // Mock Data Bypass
      if (listingId.startsWith('l-') || listingId.startsWith('mock-')) {
        const mockListing = {
          id: listingId,
          title: "Mock Premium Item",
          price: "45000",
          seller_name: "Mock Seller",
          image_url: "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800&auto=format&fit=crop"
        };
        setListing(mockListing);
        setAgreedPrice(mockListing.price);
        setLoading(false);
        return;
      }

      try {
        const res = await api.get(`/marketplace/listings/${listingId}`);
        if (res.data.success) {
          setListing(res.data.listing);
          setAgreedPrice(res.data.listing.price.toString());
        }
      } catch (err) {
        console.error('Failed to fetch listing:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [listingId]);

  const handlePlaceOrder = async () => {
    if (!listing || !agreedPrice) return;
    setPlacing(true);

    // Mock Submission Bypass
    if (listingId && (listingId.startsWith('l-') || listingId.startsWith('mock-'))) {
      setTimeout(() => {
        setSuccess(true);
        setPlacing(false);
        setTimeout(() => navigate('/marketplace/orders'), 2000);
      }, 1500);
      return;
    }

    try {
      const res = await api.post('/marketplace/order', {
        listingId,
        agreedPrice: parseFloat(agreedPrice),
        message,
        campus,
        location,
        scheduledTime
      });

      if (res.data.success) {
        setSuccess(true);
        setTimeout(() => navigate('/marketplace/orders'), 2000);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-[#1877F2] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!listing) return null;

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <div className="bg-white sticky top-0 z-50 border-b border-slate-100 px-4 h-16 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-slate-50 rounded-full transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h1 className="font-black text-xl text-black tracking-tight">Confirm Order</h1>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6">
        {/* Item Summary */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-6">
          <div className="flex gap-4">
            <img 
              src={listing.media_url || listing.image_url || listing.thumbnail || '/uploads/marketplace/default.png'} 
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

        {/* Order Details */}
        <div className="space-y-6">
          {/* Price Confirmation */}
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
          </div>

          {/* Location Details */}
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
                    type="text"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    placeholder="e.g. Tomorrow at 2 PM"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-4 font-bold text-black focus:ring-2 ring-blue-500/20 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Safety Notice */}
          <div className="bg-blue-50/50 border border-blue-100 rounded-3xl p-6 flex gap-4">
            <ShieldCheck className="text-[#1877F2] flex-shrink-0" size={24} />
            <div>
              <h4 className="font-bold text-black mb-1">Sparkle Protection</h4>
              <p className="text-black text-sm leading-relaxed">
                By placing this order, Sparkle creates a secure transaction record. Only pay the seller after you've inspected the item and are satisfied.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <button 
            onClick={handlePlaceOrder}
            disabled={placing || success || !location}
            className={`w-full py-5 rounded-3xl font-black text-lg shadow-xl transition-all active:scale-[0.98] ${
              success 
                ? 'bg-emerald-500 text-white shadow-emerald-200' 
                : 'bg-black text-white shadow-slate-200 hover:bg-black/80 disabled:opacity-50'
            }`}
          >
            {success ? (
              <div className="flex items-center justify-center gap-2">
                <CheckCircle2 size={24} /> Order Confirmed!
              </div>
            ) : placing ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </div>
            ) : (
              'Confirm Purchase'
            )}
          </button>

          {!location && !success && (
            <p className="text-center text-xs font-bold text-black uppercase tracking-widest">
              Please enter a specific meetup location
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
