import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import { ChevronLeft, Share2, Heart, MessageCircle, MapPin, Search, MoreHorizontal, Bell, Send, UserPlus, FileWarning, ArrowLeft, Bookmark, CornerUpRight } from 'lucide-react';
import { getAvatarUrl } from '../utils/imageUtils';
import { timeAgo } from '../utils/format';
import type { Listing } from '../types/listing';

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUserStore();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [message, setMessage] = useState("Is this still available?");

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const response = await api.get(`/marketplace/listings/${id}`);
        if (response.data.success) {
          setListing(response.data.listing);
          setIsWishlisted(response.data.listing.is_wishlisted);
        }
      } catch (err) {
        console.error('Failed to fetch listing:', err);
        navigate('/marketplace');
      } finally {
        setLoading(false);
      }
    };
    fetchListing();
  }, [id, navigate]);

  const handleWishlist = async () => {
    try {
      const res = await api.post(`/marketplace/listings/${id}/wishlist`);
      if (res.data.success) {
        setIsWishlisted(!isWishlisted);
      }
    } catch (err) {
      console.error('Wishlist toggle failed:', err);
    }
  };

  const handleContact = async () => {
    if (!listing) return;
    try {
      const res = await api.post(`/marketplace/listings/${id}/contact`, {
        sellerId: listing.seller_id,
        message: message
      });
      if (res.data.success) {
        navigate(`/messages/${listing.seller_id}?chat=${res.data.chatId}`);
      }
    } catch (err) {
      console.error('Contact failed:', err);
    }
  };

  if (loading) return (
    <div className="flex bg-white min-h-screen text-slate-900 justify-center items-center">
      <div className="w-8 h-8 border-4 border-[#1877F2] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!listing) return null;

  const media = listing.media || [];
  const isOwner = user?.id === listing.seller_id;
  const timeString = timeAgo(listing.created_at) || 'an hour ago';

  return (
    <div className="flex flex-col bg-white min-h-screen text-slate-900 font-sans pb-20 max-w-screen-md mx-auto shadow-sm">
      
      {/* 1. Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1 text-slate-900">
            <ArrowLeft size={24} strokeWidth={2.5} />
          </button>
          <h1 className="text-[20px] font-bold text-slate-900 tracking-tight capitalize">{listing.title}</h1>
        </div>
        <button className="p-1 text-slate-900">
          <Search size={22} strokeWidth={2.5} />
        </button>
      </header>

      {/* 2. Media Gallery */}
      <div className="relative bg-slate-100 aspect-square w-full">
        <img 
          src={media[activeImage]?.media_url || listing.image_url || '/uploads/marketplace/default.png'} 
          className="w-full h-full object-cover" 
          alt={listing.title} 
        />
        {media.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {media.map((_, idx: number) => (
              <div key={idx} className={`w-2 h-2 rounded-full ${idx === activeImage ? 'bg-white' : 'bg-white/50'}`} />
            ))}
          </div>
        )}
      </div>

      {/* 3. Basic Info */}
      <div className="px-4 py-4 space-y-1">
        <h2 className="text-[22px] font-bold text-slate-900 leading-tight capitalize">{listing.title}</h2>
        <p className="text-[17px] font-semibold text-slate-900">KES{parseFloat(listing.price).toLocaleString()}</p>
        <p className="text-[13px] text-slate-500 pt-1">Listed {timeString} in {listing.location_name || listing.campus || 'Kenya'}</p>
      </div>

      <hr className="border-slate-200 mx-4" />

      {/* 4. Message Box */}
      {!isOwner && (
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle size={20} className="fill-[#1877F2] text-[#1877F2]" />
            <h3 className="font-bold text-[17px]">Send seller a message</h3>
          </div>
          <div className="bg-slate-100 rounded-lg p-3 mb-3 flex items-center">
            <input 
              type="text" 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-transparent outline-none text-[15px] font-medium text-slate-800"
            />
          </div>
          <button 
            onClick={handleContact}
            className="w-full bg-[#1877F2] text-white py-2.5 rounded-lg font-bold text-[15px] hover:bg-blue-600 transition-colors"
          >
            Send
          </button>
        </div>
      )}

      {/* 5. Action Icons Row */}
      <div className="px-4 py-3 flex items-center justify-between text-slate-700">
        <div className="flex flex-col items-center gap-1 cursor-pointer">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
            <CornerUpRight size={22} className="text-slate-800 -scale-x-100" />
          </div>
          <span className="text-[11px] font-medium">Send offer</span>
        </div>
        <div className="flex flex-col items-center gap-1 cursor-pointer">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
            <Bell size={22} className="text-slate-800" />
          </div>
          <span className="text-[11px] font-medium">Alert</span>
        </div>
        <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={handleContact}>
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
            <MessageCircle size={22} className="text-slate-800" />
          </div>
          <span className="text-[11px] font-medium">Message</span>
        </div>
        <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={handleWishlist}>
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
            <Bookmark size={22} className="text-slate-800" fill={isWishlisted ? "currentColor" : "none"} />
          </div>
          <span className="text-[11px] font-medium">Save</span>
        </div>
        <div className="flex flex-col items-center gap-1 cursor-pointer">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
            <Share2 size={22} className="text-slate-800" />
          </div>
          <span className="text-[11px] font-medium">Share</span>
        </div>
        <div className="flex flex-col items-center gap-1 cursor-pointer">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
            <MoreHorizontal size={22} className="text-slate-800" />
          </div>
          <span className="text-[11px] font-medium">More</span>
        </div>
      </div>

      <hr className="border-slate-200 mt-2 mb-4" />

      {/* 6. Seller Information */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[17px] font-bold">Seller information</h3>
          <span className="text-[#1877F2] text-[15px] cursor-pointer hover:underline">Seller details</span>
        </div>

        <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => navigate(`/profile/${listing.seller_username}`)}>
          <div className="flex items-center gap-3">
            <img src={listing.seller_avatar || '/uploads/avatars/default.png'} className="w-12 h-12 rounded-full object-cover border border-slate-100" alt={listing.seller_name} />
            <div>
              <h4 className="font-bold text-[15px]">{listing.seller_name || listing.seller_username}</h4>
              <p className="text-[13px] text-slate-500">Joined Sparkle in 2026</p>
            </div>
          </div>
          <button className="flex items-center gap-1 px-4 py-1.5 bg-slate-200 hover:bg-slate-300 transition-colors rounded-lg font-bold text-[14px]">
            <UserPlus size={16} className="text-slate-800" />
            Follow
          </button>
        </div>
      </div>

      {/* 7. Map Placeholder */}
      <div className="px-4 pb-4">
        <div className="w-full h-32 bg-green-100 rounded-lg overflow-hidden relative border border-slate-200">
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'url(https://maps.wikimedia.org/osm-intl/13/4825/3155.png)', backgroundSize: 'cover' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-[#1877F2]/20 border-2 border-[#1877F2]/50 rounded-full flex items-center justify-center">
            <div className="w-3 h-3 bg-[#1877F2] rounded-full"></div>
          </div>
        </div>
      </div>

      <hr className="border-slate-200 mt-2 mb-4" />

      {/* 8. Suggested Groups */}
      <div className="px-4 pb-2">
        <h3 className="text-[17px] font-bold mb-4">Suggested buy and sell groups</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded bg-slate-200 overflow-hidden">
                <img src="/uploads/marketplace/default.png" className="w-full h-full object-cover" alt="" />
              </div>
              <div>
                <h4 className="font-semibold text-[15px] line-clamp-2 leading-tight">modern kitchen designs(cabinets,granite and marble tops)</h4>
                <p className="text-[13px] text-slate-500 mt-0.5">28,902 members</p>
              </div>
            </div>
            <button className="px-4 py-1.5 border border-slate-300 text-[#1877F2] rounded font-bold text-[14px] ml-2">JOIN</button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-xl">
                A
              </div>
              <div>
                <h4 className="font-semibold text-[15px] line-clamp-1 leading-tight">African forum</h4>
                <p className="text-[13px] text-slate-500 mt-0.5">10,598 members</p>
              </div>
            </div>
            <button className="px-4 py-1.5 border border-slate-300 text-[#1877F2] rounded font-bold text-[14px] ml-2">JOIN</button>
          </div>
        </div>

        <button className="w-full flex justify-center text-slate-500 text-[15px] font-medium mt-4 py-2 hover:bg-slate-50 rounded-lg">
          See all <ChevronLeft size={16} className="rotate-180 ml-1" />
        </button>
      </div>

      <hr className="border-slate-200 my-4" />

      {/* 9. Suggested for you */}
      <div className="px-4">
        <h3 className="text-[17px] font-bold">Suggested for you</h3>
        <p className="text-[13px] text-slate-500 mb-4">Sponsored</p>
        
        <div className="grid grid-cols-2 gap-2">
          {/* Mock Sponsored Item 1 */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden">
                <img src="/uploads/marketplace/default.png" className="w-full h-full object-cover" alt="" />
              </div>
              <span className="text-[13px] font-bold truncate">Silicon Savannah Te...</span>
              <MoreHorizontal size={14} className="text-slate-500 ml-auto" />
            </div>
            <div className="aspect-square bg-slate-100 relative">
              <img src="/uploads/marketplace/default.png" className="w-full h-full object-cover" alt="" />
            </div>
            <p className="text-[14px] font-medium mt-1 truncate">ZINGINE MWECHECHE!!</p>
          </div>
          
          {/* Mock Sponsored Item 2 */}
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-slate-200 overflow-hidden">
                <img src="/uploads/marketplace/default.png" className="w-full h-full object-cover" alt="" />
              </div>
              <span className="text-[13px] font-bold truncate">Tablet Shop</span>
              <MoreHorizontal size={14} className="text-slate-500 ml-auto" />
            </div>
            <div className="aspect-square bg-slate-100 relative">
              <img src="/uploads/marketplace/default.png" className="w-full h-full object-cover" alt="" />
            </div>
            <p className="text-[14px] font-medium mt-1 truncate">Tablet Shop</p>
          </div>
        </div>
      </div>

    </div>
  );
}
