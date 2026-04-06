import { useState, useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';

export default function Confessions() {
  const { user } = useUserStore();
  const [confessions, setConfessions] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [campus, setCampus] = useState(user?.campus || 'all');

  useEffect(() => {
    const fetchConfessions = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/confessions?campus=${campus}`);
        setConfessions(response.data.confessions || response.data || []);
      } catch (err) {
        console.error('Failed to fetch confessions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfessions();
  }, [campus]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;

    setSubmitting(true);
    try {
      const response = await api.post('/confessions', { content, campus });
      if (response.data.success) {
        setContent('');
        const res = await api.get(`/confessions?campus=${campus}`);
        setConfessions(res.data.confessions || res.data || []);
      }
    } catch (err) {
      console.error('Confession failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReact = async (id: string) => {
    try {
      await api.post(`/confessions/${id}/react`);
      setConfessions(prev => prev.map(c => 
        c.confession_id === id ? { ...c, react_count: (c.react_count || 0) + 1 } : c
      ));
    } catch (err) {
      console.error('Reaction failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <Navbar />
      
      <main className="max-w-4xl mx-auto px-4 py-20">
        <div className="flex flex-col items-center text-center mb-16">
           <div className="w-20 h-20 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center text-4xl shadow-2xl shadow-indigo-500/20 mb-8 border-4 border-indigo-500/30">🌚</div>
           <h1 className="text-5xl font-black tracking-tighter mb-4">Shadow Whispers</h1>
           <p className="text-xs font-black text-indigo-400 uppercase tracking-[0.3em]">The Sanctuary of Anonymous Campus Truths</p>
           
           <div className="mt-10 flex gap-2 bg-slate-800 p-1.5 rounded-2xl border border-slate-700/50">
              {['all', 'main', 'north', 'south'].map(c => (
                <button 
                  key={c}
                  onClick={() => setCampus(c)}
                  className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    campus === c ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {c}
                </button>
              ))}
           </div>
        </div>

        {/* Post Box */}
        <div className="premium-card bg-slate-800 border-slate-700/50 mb-16 shadow-2xl overflow-hidden group">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 group-focus-within:opacity-100 transition-all"></div>
           <form onSubmit={handlePost} className="p-8">
              <textarea 
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Release your secret into the ether..." 
                className="w-full bg-slate-900/50 border border-slate-700 rounded-3xl p-6 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all placeholder:text-slate-600 min-h-[140px] resize-none"
              />
              <div className="flex justify-between items-center mt-6">
                 <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Signal Encrypted</span>
                 </div>
                 <button 
                  disabled={!content.trim() || submitting}
                  className="px-10 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-500/20 active:scale-95 disabled:opacity-30"
                 >
                   {submitting ? 'Vanishing...' : 'Release'}
                 </button>
              </div>
           </form>
        </div>

        {/* Feed */}
        <div className="space-y-8">
           {loading ? (
             <div className="py-20 text-center flex flex-col items-center">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Deciphering Whispers...</p>
             </div>
           ) : confessions.length > 0 ? confessions.map((conf, idx) => (
             <div key={conf.confession_id || idx} className="premium-card bg-slate-800 border-slate-700/30 p-8 hover:border-slate-600 transition-all">
                <div className="flex justify-between items-start mb-6">
                   <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-slate-600 rounded-full"></span>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fragment #{String(idx + 1000).padStart(4, '0')}</span>
                   </div>
                   <span className="text-[9px] font-black text-slate-600 uppercase">Resonated {new Date(conf.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-slate-300 text-lg font-medium leading-relaxed italic mb-8">"{conf.content}"</p>
                
                <div className="flex gap-6 border-t border-slate-700/50 pt-6">
                   <button 
                     onClick={() => handleReact(conf.confession_id)}
                     className="flex items-center gap-2 group"
                   >
                      <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-lg group-hover:bg-rose-500/20 group-hover:text-rose-500 transition-all">🖤</div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{conf.react_count || 0} Solidarity</span>
                   </button>
                   <button className="flex items-center gap-2 group opacity-40">
                      <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-lg group-hover:bg-indigo-500/20 group-hover:text-indigo-500 transition-all">💬</div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Observe Signals</span>
                   </button>
                </div>
             </div>
           )) : (
             <div className="py-20 text-center bg-slate-800/30 rounded-[3rem] border-2 border-dashed border-slate-700">
                <p className="text-sm font-black text-slate-600 uppercase tracking-widest">The silence is absolute.</p>
             </div>
           )}
        </div>
      </main>
    </div>
  );
}
