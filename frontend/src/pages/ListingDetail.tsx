import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { useMarketplaceStore } from '../store/marketplaceStore';
import api from '../api/api';
import { ChevronLeft, Share2, Heart, MessageCircle, MapPin, Search, MoreHorizontal, Bell, Send, UserPlus, FileWarning, ArrowLeft, Bookmark, CornerUpRight, ShieldCheck } from 'lucide-react';
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
  const [suggestedGroups, setSuggestedGroups] = useState<any[]>([]);
  const [suggestedListings, setSuggestedListings] = useState<Listing[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch main listing
        try {
          const listingRes = await api.get(`/marketplace/listings/${id}`);
          if (listingRes.data.success) {
            setListing(listingRes.data.listing);
            setIsWishlisted(listingRes.data.listing.is_wishlisted);
          }
        } catch (err: any) {
          if (err.response?.status === 404 && String(id).startsWith('l-')) {
            // Fallback for mock data
            setListing({
              listing_id: id,
              id: id,
              seller_id: 'mock-seller',
              seller_name: 'Mock Seller',
              title: 'Mock Listing ' + id,
              price: 1500,
              description: 'This is a mocked listing.',
              created_at: new Date().toISOString()
            } as any);
          } else {
            throw err;
          }
        }

        // 2. Fetch suggested groups (limit to 3)
        const groupsRes = await api.get('/groups');
        const groups = Array.isArray(groupsRes.data) ? groupsRes.data : (groupsRes.data.initialGroups || []);
        setSuggestedGroups(groups.filter((g: any) => g.category !== 'general').slice(0, 3));

        // 3. Fetch suggested for you (random listings)
        const suggestedRes = await api.get('/marketplace/listings?limit=4');
        const sugList = suggestedRes.data.listings || suggestedRes.data.data || (Array.isArray(suggestedRes.data) ? suggestedRes.data : []);
        setSuggestedListings(sugList.filter((l: Listing) => l.listing_id !== id).slice(0, 4));

      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const setActiveModal = useMarketplaceStore(state => state.setActiveModal);
  const setSelectedListing = useMarketplaceStore(state => state.setSelectedListing);

  const handleOffer = () => {
    if (!listing) return;
    setSelectedListing(listing);
    setActiveModal('offer');
  };

  const handleAlert = () => {
    alert("You'll be notified when similar items are listed!");
  };

  const handleShare = async () => {
    if (!listing) return;
    setSelectedListing(listing);
    setActiveModal('share');
  };

  const handleMore = () => {
    if (!listing) return;
    setSelectedListing(listing);
    setActiveModal('more');
  };

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
      // Create or get conversation
      const res = await api.post('/marketplace/conversations', {
        seller_id: listing.seller_id,
        listing_id: id
      });
      const convId = res.data.id;
      
      // Navigate to the conversation thread and pass the initial message
      if (convId) {
        navigate(`/marketplace/messages/${convId}`, { state: { initialMessage: message } });
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
    <div className="flex flex-col bg-white min-h-screen text-marketplace-text font-sans pb-20 max-w-screen-md mx-auto shadow-sm">
      
      {/* 1. Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-marketplace-border px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-marketplace-text hover:bg-marketplace-bg rounded-full transition-colors">
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          <h1 className="text-[20px] font-bold text-marketplace-text tracking-tight capitalize">{listing.title}</h1>
        </div>
        <button className="p-1 text-marketplace-text">
          <Search size={22} strokeWidth={2.5} />
        </button>
      </header>

      {/* 2. Media Gallery */}
      <div className="relative bg-marketplace-bg aspect-square w-full">
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
        <h2 className="text-[22px] font-bold text-marketplace-text leading-tight capitalize">{listing.title}</h2>
        <p className="text-[17px] font-semibold text-marketplace-text">KES{parseFloat(listing.price as string).toLocaleString()}</p>
        <p className="text-[13px] text-marketplace-muted pt-1">Listed {timeAgo(listing.created_at)} in {listing.location_name || listing.campus || 'Sparkle Global'}</p>
      </div>

      <div className="px-4 pb-4">
        <h3 className="text-[17px] font-bold mb-2">Description</h3>
        <p className="text-[15px] text-slate-700 whitespace-pre-wrap leading-relaxed">
          {listing.description || "No description provided."}
        </p>
      </div>

      <div className="mx-4 mb-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
        <div className="flex items-center gap-3 mb-2">
            <ShieldCheck size={20} className="text-[#1877F2]" />
            <h3 className="text-[15px] font-bold text-[#1877F2]">Sparkle Safety Checklist</h3>
        </div>
        <ul className="text-[13px] text-slate-600 space-y-1.5 list-disc list-inside">
            <li>Always meet in a safe, public campus location.</li>
            <li>Inspect the item thoroughly before paying.</li>
            <li>Don't send money via phone before seeing the item.</li>
            <li>Report suspicious behavior via <Link to="/support" className="text-[#1877F2] font-semibold hover:underline">Support Portal</Link>.</li>
        </ul>
      </div>

      <hr className="border-marketplace-border mx-4" />

      {/* 4. Message Box */}
      {!isOwner && (
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle size={20} className="fill-[#1877F2] text-[#1877F2]" />
            <h3 className="font-bold text-[17px]">Send seller a message</h3>
          </div>
          <div className="bg-marketplace-bg rounded-lg p-3 mb-3 flex items-center">
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
        <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={handleOffer}>
          <div className="w-12 h-12 rounded-full bg-marketplace-bg flex items-center justify-center">
            <CornerUpRight size={22} className="text-marketplace-text -scale-x-100" />
          </div>
          <span className="text-[11px] font-medium">Send offer</span>
        </div>
        <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={handleAlert}>
          <div className="w-12 h-12 rounded-full bg-marketplace-bg flex items-center justify-center">
            <Bell size={22} className="text-marketplace-text" />
          </div>
          <span className="text-[11px] font-medium">Alert</span>
        </div>
        <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={handleContact}>
          <div className="w-12 h-12 rounded-full bg-marketplace-bg flex items-center justify-center">
            <MessageCircle size={22} className="text-marketplace-text" />
          </div>
          <span className="text-[11px] font-medium">Message</span>
        </div>
        <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={handleWishlist}>
          <div className="w-12 h-12 rounded-full bg-marketplace-bg flex items-center justify-center">
            <Bookmark size={22} className="text-marketplace-text" fill={isWishlisted ? "currentColor" : "none"} />
          </div>
          <span className="text-[11px] font-medium">Save</span>
        </div>
        <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={handleShare}>
          <div className="w-12 h-12 rounded-full bg-marketplace-bg flex items-center justify-center">
            <Share2 size={22} className="text-marketplace-text" />
          </div>
          <span className="text-[11px] font-medium">Share</span>
        </div>
        <div className="flex flex-col items-center gap-1 cursor-pointer" onClick={handleMore}>
          <div className="w-12 h-12 rounded-full bg-marketplace-bg flex items-center justify-center">
            <MoreHorizontal size={22} className="text-marketplace-text" />
          </div>
          <span className="text-[11px] font-medium">More</span>
        </div>
      </div>

      <hr className="border-marketplace-border mt-2 mb-4" />

      {/* 6. Seller Information */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[17px] font-bold">Seller information</h3>
          <span
            className="text-[#1877F2] text-[15px] cursor-pointer hover:underline"
            onClick={() => navigate(`/marketplace/seller/${listing.seller_id}`)}
          >Seller details</span>
        </div>

        <div className="flex items-center justify-between mb-4 cursor-pointer" onClick={() => navigate(`/marketplace/seller/${listing.seller_id}`)}>
          <div className="flex items-center gap-3">
            <img src={listing.seller_avatar || '/uploads/avatars/default.png'} className="w-12 h-12 rounded-full object-cover border border-marketplace-border" alt={listing.seller_name} />
            <div>
              <h4 className="font-bold text-[15px] text-marketplace-text">{listing.seller_name || listing.seller_username}</h4>
              <p className="text-[13px] text-marketplace-muted">Joined Sparkle in 2026</p>
            </div>
          </div>
          <button className="flex items-center gap-1 px-4 py-1.5 bg-marketplace-bg hover:bg-slate-200 transition-colors rounded-lg font-bold text-[14px]">
            <UserPlus size={16} className="text-marketplace-text" />
            Follow
          </button>
        </div>
      </div>

      {/* 7. Map Placeholder */}
      <div className="px-4 pb-4">
        <div className="w-full h-32 bg-green-50 rounded-lg overflow-hidden relative border border-marketplace-border">
          <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'url(https://maps.wikimedia.org/osm-intl/13/4825/3155.png)', backgroundSize: 'cover' }}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-[#1877F2]/20 border-2 border-[#1877F2]/50 rounded-full flex items-center justify-center">
            <div className="w-3 h-3 bg-[#1877F2] rounded-full"></div>
          </div>
        </div>
      </div>

      <hr className="border-marketplace-border mt-2 mb-4" />

      {/* 8. Suggested Groups */}
      {suggestedGroups.length > 0 && (
        <div className="px-4 pb-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[17px] font-bold text-marketplace-text">Suggested buy and sell groups</h3>
            <Link to="/groups" className="text-[#1877F2] text-[15px] font-semibold">See all</Link>
          </div>
          
          <div className="space-y-4">
            {suggestedGroups.map((group) => (
              <div key={group.group_id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded bg-marketplace-bg overflow-hidden">
                    <img src={group.icon_url || '/uploads/groups/default.png'} className="w-full h-full object-cover" alt={group.name} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-[15px] text-marketplace-text line-clamp-1 leading-tight">{group.name}</h4>
                    <p className="text-[13px] text-marketplace-muted mt-0.5">{group.member_count || '0'} members</p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate(`/groups/${group.group_id}`)}
                  className="px-4 py-1.5 border border-marketplace-border text-[#1877F2] rounded font-bold text-[14px] ml-2"
                >
                  JOIN
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <hr className="border-marketplace-border my-4" />

      {/* 9. Suggested for you */}
      {suggestedListings.length > 0 && (
        <div className="px-4">
          <h3 className="text-[17px] font-bold text-marketplace-text">Suggested for you</h3>
          <p className="text-[13px] text-marketplace-muted mb-4">Sponsored</p>
          
          <div className="grid grid-cols-2 gap-4">
            {suggestedListings.map((item) => (
              <div 
                key={item.listing_id} 
                className="flex flex-col cursor-pointer"
                onClick={() => navigate(`/marketplace/listings/${item.listing_id}`)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-marketplace-bg overflow-hidden">
                    <img src={item.seller_avatar || '/uploads/avatars/default.png'} className="w-full h-full object-cover" alt="" />
                  </div>
                  <span className="text-[13px] font-bold text-marketplace-text truncate">{item.seller_name || item.seller_username}</span>
                  <MoreHorizontal size={14} className="text-marketplace-muted ml-auto" />
                </div>
                <div className="aspect-square bg-marketplace-bg rounded-lg overflow-hidden relative">
                  <img src={item.image_url || '/uploads/marketplace/default.png'} className="w-full h-full object-cover" alt={item.title} />
                </div>
                <p className="text-[14px] font-bold text-marketplace-text mt-2 leading-tight">KES{parseFloat(item.price as string).toLocaleString()}</p>
                <p className="text-[14px] font-medium text-marketplace-text mt-1 truncate">{item.title}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
