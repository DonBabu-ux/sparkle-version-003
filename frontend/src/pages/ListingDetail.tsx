import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  useUserStore();

  
  const [listing, setListing] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
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
    <div className="h-screen bg-slate-50 flex items-center justify-center">
       <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!listing) return null;

  const media = listing.media || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Gallery Section */}
          <div className="lg:col-span-7 space-y-4">
             <div className="aspect-square bg-white rounded-[3rem] overflow-hidden shadow-2xl relative border border-white">
                <img 
                  src={media[activeImage]?.media_url || listing.image_url || '/uploads/marketplace/default.png'} 
                  className="w-full h-full object-cover" 
                  alt="" 
                />
                <button 
                  onClick={handleWishlist}
                  className={`absolute top-6 right-6 w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20 transition-all shadow-xl ${
                    isWishlisted ? 'bg-rose-500 text-white' : 'bg-white/40 text-slate-800 hover:bg-white'
                  }`}
                >
                  {isWishlisted ? '❤️' : '🤍'}
                </button>
             </div>
             
             {media.length > 1 && (
               <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
                  {media.map((m: any, idx: number) => (
                    <button 
                      key={idx}
                      onClick={() => setActiveImage(idx)}
                      className={`w-24 h-24 flex-shrink-0 rounded-[1.5rem] overflow-hidden border-4 transition-all ${
                        activeImage === idx ? 'border-indigo-600 scale-95 shadow-lg' : 'border-white hover:border-slate-200'
                      }`}
                    >
                       <img src={m.media_url} className="w-full h-full object-cover" alt="" />
                    </button>
                  ))}
               </div>
             )}
          </div>

          {/* Details Section */}
          <div className="lg:col-span-5 space-y-8">
             <div className="premium-card bg-white p-10 shadow-2xl shadow-slate-100 border-white">
                <div className="flex items-center gap-3 mb-4">
                   <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">
                     {listing.category}
                   </span>
                   <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full">
                     {listing.condition}
                   </span>
                </div>
                
                <h1 className="text-4xl font-black text-slate-800 tracking-tight mb-2">{listing.title}</h1>
                <p className="text-4xl font-black text-slate-900 mb-8">${listing.price}</p>
                
                <div className="space-y-6 pt-6 border-t border-slate-50">
                   <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resonance</span>
                      <span className="text-xs font-bold text-slate-600">{listing.campus || 'Main Campus'}</span>
                   </div>
                </div>

                <div className="mt-8 space-y-4">
                   <button 
                    onClick={handleContact}
                    className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-2xl shadow-slate-200 active:scale-95"
                   >
                     Initiate Signal
                   </button>
                   <button className="w-full py-5 border border-slate-100 text-slate-400 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:border-slate-200 hover:text-slate-600 transition-all">
                     Offer Reflection
                   </button>
                </div>
             </div>

             {/* Seller Profile */}
             <div className="premium-card bg-white p-8 border-white flex items-center gap-6">
                <img src={listing.seller_avatar || '/uploads/avatars/default.png'} className="w-16 h-16 rounded-[1.5rem] object-cover ring-4 ring-slate-50" alt="" />
                <div className="flex-1">
                   <h3 className="font-black text-slate-800 text-lg">{listing.seller_name || listing.seller_username}</h3>
                   <div className="flex items-center gap-2 mt-1">
                      <span className="text-rose-500">★★★★★</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Level 12 Merchant</span>
                   </div>
                </div>
                <Link to={`/profile/${listing.seller_id}`} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline">Nexus</Link>
             </div>

             {/* Description */}
             <div className="premium-card bg-slate-50 border-none p-8">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Transmission Content</h3>
                <p className="text-slate-600 font-medium leading-relaxed">{listing.description || 'No detailed specifications provided for this artifact.'}</p>
             </div>
          </div>
        </div>

        {/* Reviews Section */}
        <section className="mt-20">
           <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-10 flex items-center gap-4">
             Merchant Reviews
             <span className="bg-slate-200 text-slate-500 text-[10px] px-3 py-1 rounded-full">{reviews.length}</span>
           </h2>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {reviews.length > 0 ? reviews.map((review, idx) => (
                <div key={idx} className="premium-card bg-white p-8 border-white">
                   <div className="flex items-center gap-4 mb-4">
                      <img src={review.avatar_url || '/uploads/avatars/default.png'} className="w-10 h-10 rounded-xl object-cover" alt="" />
                      <div>
                         <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight">{review.reviewer_name}</h4>
                         <span className="text-rose-500 text-[10px]">★★★★★</span>
                      </div>
                   </div>
                   <p className="text-xs text-slate-500 font-medium italic">"{review.review_text}"</p>
                </div>
              )) : (
                <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
                   <p className="text-xs font-black text-slate-300 uppercase tracking-widest">No merchant feedback recorded.</p>
                </div>
              )}
           </div>
        </section>
      </main>
    </div>
  );
}
