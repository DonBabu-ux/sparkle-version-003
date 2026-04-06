import { useState, useEffect } from 'react';
import api from '../api/api';


export default function Marketplace() {
  const [data, setData] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const fetchMarketplace = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/marketplace?category=${filter}`);
        setData(response.data);
      } catch (err) {
        console.error('Failed to fetch marketplace:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMarketplace();
  }, [filter]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 lg:p-8">
      {/* Search & Header */}
      <nav className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-xl shadow-indigo-100/50">🛍️</div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Campus Marketplace</h1>
            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest leading-none mt-0.5">Exclusive student deals</p>
          </div>
        </div>
        
        <div className="flex-1 max-w-xl w-full">
          <div className="relative group">
            <input 
              type="text" 
              placeholder="Search for books, tech, housing..."
              className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 transition-all outline-none text-sm font-medium"
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">🔍</span>
          </div>
        </div>

        <button className="bg-indigo-600 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 transition-all active:scale-95 text-sm flex items-center gap-2">
          <span>+</span> Sell Item
        </button>
      </nav>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Filters */}
        <aside className="lg:col-span-3 space-y-6">
          <div className="premium-card p-6 border-white/80 bg-white/70 backdrop-blur-xl">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6">Categories</h3>
            <div className="space-y-2">
              {['all', 'textbooks', 'electronics', 'furniture', 'clothing', 'housing'].map(cat => (
                <button 
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`w-full text-left px-5 py-3.5 rounded-xl text-sm font-bold capitalize transition-all ${
                    filter === cat 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' 
                    : 'text-slate-500 hover:bg-slate-100/80 active:scale-95'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="premium-card p-6 bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-none shadow-2xl shadow-indigo-200">
             <div className="mb-4 text-3xl">🛡️</div>
             <h4 className="font-black text-lg mb-2">Safe Trading</h4>
             <p className="text-white/70 text-xs leading-relaxed">Always meet in public campus areas and verify items before paying. Sparkle verified sellers help ensure a safer community.</p>
          </div>
        </aside>

        {/* Listings Grid */}
        <div className="lg:col-span-9">
          {loading ? (
            <div className="h-96 flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-[10px] font-black text-slate-400 tracking-tighter uppercase italic">Summoning the grand plaza...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {data?.listings?.length > 0 ? (
                data.listings.map((item: any) => (
                  <div key={item.listing_id} className="premium-card group hover:-translate-y-1 transition-all duration-300 border-white bg-white/80 overflow-hidden p-0 flex flex-col">
                    <div className="relative h-48 overflow-hidden bg-slate-100">
                       <img 
                        src={item.image_url || '/uploads/defaults/no-image.png'} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                        alt={item.title} 
                       />
                       <div className="absolute top-3 left-3 px-3 py-1.5 bg-white/90 backdrop-blur-md rounded-xl text-[10px] font-black text-slate-800 uppercase tracking-widest shadow-sm">
                         {item.condition || 'Used'}
                       </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-black text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors line-clamp-2">{item.title}</h3>
                        <span className="text-lg font-black text-emerald-600 ml-2">₹{item.price}</span>
                      </div>
                      <p className="text-slate-400 text-[11px] font-medium mb-4 line-clamp-2">{item.description}</p>
                      
                      <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
                         <div className="flex items-center gap-2">
                           <img src={item.seller_avatar || '/uploads/avatars/default.png'} className="w-6 h-6 rounded-lg object-cover ring-2 ring-slate-50" alt="" />
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">{item.seller_name || 'Seller'}</span>
                         </div>
                         <button className="p-2.5 rounded-xl bg-slate-50 text-indigo-600 text-xs font-black hover:bg-indigo-600 hover:text-white transition-all">View</button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full h-80 flex flex-col items-center justify-center glass-panel border-dashed p-10">
                   <div className="text-4xl mb-4 opacity-30">🏜️</div>
                   <h4 className="text-lg font-bold text-slate-600">No treasures found in this sector</h4>
                   <p className="text-sm text-slate-400 text-center max-w-xs mt-2">Try adjusting your filters or expanding your search horizon across the cosmic campus.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
