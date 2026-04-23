import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { ChevronLeft, Share2, Heart, MessageCircle, MapPin, ShieldCheck, Star, Orbit, ArrowLeft } from 'lucide-react';
import { formatCount } from '../utils/format';
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
    if (!listing) return;
    try {
      const res = await api.post(`/marketplace/listings/${id}/contact`, {
        sellerId: listing.seller_id,
        message: `Hi, I'm interested in your ${listing.title}!`
      });
      if (res.data.success) {
        navigate(`/messages/${listing.seller_id}?chat=${res.data.chatId}`);
      }
    } catch (err) {
      console.error('Contact failed:', err);
    }
  };

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim() || submittingReview) return;
    setSubmittingReview(true);
    try {
      const res = await api.post(`/marketplace/sellers/${listing?.seller_id}/reviews`, {
        rating: reviewRating,
        comment: reviewComment,
        listing_id: id
      });
      if (res.data.success) {
        setReviews([res.data.review, ...reviews]);
        setReviewComment('');
        setReviewRating(5);
        alert('Review submitted successfully!');
      }
    } catch (err) {
      console.error('Review submission failed:', err);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
      <Navbar />
      <div className="flex-1 flex items-center justify-center lg:ml-72">
         <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    </div>
  );

  if (!listing) return null;

  const media = listing.media || [];
  const isOwner = user?.id === listing.seller_id;

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
      <Navbar />

      <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-red-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-7xl mx-auto w-full pb-32">
        {/* Navigation / Actions Header */}
        <div className="flex justify-between items-center mb-10 animate-fade-in">
          <button 
            onClick={() => navigate(-1)} 
            className="group flex items-center gap-3 text-sm font-bold text-black/40 hover:text-primary transition-all"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Back to Market
          </button>
          
          <div className="flex gap-4">
             <button className="p-3.5 rounded-2xl bg-white/60 backdrop-blur-xl border border-white text-black/40 hover:text-primary transition-all shadow-sm">
                <Share2 size={20} />
             </button>
             <button 
                onClick={handleWishlist}
                className={`p-3.5 rounded-2xl backdrop-blur-xl border transition-all shadow-sm ${isWishlisted ? 'bg-primary border-primary text-white' : 'bg-white/60 border-white text-black/40 hover:text-primary'}`}
             >
                <Heart size={20} fill={isWishlisted ? "currentColor" : "none"} strokeWidth={3} />
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          {/* Gallery Section */}
          <div className="space-y-6 animate-fade-in">
             <div className="aspect-[4/5] bg-white rounded-[48px] overflow-hidden shadow-2xl relative border border-white group/main">
                <img 
                  src={media[activeImage]?.media_url || listing.image_url || '/uploads/marketplace/default.png'} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover/main:scale-110" 
                  alt="" 
                />
                
                <div className="absolute bottom-8 left-8 right-8 p-6 bg-black/40 backdrop-blur-2xl rounded-3xl flex justify-between items-center border border-white/20">
                    <div className="flex gap-2">
                        <span className="px-5 py-2 bg-primary text-white text-[11px] font-black rounded-xl uppercase tracking-widest">{listing.condition}</span>
                        <span className="px-5 py-2 bg-white/20 text-white text-[11px] font-black rounded-xl uppercase tracking-widest backdrop-blur-md">{listing.category}</span>
                    </div>
                </div>
             </div>
             
             {media.length > 1 && (
               <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                  {media.map((m: { media_url: string }, idx: number) => (
                    <button 
                      key={idx}
                      onClick={() => setActiveImage(idx)}
                      className={`w-24 h-24 flex-shrink-0 rounded-[28px] overflow-hidden border-4 transition-all duration-300 ${
                        activeImage === idx ? 'border-primary scale-95 shadow-xl' : 'border-white hover:border-primary/20'
                      }`}
                    >
                       <img src={m.media_url} className="w-full h-full object-cover" alt="" />
                    </button>
                  ))}
               </div>
             )}
          </div>

          {/* Details Section */}
          <div className="flex flex-col gap-10 animate-fade-in">
             <div className="bg-white/80 backdrop-blur-3xl rounded-[48px] p-10 md:p-14 shadow-xl border border-white/65 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-6 text-primary font-bold text-xs uppercase tracking-widest">
                    <MapPin size={16} strokeWidth={3} />
                    <span>{listing.campus || 'Global Marketplace'}</span>
                </div>

                <h1 className="text-4xl md:text-5xl font-black text-black tracking-tight leading-tight mb-6 italic">{listing.title}</h1>
                
                <div className="flex items-center gap-6 mb-10">
                    <p className="text-5xl font-black text-primary tracking-tighter">KSh {parseFloat(listing.price).toLocaleString()}</p>
                    <span className="text-black/10 font-bold line-through text-2xl tracking-tighter italic">KSh {(parseFloat(listing.price) * 1.2).toFixed(0)}</span>
                </div>

                <div className="space-y-8 mb-12">
                    <div className="p-8 bg-black/5 rounded-[32px] border border-black/5">
                        <h3 className="text-[11px] font-bold text-black/30 uppercase tracking-widest mb-4 px-1">Artifact Description</h3>
                        <p className="text-black font-medium leading-relaxed text-lg">{listing.description || 'No detailed specifications provided.'}</p>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                   {isOwner ? (
                       <button 
                        onClick={() => navigate(`/marketplace/edit/${id}`)}
                        className="w-full py-6 bg-black text-white rounded-[24px] font-bold text-base shadow-xl hover:bg-primary transition-all active:scale-95 flex items-center justify-center gap-3"
                       >
                         Manage Artifact
                       </button>
                   ) : (
                       <>
                        <button 
                            onClick={handleContact}
                            className="w-full py-6 bg-primary text-white rounded-[24px] font-black text-base uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center gap-3"
                        >
                            <MessageCircle size={22} strokeWidth={3} />
                            Contact Seller
                        </button>
                        <button className="w-full py-6 border-2 border-primary/10 text-primary rounded-[24px] font-black text-xs uppercase tracking-widest hover:bg-primary hover:text-white transition-all active:scale-95">
                            Make an Offer
                        </button>
                       </>
                   )}
                </div>
             </div>

             {/* Seller Badge */}
             <div className="bg-white/90 backdrop-blur-3xl rounded-[32px] p-6 border border-white/65 shadow-xl flex items-center gap-6 transition-all hover:scale-[1.02] cursor-pointer group" onClick={() => navigate(`/profile/${listing.seller_username}`)}>
                <div className="relative">
                    <img src={listing.seller_avatar || '/uploads/avatars/default.png'} className="w-16 h-16 rounded-[20px] object-cover border border-white shadow-sm" alt="" />
                    <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center text-white shadow-lg">
                        <ShieldCheck size={14} strokeWidth={3} />
                    </div>
                </div>
                <div className="flex-1">
                   <div className="flex items-center gap-3">
                       <h3 className="font-black text-black text-xl italic leading-none">{listing.seller_name || listing.seller_username}</h3>
                       <span className="flex items-center text-amber-500 text-sm font-bold gap-1 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                           <Star size={14} fill="currentColor" /> 4.9
                       </span>
                   </div>
                   <p className="text-[11px] font-bold text-black/20 uppercase tracking-widest mt-1.5">Verified Elite Merchant</p>
                </div>
                <ChevronLeft size={24} className="text-black/20 rotate-180 group-hover:text-primary transition-colors" />
             </div>
          </div>
        </div>

        {/* Review Submission Form */}
        {!isOwner && (
          <div className="mt-32 max-w-2xl mx-auto animate-fade-in px-4">
             <div className="flex items-center gap-3 mb-10">
                <div className="w-1 h-10 bg-primary rounded-full" />
                <h2 className="text-3xl font-black text-black italic">Transmit Feedback</h2>
             </div>
             
             <form onSubmit={handleSubmitReview} className="space-y-10 bg-white/60 backdrop-blur-3xl p-10 rounded-[40px] border border-white shadow-xl">
                <div className="flex gap-4 text-amber-400 justify-center">
                   {[1, 2, 3, 4, 5].map(star => (
                      <Star 
                        key={star} 
                        size={40} 
                        fill={star <= reviewRating ? "currentColor" : "none"} 
                        strokeWidth={3}
                        className="cursor-pointer transition-all hover:scale-110 active:scale-90"
                        onClick={() => setReviewRating(star)}
                      />
                   ))}
                </div>
                <textarea 
                  value={reviewComment}
                  onChange={e => setReviewComment(e.target.value)}
                  placeholder="Share your resonance experience..." 
                  className="w-full bg-white/60 border border-white rounded-[32px] py-6 px-8 text-md font-bold outline-none transition-all focus:bg-white focus:ring-4 focus:ring-primary/10 min-h-[160px] shadow-sm resize-none"
                />
                <button 
                  type="submit" 
                  disabled={submittingReview}
                  className="w-full py-5 bg-black text-white rounded-[24px] font-black text-sm uppercase tracking-widest shadow-xl hover:bg-primary transition-all active:scale-95"
                >
                  {submittingReview ? 'Processing...' : 'Broadcast Review'}
                </button>
             </form>
          </div>
        )}

        {/* Similar Items or Reviews */}
        <div className="mt-32 animate-fade-in">
            <div className="flex items-center justify-between gap-6 mb-12 px-2">
                <div className="flex items-center gap-3">
                    <div className="w-1 h-10 bg-primary rounded-full" />
                    <h2 className="text-3xl font-black text-black italic">Correspondence Archive</h2>
                </div>
                <span className="bg-primary/10 text-primary text-[11px] px-5 py-2 rounded-2xl font-black tracking-widest uppercase">{formatCount(reviews.length)} TRANSMISSIONS</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {reviews.length > 0 ? reviews.map((review, idx) => (
                <div key={idx} className="bg-white/80 backdrop-blur-3xl p-10 rounded-[40px] border border-white shadow-xl hover:scale-[1.02] transition-all group relative overflow-hidden">
                   <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/5 rounded-full blur-2xl transition-all group-hover:scale-150"></div>
                   
                   <div className="flex items-center gap-5 mb-6 relative z-10">
                      <img src={review.avatar_url || '/uploads/avatars/default.png'} className="w-14 h-14 rounded-2xl object-cover border border-white shadow-sm bg-primary/5" alt="" />
                      <div>
                         <h4 className="text-base font-black text-black">{review.reviewer_name}</h4>
                         <div className="flex gap-1 text-amber-400 mt-1">
                             {[...Array(5)].map((_, i) => <Star key={i} size={12} fill={i < (review.rating || 5) ? "currentColor" : "none"} strokeWidth={3} />)}
                         </div>
                      </div>
                   </div>
                   <p className="text-lg text-black font-medium leading-relaxed relative z-10 italic">"{review.review_text}"</p>
                </div>
              )) : (
                <div className="col-span-full py-24 text-center bg-white/40 border border-white rounded-[48px] shadow-inner flex flex-col items-center justify-center gap-8">
                   <Orbit size={80} strokeWidth={1} className="text-black/5" />
                   <p className="text-[12px] font-bold text-black/20 uppercase tracking-widest italic">No correspondence records found for this merchant.</p>
                </div>
              )}
            </div>
        </div>
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
