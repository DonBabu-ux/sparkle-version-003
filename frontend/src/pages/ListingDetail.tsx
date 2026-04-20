import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { ChevronLeft, Share2, Heart, MessageCircle, MapPin, ShieldCheck, Star } from 'lucide-react';
import type { Listing, Review } from '../types/listing';

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUserStore();

  const [listing, setListing] = useState<Listing | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const response = await api.get(`/marketplace/listings/${id}`);
        if (response.data.success) {
          setListing(response.data.listing);
          setReviews(response.data.reviews || []);
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
    try {
      const res = await api.post(`/marketplace/listings/${id}/contact`, {
        sellerId: listing.seller_id,
        message: `Hi, I'm interested in your ${listing.title}!`
      });
      if (res.data.success) {
        navigate(`/messages?chat=${res.data.chatId}`);
      }
    } catch (err) {
      console.error('Contact failed:', err);
    }
  };

  if (loading) return (
    <div className="h-screen bg-[#FAFAFA] flex items-center justify-center">
       <div className="w-12 h-12 border-4 border-[#FF3D6D] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!listing) return null;

  const media = listing.media || [];
  const isOwner = user?.id === listing.seller_id;

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-20">
      <Navbar />

      <main className="max-w-[1240px] mx-auto px-6 py-10">
        {/* Navigation / Actions Header */}
        <div className="flex justify-between items-center mb-8">
          <button 
            onClick={() => navigate(-1)} 
            className="group flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-[#FF3D6D] transition-colors"
          >
            <div className="p-2 rounded-full bg-white shadow-sm border border-slate-100 group-hover:border-[#FF3D6D]/30">
                <ChevronLeft size={20} />
            </div>
            Back to Marketplace
          </button>
          
          <div className="flex gap-3">
             <button className="p-3 rounded-2xl bg-white shadow-sm border border-slate-100 text-slate-500 hover:text-[#FF3D6D] transition-all">
                <Share2 size={20} />
             </button>
             <button 
                onClick={handleWishlist}
                className={`p-3 rounded-2xl shadow-sm border border-slate-100 transition-all ${isWishlisted ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-white text-slate-500 hover:text-[#FF3D6D]'}`}
             >
                <Heart size={20} fill={isWishlisted ? "currentColor" : "none"} />
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Gallery Section */}
          <div className="space-y-6">
             <div className="aspect-[4/5] bg-white rounded-[2.5rem] overflow-hidden shadow-2xl relative border border-white group">
                <img 
                  src={media[activeImage]?.media_url || listing.image_url || '/uploads/marketplace/default.png'} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                  alt="" 
                />
                
                <div className="absolute bottom-6 left-6 right-6 p-4 glass-morphism rounded-2xl flex justify-between items-center backdrop-blur-xl">
                    <div className="flex gap-2">
                        <span className="px-3 py-1 bg-[#FF3D6D] text-white text-[10px] font-black rounded-full uppercase tracking-widest">{listing.condition}</span>
                        <span className="px-3 py-1 bg-white/20 text-white text-[10px] font-black rounded-full uppercase tracking-widest backdrop-blur-md">{listing.category}</span>
                    </div>
                    <div className="text-white font-black text-xl">
                        ${parseFloat(listing.price).toLocaleString()}
                    </div>
                </div>
             </div>
             
             {media.length > 1 && (
               <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar">
                  {media.map((m: { media_url: string }, idx: number) => (
                    <button 
                      key={idx}
                      onClick={() => setActiveImage(idx)}
                      className={`w-28 h-28 flex-shrink-0 rounded-[1.5rem] overflow-hidden border-4 transition-all duration-300 ${
                        activeImage === idx ? 'border-[#FF3D6D] scale-95 shadow-xl' : 'border-white hover:border-slate-200'
                      }`}
                    >
                       <img src={m.media_url} className="w-full h-full object-cover" alt="" />
                    </button>
                  ))}
               </div>
             )}
          </div>

          {/* Details Section */}
          <div className="flex flex-col gap-6">
             <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-white/50 relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#FF3D6D]/5 rounded-full blur-3xl"></div>
                
                <div className="flex items-center gap-2 mb-4 text-[#FF3D6D] font-bold text-xs">
                    <MapPin size={14} />
                    <span>{listing.campus || 'Global Marketplace'}</span>
                </div>

                <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-4 leading-tight">{listing.title}</h1>
                
                <div className="flex items-center gap-4 mb-8">
                    <p className="text-5xl font-black text-[#FF3D6D] tracking-tighter">${parseFloat(listing.price).toLocaleString()}</p>
                    <span className="text-slate-400 font-bold line-through text-xl opacity-50">${(parseFloat(listing.price) * 1.2).toFixed(0)}</span>
                </div>

                <div className="space-y-6 mb-10">
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Specifications</h3>
                        <p className="text-slate-600 font-medium leading-relaxed">{listing.description || 'No detailed specifications provided.'}</p>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                   {isOwner ? (
                       <button 
                        onClick={() => navigate(`/marketplace/edit/${id}`)}
                        className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-bold text-sm uppercase tracking-widest hover:bg-[#FF3D6D] transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3"
                       >
                         Manage Artifact
                       </button>
                   ) : (
                       <>
                        <button 
                            onClick={handleContact}
                            className="w-full py-5 bg-[#FF3D6D] text-white rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-[#FF3D6D]/20 active:scale-95 flex items-center justify-center gap-3"
                        >
                            <MessageCircle size={18} />
                            Contact Seller
                        </button>
                        <button className="w-full py-5 border-2 border-slate-100 text-slate-500 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:border-[#FF3D6D] hover:text-[#FF3D6D] transition-all active:scale-95">
                            Make an Offer
                        </button>
                       </>
                   )}
                </div>
             </div>

             {/* Seller Badge */}
             <div className="bg-white rounded-[2rem] p-6 border border-white shadow-lg flex items-center gap-5 transition-transform hover:scale-[1.02] cursor-pointer" onClick={() => navigate(`/marketplace/seller/${listing.seller_id}`)}>
                <div className="relative">
                    <img src={listing.seller_avatar || '/uploads/avatars/default.png'} className="w-16 h-16 rounded-[1.2rem] object-cover ring-4 ring-slate-50" alt="" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center text-white">
                        <ShieldCheck size={12} />
                    </div>
                </div>
                <div className="flex-1">
                   <div className="flex items-center gap-2">
                       <h3 className="font-black text-slate-800 text-lg m-0">{listing.seller_name || listing.seller_username}</h3>
                       <span className="flex items-center text-amber-500 text-xs font-bold gap-0.5">
                           <Star size={12} fill="currentColor" /> 4.9
                       </span>
                   </div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight mt-0.5">Verified Elite Merchant</p>
                </div>
                <ChevronLeft size={20} className="text-slate-300 rotate-180" />
             </div>
          </div>
        </div>

        {/* Similar Items or Reviews */}
        <div className="mt-20">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-10 flex items-center gap-4">
                Feedback Archive
                <span className="bg-[#FF3D6D]/10 text-[#FF3D6D] text-[10px] px-3 py-1 rounded-full font-black">{reviews.length} RECORDS</span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {reviews.length > 0 ? reviews.map((review, idx) => (
                <div key={idx} className="bg-white p-8 rounded-[2rem] border border-white shadow-md hover:shadow-xl transition-shadow group">
                   <div className="flex items-center gap-4 mb-4">
                      <img src={review.avatar_url || '/uploads/avatars/default.png'} className="w-12 h-12 rounded-xl object-cover ring-2 ring-slate-50" alt="" />
                      <div>
                         <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight">{review.reviewer_name}</h4>
                         <div className="flex gap-0.5 text-amber-400 mt-0.5">
                             {[...Array(5)].map((_, i) => <Star key={i} size={10} fill={i < (review.rating || 5) ? "currentColor" : "none"} />)}
                         </div>
                      </div>
                   </div>
                   <p className="text-sm text-slate-500 font-medium leading-relaxed group-hover:text-slate-700 transition-colors">"{review.review_text}"</p>
                </div>
              )) : (
                <div className="col-span-full py-16 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center gap-3">
                   <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                        <MessageCircle size={32} />
                   </div>
                   <p className="text-xs font-black text-slate-300 uppercase tracking-widest m-0">No merchant correspondence yet.</p>
                </div>
              )}
            </div>
        </div>
      </main>
    </div>
  );
}
