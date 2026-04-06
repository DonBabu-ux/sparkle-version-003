import { useState, useEffect } from 'react';
import api from '../api/api';

import Navbar from '../components/Navbar';
import { Link } from 'react-router-dom';

export default function Search() {
  const [query, setQuery] = useState('');

  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({
    campus: 'all',
    major: 'all'
  });

  const handleSearch = async () => {
    if (!query.trim() && filter.campus === 'all' && filter.major === 'all') return;
    
    setLoading(true);
    try {
      const response = await api.get('/social/search', {
        params: {
          q: query,
          campus: filter.campus,
          major: filter.major
        }
      });
      if (response.data.status === 'success') {
        setResults(response.data.data);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      handleSearch();
    }, 500);
    return () => clearTimeout(delayDebounce);
  }, [query, filter]);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="max-w-6xl mx-auto px-4 pb-20">
        <div className="mb-12 text-center max-w-2xl mx-auto">
           <h1 className="text-4xl font-black text-slate-800 mb-4 tracking-tight">Expand Your Horizon</h1>
           <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Find peers, creators, and pioneers across the cosmic campus</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
           {/* Filters Sidebar */}
           <aside className="lg:col-span-3 space-y-6">
              <div className="premium-card p-6 bg-white/70 backdrop-blur-xl border-white shadow-xl shadow-slate-100">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Sector Filters</h3>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-800 uppercase tracking-widest ml-1">Campus Hub</label>
                    <select 
                      className="w-full bg-slate-50 border-slate-100 rounded-xl p-3 text-xs font-bold focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                      value={filter.campus}
                      onChange={(e) => setFilter({...filter, campus: e.target.value})}
                    >
                      <option value="all">Everywhere</option>
                      <option value="Main Campus">Main Campus</option>
                      <option value="North Wing">North Wing</option>
                      <option value="Engineering Block">Engineering Block</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-800 uppercase tracking-widest ml-1">Scientific Discipline</label>
                    <select 
                      className="w-full bg-slate-50 border-slate-100 rounded-xl p-3 text-xs font-bold focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                      value={filter.major}
                      onChange={(e) => setFilter({...filter, major: e.target.value})}
                    >
                      <option value="all">All Disciplines</option>
                      <option value="Computer Science">Computer Science</option>
                      <option value="Physics">Physics</option>
                      <option value="Design">Design</option>
                      <option value="Biology">Biology</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="premium-card bg-slate-900 border-none shadow-2xl shadow-slate-200">
                 <h4 className="text-white font-black text-sm mb-2">Discovery Bonus</h4>
                 <p className="text-white/40 text-[10px] leading-relaxed">Matching with peers in your discipline increases resonance by 40%.</p>
              </div>
           </aside>

           {/* Results Area */}
           <div className="lg:col-span-9 space-y-6">
              <div className="relative group">
                <input 
                  type="text" 
                  placeholder="Scan for names or handles..."
                  className="w-full bg-white border border-slate-100 rounded-3xl py-5 pl-14 pr-6 text-sm font-medium shadow-xl shadow-slate-100 focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-xl grayscale group-focus-within:grayscale-0 transition-all">📡</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {loading ? (
                    Array(4).fill(0).map((_, i) => (
                      <div key={i} className="animate-pulse bg-white p-6 rounded-[32px] border border-slate-50 h-32"></div>
                    ))
                 ) : results.length > 0 ? (
                    results.map(peer => (
                      <Link 
                        to={`/profile/${peer.username}`} 
                        key={peer.user_id}
                        className="premium-card bg-white border-white hover:-translate-y-1 transition-all duration-300 p-6 flex items-center gap-5 group"
                      >
                        <img src={peer.avatar_url || '/uploads/avatars/default.png'} className="w-16 h-16 rounded-2xl object-cover shadow-lg border-2 border-slate-50 group-hover:border-indigo-100 transition-colors" alt="" />
                        <div className="flex-1 min-w-0">
                           <h4 className="font-black text-slate-800 tracking-tight truncate group-hover:text-indigo-600 transition-colors">{peer.name}</h4>
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5 truncate">@{peer.username}</p>
                           <div className="mt-2 flex items-center gap-2">
                             <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-50 rounded text-slate-500">{peer.campus}</span>
                             {peer.mutual_connections > 0 && (
                               <span className="text-[9px] font-black text-indigo-500">+{peer.mutual_connections} Mutuals</span>
                             )}
                           </div>
                        </div>
                        <div className="text-xl opacity-0 group-hover:opacity-100 transition-opacity">✨</div>
                      </Link>
                    ))
                 ) : (
                    <div className="col-span-full py-32 flex flex-col items-center justify-center bg-white/30 rounded-[40px] border-2 border-dashed border-slate-200">
                       <div className="text-5xl mb-4 grayscale opacity-20">🔭</div>
                       <p className="text-xs font-black text-slate-400 uppercase tracking-widest text-center max-w-xs">
                         {query ? "No signals matching your sweep criteria" : "Initiate scan to find pioneers"}
                       </p>
                    </div>
                 )}
              </div>
           </div>
        </div>
      </main>
    </div>
  );
}
