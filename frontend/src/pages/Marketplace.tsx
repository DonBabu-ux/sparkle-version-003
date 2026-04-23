import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, Plus, ShieldCheck, ChevronRight, Grid, Orbit, Tag, Store } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';
import { useModalStore } from '../store/modalStore';
import { useUserStore } from '../store/userStore';

interface Listing {
  listing_id: string;
  title: string;
  description: string;
  price: number | string;
  image_url?: string;
  condition?: string;
  seller_name?: string;
  seller_avatar?: string;
}

export default function Marketplace() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const { refreshCounter } = useModalStore();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [campus, setCampus] = useState(user?.campus || 'all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { id: 'all', label: 'Everything', icon: <Grid size={20} strokeWidth={3} /> },
    { id: 'electronics', label: 'Tech Space', icon: <Orbit size={20} strokeWidth={3} /> },
    { id: 'books', label: 'Library', icon: <Tag size={20} strokeWidth={3} /> },
    { id: 'other', label: 'Bazaar', icon: <Store size={20} strokeWidth={3} /> }
  ];

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      let endpoint = `/marketplace/listings?category=${category}&campus=${campus}`;
      if (searchQuery) endpoint += `&search=${searchQuery}`;
      
      const response = await api.get(endpoint);
      const resData = response.data;
      const list = resData.listings || resData.data || (Array.isArray(resData) ? resData : []);
      setListings(list);
    } catch (err) {
      console.error('Failed to fetch marketplace:', err);
    } finally {
      setLoading(false);
    }
  }, [category, campus, searchQuery]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings, refreshCounter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchListings();
  };

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black font-sans overflow-x-hidden">
      <Navbar />

      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <div className="flex-1 px-6 py-20 lg:ml-72 lg:px-12 lg:py-24 max-w-7xl mx-auto w-full relative z-10 pt-20 md:pt-12">
        <header className="flex flex-col items-center text-center mb-32 animate-fade-in px-4">
          <div className="inline-flex items-center gap-4 px-8 py-3 bg-white/80 backdrop-blur-3xl border border-white rounded-full mb-12 shadow-xl shadow-primary/5">
            <ShoppingBag size={20} strokeWidth={3} className="text-primary" />
            <span className="text-[10px] font-black text-black uppercase tracking-[0.4em] italic">The Village Exchange</span>
          </div>
          
          <h1 className="text-5xl md:text-9xl font-black text-black tracking-tighter leading-none mb-10 italic uppercase">
            Campus <span className="text-primary">Bazaar</span>
          </h1>
          
          <p className="text-black font-bold max-w-2xl text-lg leading-relaxed italic opacity-60">
            A safe, high-frequency space for campus trading. Re-synchronize your belongings with the village.
          </p>
          
          <form className="w-full max-w-4xl mt-20 relative group" onSubmit={handleSearch}>
            <div className="absolute inset-y-0 left-8 flex items-center pointer-events-none transition-colors group-focus-within:text-primary">
              <Search className="text-black/10" size={28} strokeWidth={4} />
            </div>
            <input 
              type="text" 
              placeholder="Scan for available signals..."
              className="w-full h-24 bg-white/80 backdrop-blur-3xl border border-white rounded-[40px] pl-20 pr-52 outline-none focus:bg-white focus:border-primary transition-all font-black text-xl text-black placeholder:text-black/10 shadow-2xl shadow-primary/5 italic"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button 
              type="submit"
              className="absolute right-4 top-4 bottom-4 bg-primary text-white px-12 rounded-[28px] font-black text-sm uppercase tracking-widest hover:scale-[1.03] active:scale-95 transition-all shadow-2xl shadow-primary/30 italic"
            >
              Search
            </button>
          </form>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-16">
          {/* Sidebar */}
          <aside className="flex flex-col gap-12 animate-fade-in">
            <div className="bg-white/80 backdrop-blur-3xl border border-white rounded-[48px] p-10 shadow-xl shadow-primary/5">
              <h3 className="text-[10px] font-black text-pink-600 uppercase tracking-[0.4em] mb-8 italic">Categories</h3>
              <div className="space-y-4">
                {categories.map(cat => (
                  <button 
                    key={cat.id}
                    className={`w-full flex items-center gap-5 px-6 py-5 rounded-3xl font-black text-sm transition-all duration-500 italic uppercase tracking-wider ${category === cat.id ? 'bg-primary text-white shadow-2xl shadow-primary/30 scale-105' : 'bg-white/40 text-black/20 hover:bg-white hover:text-black hover:shadow-xl'}`}
                    onClick={() => setCategory(cat.id)}
                  >
                    <span className={category === cat.id ? 'text-white' : 'text-primary'}>{cat.icon}</span>
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-3xl border border-white rounded-[48px] p-10 shadow-xl shadow-primary/5">
              <h3 className="text-[10px] font-black text-pink-600 uppercase tracking-[0.4em] mb-8 italic">Frequency (Campus)</h3>
              <div className="space-y-4">
                {[
                  { id: 'all', label: 'All Signals' },
                  { id: 'Main Campus', label: 'Main Pulse' },
                  { id: 'North Campus', label: 'North Node' },
                  { id: 'South Campus', label: 'South Node' }
                ].map(c => (
                  <button 
                    key={c.id}
                    className={`w-full flex items-center justify-between px-6 py-5 rounded-3xl font-black text-sm transition-all duration-500 italic uppercase tracking-widest ${campus === c.id ? 'bg-primary/5 text-primary border border-primary/10 shadow-inner' : 'text-black/20 hover:bg-white/60 hover:text-black'}`}
                    onClick={() => setCampus(c.id)}
                  >
                    {c.label}
                    {campus === c.id && <ChevronRight size={18} strokeWidth={4} />}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-black text-white rounded-[48px] p-12 relative overflow-hidden shadow-2xl group cursor-default">
               <div className="absolute -top-12 -right-12 text-primary/20 transition-transform duration-700 group-hover:rotate-12">
                <ShieldCheck size={200} strokeWidth={1} />
               </div>
               <h4 className="text-3xl font-black mb-6 relative z-10 italic uppercase tracking-tighter">Safe Sync</h4>
               <p className="text-xs font-bold text-white/40 leading-loose relative z-10 uppercase tracking-widest">
                Always establish synchronization in public village slots. Verify signal credentials before exchange.
               </p>
            </div>
          </aside>

          {/* Main Listings */}
          <section className="flex flex-col gap-16 pb-48">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 px-6">
              <div className="flex items-center gap-4">
                 <div className="w-2 h-10 bg-primary rounded-full"></div>
                 <h2 className="text-4xl font-black text-black uppercase tracking-tighter italic">
                   {categories.find(c => c.id === category)?.label} Pulse
                 </h2>
              </div>
              <button 
                className="flex items-center gap-4 px-10 py-5 bg-primary text-white rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 hover:scale-[1.05] transition-all active:scale-95 italic" 
                onClick={() => {
                  const { setActiveModal } = useModalStore.getState();
                  setActiveModal('listing');
                }}
              >
                <Plus size={22} strokeWidth={4} /> Transmit Item
              </button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="aspect-[4/5] bg-white/40 border-4 border-dashed border-white rounded-[48px] animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                {listings.length > 0 ? (
                  listings.map((item: Listing) => (
                    <div 
                      key={item.listing_id} 
                      className="bg-white/80 backdrop-blur-3xl border border-white group hover:scale-[1.03] transition-all duration-700 cursor-pointer flex flex-col rounded-[48px] overflow-hidden shadow-xl hover:shadow-2xl hover:shadow-primary/5 relative animate-fade-in" 
                      onClick={() => navigate(`/marketplace/listings/${item.listing_id}`)}
                    >
                      <div className="relative aspect-[4/3] overflow-hidden m-3 rounded-[38px] shadow-sm border border-black/5">
                        <img 
                          src={item.image_url || '/uploads/defaults/no-image.png'} 
                          alt={item.title} 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000"
                        />
                        <div className="absolute top-5 right-5 bg-black/80 backdrop-blur-xl text-white px-6 py-3 rounded-2xl text-lg font-black shadow-2xl border border-white/20 italic">
                          KSh {item.price}
                        </div>
                      </div>
                      
                      <div className="p-10 flex flex-col flex-1">
                        <h3 className="text-2xl font-black text-black mb-4 group-hover:text-primary transition-colors duration-500 uppercase tracking-tighter italic leading-none">
                          {item.title}
                        </h3>
                        <p className="text-base text-black font-semibold leading-relaxed mb-8 line-clamp-2 italic opacity-60">
                          {item.description}
                        </p>
                        
                        <div className="mt-auto flex items-center justify-between pt-8 border-t border-black/[0.03]">
                          <div className="flex items-center gap-4">
                            <div className="p-1 rounded-2xl bg-white shadow-lg border border-black/5">
                               <img src={item.seller_avatar || '/uploads/avatars/default.png'} className="w-10 h-10 rounded-xl object-cover" alt="" />
                            </div>
                            <div className="flex flex-col">
                               <p className="text-[10px] font-black text-black uppercase tracking-widest italic">{item.seller_name || 'Incognito'}</p>
                               <p className="text-[8px] font-bold text-black/20 uppercase tracking-[0.3em] mt-1 italic">Verified Signal</p>
                            </div>
                          </div>
                          <div className="w-12 h-12 bg-primary/5 text-primary rounded-[18px] flex items-center justify-center scale-0 group-hover:scale-100 transition-all shadow-sm border border-primary/10">
                            <ChevronRight size={22} strokeWidth={4} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-48 flex flex-col items-center gap-12 text-center bg-white/20 border-4 border-dashed border-white rounded-[56px] shadow-inner animate-fade-in px-10">
                    <Orbit size={140} strokeWidth={1} className="text-black/5 animate-spin-slow" />
                    <div className="space-y-6">
                      <h3 className="text-5xl font-black text-black/20 italic uppercase tracking-tighter leading-none">Quiet Frequency.</h3>
                      <p className="text-[11px] font-black text-black/30 uppercase tracking-[0.4em] max-w-xs mx-auto leading-loose italic">No commercial signals detected in this sector. Amplify the first listing!</p>
                      <button 
                        onClick={() => {
                          const { setActiveModal } = useModalStore.getState();
                          setActiveModal('listing');
                        }}
                        className="mt-6 px-12 py-6 bg-primary text-white rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 hover:scale-[1.05] transition-all italic"
                      >
                         Initialize Listing
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .animate-spin-slow { animation: spin 15s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
