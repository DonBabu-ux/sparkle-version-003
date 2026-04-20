import { useState, useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import type { Group } from '../types/group';

export default function Groups() {
  const { user } = useUserStore();
  const [data, setData] = useState<{ initialGroups: Group[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

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

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 lg:p-8">
      {/* Header Section */}
      <header className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center mb-12 gap-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl shadow-2xl shadow-indigo-200">🤝</div>
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Campus Communities</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none">Find your tribe at {user?.campus || 'your campus'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
           {['all', 'my', 'managed'].map(f => (
             <button 
              key={f}
              onClick={() => setFilter(f)}
              className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                filter === f 
                ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
             >
               {f === 'all' ? 'Discover' : f === 'my' ? 'Joined' : 'Managing'}
             </button>
           ))}
        </div>

        <button className="bg-indigo-600 text-white font-bold py-4 px-8 rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all active:translate-y-0 text-sm">
          + Start Group
        </button>
      </header>

      <main className="max-w-7xl mx-auto">
        {loading ? (
          <div className="h-96 flex flex-col items-center justify-center">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-6"></div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest animate-pulse">Converging community energies...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {data?.initialGroups?.length > 0 ? (
              data.initialGroups.map((group) => (
                <div key={group.group_id} className="premium-card group hover:-translate-y-2 transition-all duration-500 border-white bg-white/70 backdrop-blur-3xl p-6 flex flex-col">
                  <div className="flex items-start justify-between mb-6">
                    <div className="relative">
                      <img 
                        src={group.icon_url || '/uploads/avatars/default.png'} 
                        className="w-20 h-20 rounded-3xl object-cover shadow-2xl shadow-slate-200 group-hover:scale-105 transition-transform duration-500" 
                        alt={group.name} 
                      />
                      {group.is_public === 0 && (
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center text-white border-4 border-white shadow-lg">🔒</div>
                      )}
                    </div>
                    <div className="flex flex-col items-end">
                       <span className="text-2xl font-black text-slate-800 leading-none">{group.member_count || 0}</span>
                       <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Sparklers</span>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">{group.name}</h3>
                  <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed mb-6 flex-1">{group.description || 'No description provided by the guardians of this tribe.'}</p>
                  
                  <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex -space-x-3">
                       {[1,2,3].map(i => (
                         <div key={i} className="w-8 h-8 rounded-xl bg-slate-200 border-2 border-white overflow-hidden shadow-sm">
                           <img src={`https://ui-avatars.com/api/?name=User+${i}&background=random`} alt="" />
                         </div>
                       ))}
                    </div>
                    <button className="px-6 py-3 rounded-2xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-slate-800 shadow-xl shadow-slate-100 transition-all active:scale-95">
                      {group.user_membership_status === 'active' ? 'Visit Sphere' : 'Request Join'}
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-32 flex flex-col items-center justify-center bg-white/50 rounded-[40px] border-2 border-dashed border-slate-200">
                 <div className="text-6xl mb-6 grayscale opacity-30">🏔️</div>
                 <h2 className="text-2xl font-bold text-slate-800">Silence in the valley...</h2>
                 <p className="text-slate-400 text-sm mt-2 max-w-xs text-center font-medium">No communities match your current resonance. Why not pioneer a new tribe and ignite the first spark?</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
