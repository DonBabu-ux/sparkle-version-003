import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import { ArrowLeft, Check, Star, AlertCircle, ShoppingBag, Send } from 'lucide-react';

export default function SellerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [seller, setSeller] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('shop');

  useEffect(() => {
    const fetchSeller = async () => {
      try {
        const res = await api.get(`/marketplace/sellers/${id}`);
        setSeller(res.data.seller || res.data);
      } catch (err) {
        console.error('Failed to fetch seller:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSeller();
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col animate-pulse">
       <Navbar />
       <div className="max-w-[1200px] mx-auto p-4 mt-8"><div className="h-40 bg-slate-200 rounded-3xl w-full"></div></div>
    </div>
  );

  if (!seller) return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
       <Navbar />
       <div className="flex-1 flex items-center justify-center text-slate-400 font-bold flex-col gap-4">
         <AlertCircle size={48} />
         Seller not found.
         <button onClick={() => navigate('/marketplace')} className="mt-4 px-6 py-2 bg-[#FF3D6D] text-white rounded-full">Back to Market</button>
       </div>
    </div>
  );

  const isOwner = user?.id === seller.user_id || user?.user_id === seller.user_id;

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="max-w-[1200px] mx-auto p-4 pb-32 lg:py-8">
        {/* Header / Back */}
        <div className="bg-white/80 backdrop-blur-md mb-8 flex items-center justify-between p-4 px-6 rounded-full border border-slate-100 shadow-sm">
            <button onClick={() => navigate('/marketplace')} className="flex items-center gap-2 font-bold text-sm text-slate-600 hover:text-[#FF3D6D] transition-colors">
                <ArrowLeft size={16} /> Back to Market
            </button>
            <div className="font-extrabold text-[13px] text-slate-400 uppercase tracking-widest">
                Marketplace Profile
            </div>
        </div>

        {/* Profile Hero Section */}
        <div className="bg-white p-10 rounded-[32px] mb-10 border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-[#FF3D6D]/10 to-[#FF8E53]/10"></div>
            
            <div className="flex flex-col items-center text-center gap-5 relative z-10">
                <div className="relative">
                    <img src={seller.avatar_url || '/uploads/avatars/default.png'} alt=""
                         className="w-32 h-32 rounded-full border-[6px] border-white shadow-xl object-cover" />
                    {seller.is_verified && (
                        <div className="absolute bottom-1 right-1 bg-emerald-500 text-white w-8 h-8 rounded-full flex items-center justify-center border-[3px] border-white shadow-sm">
                            <Check size={14} strokeWidth={3} />
                        </div>
                    )}
                </div>
                
                <div>
                    <h1 className="font-extrabold text-3xl m-0 text-[#111]">{seller.name || seller.username}</h1>
                    <p className="text-slate-500 font-bold mt-1 text-sm">@{seller.username} • Using Sparkle since {new Date(seller.created_at || Date.now()).getFullYear()}</p>
                </div>

                <div className="flex gap-10 mt-2">
                    <div className="text-center">
                        <div className="text-2xl font-black text-[#FF3D6D]">{seller.active_listings || seller.listings?.length || 0}</div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold mt-1">Active Listings</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-black text-amber-500 flex items-center justify-center gap-1">
                            {seller.average_rating ? Number(seller.average_rating).toFixed(1) : '—'}
                            <Star size={16} className="fill-amber-500 text-amber-500" />
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-extrabold mt-1">{seller.total_reviews || 0} Reviews</div>
                    </div>
                </div>

                {!isOwner && (
                    <button onClick={() => navigate(`/messages?chat=${seller.user_id}`)} className="mt-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-[#FF3D6D] to-[#FF8E53] text-white font-black text-[15px] flex items-center gap-2 shadow-lg shadow-[#FF3D6D]/20 hover:-translate-y-1 hover:shadow-xl transition-all">
                        <Send size={18} /> Contact Seller
                    </button>
                )}
            </div>
        </div>

        {/* Content Tabs */}
        <div className="flex gap-8 border-b-2 border-slate-200 mb-8 overflow-x-auto hide-scrollbar">
            <button 
               onClick={() => setActiveTab('shop')} 
               className={`pb-4 px-4 font-extrabold text-[15px] transition-colors whitespace-nowrap border-b-4 ${activeTab === 'shop' ? 'border-[#FF3D6D] text-[#FF3D6D]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
                Shop ({seller.listings?.length || 0})
            </button>
            <button 
               onClick={() => setActiveTab('reviews')} 
               className={`pb-4 px-4 font-extrabold text-[15px] transition-colors whitespace-nowrap border-b-4 ${activeTab === 'reviews' ? 'border-[#FF3D6D] text-[#FF3D6D]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
                Reviews
            </button>
            {isOwner && (
                <button 
                  onClick={() => setActiveTab('dashboard')} 
                  className={`pb-4 px-4 font-extrabold text-[15px] transition-colors whitespace-nowrap border-b-4 ${activeTab === 'dashboard' ? 'border-[#FF3D6D] text-[#FF3D6D]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Dashboard
                </button>
            )}
        </div>

        {/* Listings Section */}
        {activeTab === 'shop' && (
            <div>
                {seller.listings && seller.listings.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {seller.listings.map((listing: any) => (
                            <div key={listing.listing_id} onClick={() => navigate(`/marketplace/listings/${listing.listing_id}`)} className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm cursor-pointer hover:-translate-y-2 hover:shadow-xl transition-all group">
                                <div className="h-[200px] overflow-hidden bg-slate-100 relative">
                                    <img src={listing.image_url || '/uploads/defaults/no-image.png'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                                </div>
                                <div className="p-5">
                                    <h4 className="m-0 text-[15px] font-extrabold text-[#111] line-clamp-1">{listing.title}</h4>
                                    <div className="font-black text-[#FF3D6D] mt-2">KES {parseFloat(listing.price).toLocaleString()}</div>
                                    <div className="text-xs font-bold text-slate-400 mt-2 flex items-center gap-1.5 uppercase tracking-wide">
                                        {listing.campus || 'Main Campus'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center p-20 text-slate-400 font-bold bg-white rounded-3xl border border-slate-100 border-dashed">
                        <ShoppingBag size={48} className="mx-auto mb-4 opacity-30" />
                        This seller has no active listings.
                    </div>
                )}
            </div>
        )}

        {/* Reviews Section */}
        {activeTab === 'reviews' && (
            <div className="max-w-[800px] mx-auto">
                {seller.reviews && seller.reviews.length > 0 ? (
                    <div className="flex flex-col gap-5">
                        {seller.reviews.map((rv: any, i: number) => (
                            <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-4">
                                        <img src={rv.reviewer_avatar || '/uploads/avatars/default.png'} className="w-12 h-12 rounded-full object-cover border border-slate-100" />
                                        <div>
                                            <div className="font-extrabold text-[#111]">{rv.reviewer_name}</div>
                                            <div className="text-xs font-bold text-slate-400">{new Date(rv.created_at).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    <div className="flex text-amber-500 gap-1">
                                        {[...Array(5)].map((_, index) => (
                                            <Star key={index} size={14} className={index < rv.rating ? 'fill-amber-500' : 'text-slate-200'} />
                                        ))}
                                    </div>
                                </div>
                                <p className="m-0 text-slate-600 font-medium leading-relaxed">{rv.comment}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center p-20 text-slate-400 font-bold bg-white rounded-3xl border border-slate-100 border-dashed">
                        <Star size={48} className="mx-auto mb-4 opacity-30" />
                        No reviews received yet.
                    </div>
                )}
            </div>
        )}

        {/* Dashboard Section */}
        {activeTab === 'dashboard' && isOwner && (
            <div className="max-w-[800px] mx-auto bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="font-extrabold text-xl mb-6 text-[#111]">Marketplace Settings</h3>
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                            <div className="font-bold text-[#111]">Seller Status</div>
                            <div className="text-xs text-slate-500 font-medium mt-1">Enable or disable your marketplace storefront.</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" defaultChecked />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                    </div>
                    
                    <div className="flex justify-between items-center p-5 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                            <div className="font-bold text-[#111]">Marketplace Notifications</div>
                            <div className="text-xs text-slate-500 font-medium mt-1">Get notified about inquiries and reviews.</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" defaultChecked />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FF3D6D]"></div>
                        </label>
                    </div>
                </div>
            </div>
        )}
      </div>
      
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
