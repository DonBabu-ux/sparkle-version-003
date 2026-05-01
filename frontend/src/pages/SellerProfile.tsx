import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Check, Star, AlertCircle, ShoppingBag, 
  Send, Share2, MoreHorizontal, ShieldCheck, 
  Calendar, MapPin, MessageSquare, Award, ExternalLink
} from 'lucide-react';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface Seller {
  user_id: string;
  username: string;
  name?: string;
  avatar_url?: string;
  bio?: string;
  location?: string;
  listings?: any[];
  reviews?: any[];
  created_at?: string;
  is_verified?: boolean;
  average_rating?: string | number;
  total_reviews?: number;
}

export default function SellerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('shop');

  const fetchSeller = useCallback(async () => {
    try {
      const res = await api.get(`/marketplace/sellers/${id}`);
      setSeller(res.data.seller || res.data);
    } catch (err) {
      console.error('Failed to fetch seller:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSeller();
  }, [fetchSeller]);

  const handleReply = async (reviewId: string, replyText: string) => {
    try {
      const res = await api.post(`/marketplace/reviews/${reviewId}/reply`, { reply: replyText });
      if (res.data.success) {
        setSeller(prev => prev ? {
          ...prev,
          reviews: prev.reviews?.map((r: { id: string }) => r.id === reviewId ? { ...r, reply: replyText } : r)
        } : null);
      }
    } catch (err) {
      console.error('Reply failed:', err);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center">
       <div className="w-12 h-12 border-4 border-marketplace-bg border-t-marketplace-text rounded-full animate-spin" />
    </div>
  );

  if (!seller) return (
    <div className="min-h-screen bg-white flex flex-col">
       <div className="flex-1 flex items-center justify-center text-marketplace-muted font-bold flex-col gap-4">
         <AlertCircle size={48} className="text-marketplace-muted/30" />
         <p className="text-lg">Seller not found</p>
         <button onClick={() => navigate('/marketplace')} className="mt-4 px-8 py-3 bg-marketplace-text text-white rounded-full font-bold">
           Back to Marketplace
         </button>
       </div>
    </div>
  );

  const isOwner = user?.id === seller.user_id || user?.user_id === seller.user_id;

  return (
    <div className="min-h-screen bg-white text-marketplace-text font-sans pb-20">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-marketplace-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-marketplace-text hover:bg-marketplace-bg rounded-full transition-colors">
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          <h1 className="text-[18px] font-black tracking-tight">Seller Profile</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="w-10 h-10 flex items-center justify-center text-marketplace-text hover:bg-marketplace-bg rounded-full transition-colors">
            <Share2 size={20} />
          </button>
          <button className="w-10 h-10 flex items-center justify-center text-marketplace-text hover:bg-marketplace-bg rounded-full transition-colors">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative">
        <div className="h-48 sm:h-64 bg-gradient-to-br from-slate-900 to-slate-800 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent" />
          </div>
        </div>
        
        <div className="max-w-5xl mx-auto px-4">
          <div className="relative -mt-16 sm:-mt-24 mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-6">
              <div className="relative group">
                <img 
                  src={seller.avatar_url || '/uploads/avatars/default.png'} 
                  alt={seller.username}
                  className="w-32 h-32 sm:w-44 sm:h-44 rounded-3xl border-[6px] border-white shadow-2xl object-cover bg-white"
                />
                {seller.is_verified && (
                  <div className="absolute -bottom-2 -right-2 bg-[#1877F2] text-white w-10 h-10 rounded-2xl flex items-center justify-center border-4 border-white shadow-lg">
                    <Check size={20} strokeWidth={3} />
                  </div>
                )}
              </div>
              
              <div className="text-center sm:text-left pb-2">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-2xl sm:text-4xl font-black tracking-tighter">{seller.name || seller.username}</h2>
                  <ShieldCheck size={24} className="text-blue-500" />
                </div>
                <p className="text-marketplace-muted font-bold text-base sm:text-lg">@{seller.username}</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3">
              {!isOwner ? (
                <>
                  <button onClick={() => navigate(`/messages?chat=${seller.user_id}`)} className="flex-1 sm:flex-none px-8 py-3.5 bg-marketplace-text text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-slate-200 hover:scale-105 transition-all active:scale-95">
                    <MessageSquare size={18} /> Message
                  </button>
                  <button className="p-3.5 bg-marketplace-bg text-marketplace-text rounded-2xl font-black hover:bg-slate-200 transition-all border border-marketplace-border">
                    <Star size={20} />
                  </button>
                </>
              ) : (
                <button onClick={() => navigate('/settings')} className="px-8 py-3.5 bg-marketplace-bg text-marketplace-text border border-marketplace-border rounded-2xl font-black text-sm hover:bg-slate-200 transition-all">
                  Edit Profile
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            <div className="p-6 bg-marketplace-bg border border-marketplace-border rounded-3xl group hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-amber-500">
                  <Star size={20} fill="currentColor" />
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-marketplace-muted">Reliability</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black">{seller.average_rating ? Number(seller.average_rating).toFixed(1) : '5.0'}</span>
                <span className="text-sm font-bold text-marketplace-muted">/ 5.0 rating</span>
              </div>
            </div>

            <div className="p-6 bg-marketplace-bg border border-marketplace-border rounded-3xl group hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-blue-500">
                  <ShoppingBag size={20} />
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-marketplace-muted">Activity</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black">{seller.listings?.length || 0}</span>
                <span className="text-sm font-bold text-marketplace-muted">active listings</span>
              </div>
            </div>

            <div className="p-6 bg-marketplace-bg border border-marketplace-border rounded-3xl group hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm text-purple-500">
                  <Calendar size={20} />
                </div>
                <span className="text-[11px] font-black uppercase tracking-widest text-marketplace-muted">Experience</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black">2024</span>
                <span className="text-sm font-bold text-marketplace-muted">joined sparkle</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4">
        {/* Tabs */}
        <div className="flex gap-2 p-1.5 bg-marketplace-bg rounded-2xl mb-8 w-fit">
          {[
            { id: 'shop', label: 'Storefront', icon: ShoppingBag },
            { id: 'reviews', label: 'Reviews', icon: Award },
            { id: 'about', label: 'About', icon: InfoIcon }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "px-6 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 transition-all",
                activeTab === tab.id 
                  ? "bg-white text-marketplace-text shadow-sm" 
                  : "text-marketplace-muted hover:text-marketplace-text"
              )}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'shop' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {seller.listings && seller.listings.length > 0 ? (
                seller.listings.map((listing) => (
                  <div 
                    key={listing.listing_id} 
                    onClick={() => navigate(`/marketplace/listings/${listing.listing_id}`)} 
                    className="group cursor-pointer"
                  >
                    <div className="aspect-square rounded-3xl overflow-hidden bg-marketplace-bg border border-marketplace-border relative mb-3">
                      <img 
                        src={listing.image_url || '/uploads/marketplace/default.png'} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                        alt="" 
                      />
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 shadow-sm">
                        <span className="text-[12px] font-black">KES {parseFloat(listing.price).toLocaleString()}</span>
                      </div>
                    </div>
                    <h4 className="font-bold text-[15px] line-clamp-1 mb-1">{listing.title}</h4>
                    <div className="flex items-center gap-1.5 text-marketplace-muted text-[11px] font-bold uppercase tracking-wider">
                      <MapPin size={10} />
                      {listing.campus || 'Main Campus'}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-20 flex flex-col items-center justify-center bg-marketplace-bg rounded-[40px] border-2 border-dashed border-marketplace-border text-marketplace-muted">
                  <ShoppingBag size={48} className="mb-4 opacity-20" />
                  <p className="font-black text-lg">No active listings</p>
                  <p className="text-sm font-medium">Check back later for new items.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              {seller.reviews && seller.reviews.length > 0 ? (
                seller.reviews.map((rv, i) => (
                  <div key={i} className="p-6 bg-white border border-marketplace-border rounded-[32px] shadow-sm">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <img src={rv.reviewer_avatar || '/uploads/avatars/default.png'} className="w-12 h-12 rounded-2xl object-cover" />
                        <div>
                          <div className="font-black text-[15px]">{rv.reviewer_name}</div>
                          <div className="text-[11px] font-bold text-marketplace-muted uppercase tracking-widest">
                            {new Date(rv.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-0.5">
                        {[...Array(5)].map((_, index) => (
                          <Star key={index} size={14} className={clsx(index < rv.rating ? 'fill-amber-500 text-amber-500' : 'text-slate-200')} />
                        ))}
                      </div>
                    </div>
                    <p className="text-marketplace-text font-medium leading-relaxed">{rv.comment}</p>
                    
                    {rv.reply && (
                      <div className="mt-4 p-5 bg-marketplace-bg rounded-2xl border-l-4 border-marketplace-text">
                        <div className="text-[10px] font-black text-marketplace-text uppercase tracking-widest mb-2 flex items-center gap-2">
                          <MessageSquare size={12} /> Response from Seller
                        </div>
                        <p className="m-0 text-marketplace-muted text-sm font-medium italic leading-relaxed">"{rv.reply}"</p>
                      </div>
                    )}

                    {isOwner && !rv.reply && (
                      <button 
                        onClick={() => {
                          const reply = window.prompt('Enter your response:');
                          if (reply) handleReply(rv.id || rv.review_id, reply);
                        }}
                        className="mt-4 px-4 py-2 bg-marketplace-bg text-marketplace-text rounded-xl font-black text-[11px] uppercase tracking-wider hover:bg-slate-200 transition-all flex items-center gap-2"
                      >
                        <Send size={12} /> Reply
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-20 flex flex-col items-center justify-center bg-marketplace-bg rounded-[40px] border-2 border-dashed border-marketplace-border text-marketplace-muted">
                  <Award size={48} className="mb-4 opacity-20" />
                  <p className="font-black text-lg">No reviews yet</p>
                  <p className="text-sm font-medium">Ratings will appear once sales are made.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-6">
              <div className="p-8 bg-marketplace-bg border border-marketplace-border rounded-[40px]">
                <h3 className="text-lg font-black mb-4">About the Seller</h3>
                <p className="text-marketplace-text leading-relaxed font-medium">
                  {seller.bio || "This seller hasn't added a bio yet. They are a verified member of the Sparkle community and follow our safe trading guidelines."}
                </p>
                
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-marketplace-border shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-marketplace-muted uppercase tracking-widest">Verification</div>
                      <div className="text-sm font-bold">Email & Phone Verified</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-marketplace-border shadow-sm">
                    <div className="w-10 h-10 rounded-xl bg-green-50 text-green-500 flex items-center justify-center">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] font-black text-marketplace-muted uppercase tracking-widest">Location</div>
                      <div className="text-sm font-bold">{seller.location || 'Nairobi, Kenya'}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-6 bg-slate-900 text-white rounded-[32px] overflow-hidden relative">
                <div className="relative z-10">
                  <h4 className="text-lg font-black mb-1">Trading Safety</h4>
                  <p className="text-white/60 text-sm font-medium">Always meet in public places for transactions.</p>
                </div>
                <button className="relative z-10 px-6 py-2.5 bg-white text-slate-900 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all">
                  Read Guide
                </button>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10" />
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function InfoIcon({ size }: { size: number }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
