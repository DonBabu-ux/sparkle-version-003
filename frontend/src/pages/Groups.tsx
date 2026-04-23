import { useState, useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { Users, Plus, Shield, Search, ArrowRight, Orbit, Sparkles } from 'lucide-react';
import type { Group } from '../types/group';
import { useNavigate } from 'react-router-dom';

export default function Groups() {
  const { user } = useUserStore();
  const navigate = useNavigate();
  const [data, setData] = useState<{ initialGroups: Group[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const fetchGroups = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/groups?filter=${filter}`);
        setData(response.data);
      } catch (err) {
        console.error('Failed to fetch groups:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, [filter]);

  const filtered = data?.initialGroups?.filter(g =>
    !query || g.name?.toLowerCase().includes(query.toLowerCase())
  ) ?? [];

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black font-sans overflow-x-hidden">
      <Navbar />

      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-7xl mx-auto w-full pt-16 md:pt-12">
        <header className="mb-24 animate-fade-in px-4">
           <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12">
              <div className="max-w-4xl space-y-8">
                 <div className="inline-flex items-center gap-4 px-6 py-2.5 rounded-full bg-white/80 border border-white backdrop-blur-3xl shadow-xl shadow-primary/5">
                    <Users size={18} strokeWidth={3} className="text-primary" />
                    <span className="text-[10px] font-black text-black uppercase tracking-[0.4em] italic">The Village Circles</span>
                 </div>
                 <h1 className="text-5xl md:text-9xl font-black text-black tracking-tighter leading-none italic uppercase">
                    Campus <span className="text-primary">Circles</span>
                 </h1>
                  <p className="text-xl font-bold text-black opacity-60 leading-relaxed italic max-w-2xl">
                    Exclusive spaces for interests, shared frequencies, and private orbits. Connect across <span className="text-primary">{user?.campus || 'the village'}</span>.
                  </p>
              </div>
              
              <button 
                className="flex items-center gap-4 px-12 py-6 bg-primary text-white rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 hover:scale-[1.05] transition-all active:scale-95 whitespace-nowrap italic"
              >
                <Plus size={24} strokeWidth={4} />
                Initialize Circle
              </button>
           </div>
        </header>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-10 mb-16 px-4">
           <div className="flex items-center gap-4 overflow-x-auto pb-4 lg:pb-0 no-scrollbar w-full lg:w-auto">
              {[
                { key: 'all',     label: 'All Circles' },
                { key: 'my',      label: 'My Orbits'  },
                { key: 'managed', label: 'Admin Nodes'   },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-10 py-4.5 rounded-[22px] font-black text-[11px] uppercase tracking-widest transition-all duration-500 whitespace-nowrap shadow-lg border italic ${filter === f.key ? 'bg-white border-primary text-primary scale-105 shadow-primary/5' : 'bg-white/40 border-white text-black/20 hover:bg-white hover:text-black hover:shadow-xl'}`}
                >
                  {f.label}
                </button>
              ))}
           </div>

           <div className="relative w-full lg:w-[450px] group">
              <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-black/10 group-focus-within:text-primary transition-colors" size={24} strokeWidth={4} />
              <input 
                type="text" 
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Scan for frequencies..." 
                className="w-full h-20 bg-white/80 border border-white rounded-[32px] pl-20 pr-8 text-lg font-black text-black placeholder:text-black/5 focus:bg-white focus:border-primary transition-all outline-none shadow-2xl shadow-primary/5 italic"
              />
           </div>
        </div>

        {/* Grid */}
        {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 px-2">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-96 bg-white/40 border-4 border-dashed border-white rounded-[56px] animate-pulse" />
              ))}
            </div>
          ) : !filtered.length ? (
            <div className="py-48 flex flex-col items-center text-center px-8 bg-white/20 border-4 border-dashed border-white rounded-[64px] shadow-inner animate-fade-in mx-4">
              <Orbit size={140} strokeWidth={1} className="text-black/5 animate-spin-slow" />
              <h3 className="text-5xl font-black text-black/10 italic mb-8 uppercase tracking-tighter">Quiet Frequency.</h3>
              <p className="text-[11px] font-black text-black/30 uppercase tracking-[0.4em] max-w-sm mx-auto mb-12 italic leading-loose">
                 {query ? 'No circles match this broadcast spectrum.' : 'No active orbits detected in this sector.'}
              </p>
              <button 
                className="px-12 py-6 bg-primary text-white rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 italic transition-all hover:scale-[1.05]"
              >
                 Initialize Pulse
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 pb-48 px-2">
              {filtered.map((group) => (
                <div
                  key={group.group_id}
                  onClick={() => navigate(`/groups/${group.group_id}`)}
                  className="bg-white/80 backdrop-blur-3xl rounded-[56px] group/item hover:scale-[1.03] transition-all duration-700 overflow-hidden shadow-2xl shadow-primary/5 border border-white p-12 cursor-pointer flex flex-col animate-fade-in relative"
                >
                   {/* Background Accents */}
                   <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-[60px] opacity-0 group-hover/item:opacity-100 transition-opacity"></div>

                   <div className="flex items-start justify-between mb-12 relative z-10">
                      <div className="relative">
                        <div className="p-1 rounded-[32px] bg-white shadow-2xl inline-block group-hover/item:-rotate-3 transition-transform duration-700 border border-black/5">
                           <img 
                               src={group.icon_url || '/uploads/avatars/default.png'}
                               className="w-24 h-24 rounded-[28px] object-cover"
                               alt=""
                           />
                        </div>
                        {group.is_public === 0 && (
                          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center text-white border-8 border-white shadow-xl">
                            <Shield size={16} strokeWidth={4} />
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        <div className="text-6xl font-black text-black group-hover/item:text-primary transition-all duration-700 leading-none tracking-tighter">
                          {group.member_count ?? 0}
                        </div>
                        <div className="text-[9px] font-black text-black/20 uppercase tracking-[0.3em] mt-3 italic">
                          Signals Bound
                        </div>
                      </div>
                   </div>

                   <h3 className="text-3xl font-black text-black mb-4 group-hover/item:text-primary transition-colors leading-none uppercase tracking-tighter italic">{group.name}</h3>
                   <p className="text-base font-bold text-black opacity-60 line-clamp-2 leading-loose mb-12 flex-1 italic">
                      {group.description || 'Resonating within the campus network...'}
                   </p>

                   <div className="pt-10 border-t border-black/[0.03] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="flex -space-x-4">
                          {[1, 2, 3].map(j => (
                             <div key={j} className="w-10 h-10 rounded-2xl overflow-hidden shadow-xl border-4 border-white bg-primary/5 group-hover/item:translate-y-[-4px] transition-transform duration-500" style={{ transitionDelay: `${j * 100}ms` }}>
                                <img src={`https://ui-avatars.com/api/?name=U+${j}&background=random&color=fff`} className="w-full h-full object-cover" alt="" />
                             </div>
                          ))}
                         </div>
                         <Sparkles size={16} className="text-primary fill-primary animate-pulse ml-2" />
                      </div>

                      <div className="w-14 h-14 bg-primary/5 text-primary rounded-[22px] flex items-center justify-center scale-0 group-hover/item:scale-100 transition-all duration-500 shadow-xl border border-primary/10 active:scale-90">
                        <ArrowRight size={26} strokeWidth={4} />
                      </div>
                   </div>
                </div>
              ))}
            </div>
          )}
      </main>

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
