import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import Navbar from '../components/Navbar';
import type { Listing } from '../types/listing';

export default function Wishlist() {
  const [items, setItems] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWishlist = async () => {
      try {
        const response = await api.get('/marketplace/wishlist');
        if (response.data.success) {
          setItems(response.data.listings || []);
        }
      } catch (err) {
        console.error('Failed to fetch wishlist:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchWishlist();
  }, []);

  const removeItem = async (id: string) => {
    try {
      await api.post(`/marketplace/listings/${id}/wishlist`);
      setItems(prev => prev.filter(item => item.listing_id !== id));
    } catch (err) {
      console.error('Failed to remove item:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 py-20">
         <div className="flex items-center gap-6 mb-16">
            <div className="w-16 h-16 bg-rose-500 rounded-[2.5rem] flex items-center justify-center text-white text-3xl shadow-2xl shadow-rose-200">❤️</div>
            <div>
               <h1 className="text-4xl font-black text-slate-800 tracking-tight">Saved Artifacts</h1>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Your curated collection of campus treasures</p>
            </div>
         </div>

         {loading ? (
           <div className="py-20 text-center">
              <div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
           </div>
         ) : items.length > 0 ? (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {items.map(item => (
                <div key={item.listing_id} className="premium-card bg-white p-4 group border-white">
                   <div className="relative aspect-square rounded-[1.5rem] overflow-hidden mb-4">
                      <img src={item.image_url || '/uploads/marketplace/default.png'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                      <button 
                        onClick={() => removeItem(item.listing_id)}
                        className="absolute top-3 right-3 w-10 h-10 bg-white/80 backdrop-blur-md rounded-xl flex items-center justify-center text-rose-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-500 hover:text-white"
                      >
                        ✕
                      </button>
                   </div>
                   <Link to={`/marketplace/listings/${item.listing_id}`}>
                      <h3 className="font-black text-slate-800 truncate mb-1">{item.title}</h3>
                      <p className="text-lg font-black text-indigo-600">${item.price}</p>
                   </Link>
                </div>
              ))}
           </div>
         ) : (
           <div className="py-32 text-center">
              <div className="text-6xl mb-6 opacity-20">🧺</div>
              <h2 className="text-xl font-black text-slate-800 mb-2">Vault is Empty</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">Save items you desire while exploring the mall.</p>
              <Link to="/marketplace" className="inline-block px-10 py-4 bg-slate-900 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-all">Explore Mall</Link>
           </div>
         )}
      </main>
    </div>
  );
}
