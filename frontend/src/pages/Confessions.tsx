import { useState, useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { 
  ShieldCheck, 
  Plus, 
  Orbit, 
  MessageSquare, 
  Heart, 
  Send,
  Flag,
  Globe,
  Ghost
} from 'lucide-react';

interface Confession {
  confession_id: string;
  content: string;
  campus?: string;
  react_count?: number;
  created_at?: string;
}

export default function Confessions() {
  const { user } = useUserStore();
  const [confessions, setConfessions] = useState<Confession[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [campus, setCampus] = useState(user?.campus || 'all');

  useEffect(() => {
    const fetchConfessions = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/confessions?campus=${campus}`);
        const data = response.data;
        const list = data.data || data.confessions || (Array.isArray(data) ? data : []);
        setConfessions(list);
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
      if (response.data.success || response.data.status === 'success') {
        setContent('');
        const res = await api.get(`/confessions?campus=${campus}`);
        const data = res.data;
        const list = data.data || data.confessions || (Array.isArray(data) ? data : []);
        setConfessions(list);
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
    <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
      <Navbar />

      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-4xl mx-auto w-full pt-20 md:pt-32">
        
        {/* Editorial Header */}
        <header className="flex flex-col items-center text-center mb-24 animate-fade-in relative z-10">
          <div className="inline-flex items-center gap-4 px-6 py-2.5 bg-white/80 backdrop-blur-3xl border border-white rounded-full mb-10 shadow-xl shadow-primary/5">
            <Ghost size={18} strokeWidth={3} className="text-primary" />
            <span className="text-[10px] font-black text-black uppercase tracking-[0.4em] italic">Encrypted Transmission</span>
          </div>
          
          <h1 className="text-6xl md:text-9xl font-black text-black tracking-tighter leading-none mb-10 italic uppercase">
             Village <span className="text-primary italic">Vault.</span>
          </h1>
          
          <p className="text-xl font-bold text-black opacity-60 leading-relaxed italic max-w-2xl border-l-8 border-primary/20 pl-8 text-center mx-auto uppercase tracking-tighter">
            Synchronize your filtered thoughts — private harmonics in the village network.
          </p>

          <div className="mt-16 flex flex-wrap justify-center gap-4">
            {[
              { id: 'all',          label: 'Omni',  icon: <Globe size={16} strokeWidth={3} /> },
              { id: 'Main Campus',  label: 'Core',    icon: <Orbit size={16} strokeWidth={3} /> },
              { id: 'North Campus', label: 'North',   icon: <Plus size={16} strokeWidth={3} /> },
              { id: 'South Campus', label: 'South',   icon: <Plus size={16} strokeWidth={3} /> }
            ].map(c => (
              <button
                key={c.id}
                onClick={() => setCampus(c.id)}
                className={`h-16 px-10 rounded-[24px] font-black text-[11px] uppercase tracking-[0.3em] transition-all border shadow-sm italic flex items-center gap-4 ${campus === c.id ? 'bg-white border-white text-primary shadow-2xl shadow-primary/10' : 'bg-white/40 border-white text-black opacity-30 hover:opacity-100 hover:bg-white'}`}
              >
                {c.icon}
                {c.label}
              </button>
            ))}
          </div>
        </header>

        {/* High-Fidelity Compose Area */}
        <div className="max-w-4xl mx-auto mb-24 relative z-10">
          <div className="bg-white/80 backdrop-blur-3xl rounded-[56px] border border-white p-10 shadow-2xl shadow-primary/5 group transition-all">
            <form onSubmit={handlePost}>
              <div className="relative">
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Initiate anonymous broadcast..."
                  className="w-full h-56 bg-black/5 border-4 border-transparent rounded-[40px] p-10 text-2xl font-black text-black placeholder:text-black/10 focus:bg-white focus:border-primary/20 outline-none transition-all resize-none italic shadow-inner"
                />
                <div className="absolute top-8 right-8 pointer-events-none opacity-5 animate-pulse">
                   <Send size={48} strokeWidth={3} />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-between mt-8 gap-8 px-4">
                <div className="flex items-center gap-4 px-6 py-3 bg-black/5 rounded-full border border-black/[0.03]">
                  <div className="w-3 h-3 bg-primary rounded-full animate-ping shadow-2xl shadow-primary"></div>
                  <span className="text-[10px] font-black text-black opacity-30 uppercase tracking-[0.3em] italic">Frequency Shielded</span>
                </div>
                <button
                  type="submit"
                  disabled={!content.trim() || submitting}
                  className="w-full sm:w-auto h-20 px-16 bg-primary text-white rounded-[28px] font-black text-sm uppercase tracking-[0.4em] italic shadow-2xl shadow-primary/40 hover:scale-[1.05] hover:shadow-primary/60 transition-all active:scale-95 disabled:opacity-20 flex items-center justify-center gap-6"
                >
                  {submitting ? 'Syncing...' : 'Start Pulse'}
                  <Send size={24} strokeWidth={4} />
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Premium Feed */}
        <div className="max-w-4xl mx-auto flex flex-col gap-12 pb-64 relative z-10 px-2">
          {loading ? (
            <div className="py-32 flex flex-col items-center gap-8">
               <Orbit size={64} className="text-primary animate-spin-slow" strokeWidth={4} />
               <p className="text-[10px] font-black italic text-black/20 uppercase tracking-[0.4em] animate-pulse">Scanning Frequency Sectors...</p>
            </div>
          ) : confessions.length > 0 ? (
            confessions.map((conf, idx) => (
              <div 
                key={conf.confession_id || idx} 
                className="bg-white/80 backdrop-blur-3xl group hover:scale-[1.02] transition-all duration-700 rounded-[56px] border border-white p-12 relative overflow-hidden shadow-2xl shadow-primary/5 animate-fade-in"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                {/* Background Decor */}
                <div className="absolute top-0 right-0 p-12 text-primary opacity-[0.02] group-hover:opacity-[0.05] transition-all duration-1000 group-hover:rotate-12 group-hover:scale-150">
                   <ShieldCheck size={200} strokeWidth={1} />
                </div>

                <div className="flex items-center justify-between mb-12 relative z-10">
                  <div className="flex items-center gap-6">
                    <div className="w-18 h-18 bg-black text-white rounded-[24px] flex items-center justify-center font-black text-[11px] shadow-2xl italic tracking-tighter uppercase group-hover:rotate-6 transition-transform">
                      {String(idx + 1000).padStart(4, '0')}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] font-black text-black opacity-30 uppercase tracking-[0.3em] italic">Frequency {idx % 2 === 0 ? 'Beta' : 'Gamma'}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] font-black text-black italic uppercase tracking-widest">
                          {conf.created_at ? new Date(conf.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase() : 'RECENT LINK'}
                        </span>
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/20" />
                        <span className="text-[11px] font-black text-primary italic uppercase tracking-widest">{conf.campus || 'Global Spectrum'}</span>
                      </div>
                    </div>
                  </div>
                  <button className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center text-black opacity-10 hover:opacity-100 hover:text-red-500 transition-all shadow-inner border border-black/5">
                     <Flag size={20} strokeWidth={3} />
                  </button>
                </div>

                <p className="text-3xl font-black text-black leading-tight mb-16 relative z-10 italic uppercase tracking-tighter group-hover:text-primary transition-all duration-700">
                  {conf.content}
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-8 pt-12 border-t border-black/5 relative z-10">
                  <button 
                    onClick={() => handleReact(conf.confession_id)} 
                    className="w-full sm:w-auto flex items-center justify-center gap-4 px-10 h-16 bg-white border border-black/5 hover:border-primary/20 hover:bg-white rounded-[24px] transition-all shadow-2xl shadow-primary/5 group/react active:scale-95"
                  >
                    <Heart size={24} className="text-primary group-hover/react:scale-125 transition-transform" fill={conf.react_count && conf.react_count > 0 ? "currentColor" : "none"} strokeWidth={4} />
                    <span className="text-[12px] font-black text-black opacity-40 group-hover/react:text-primary transition-colors italic uppercase tracking-widest">{conf.react_count || 0} Village Resonances</span>
                  </button>
                  <div className="flex items-center gap-4 px-8 h-16 bg-black/[0.02] text-black/20 rounded-[24px] cursor-default border border-black/[0.03]">
                    <MessageSquare size={18} strokeWidth={3} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">Harmonic Intercept Locked</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-64 flex flex-col items-center gap-12 text-center bg-white/40 backdrop-blur-3xl border-4 border-dashed border-white rounded-[80px] shadow-2xl shadow-primary/5 animate-fade-in group px-8">
              <Orbit size={140} strokeWidth={2} className="text-primary animate-spin-slow opacity-10 group-hover:opacity-20 transition-opacity" />
              <div className="space-y-6">
                <h3 className="text-5xl font-black text-black opacity-5 italic uppercase tracking-tighter leading-none">Vacuum State.</h3>
                <p className="text-[10px] font-black text-black opacity-20 uppercase tracking-[0.4em] max-w-xs mx-auto italic">No transmissions found in this frequency sector. Initialize the first signal.</p>
                <button onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})} className="mt-8 px-12 h-18 bg-primary/10 border-2 border-primary/20 text-primary rounded-[24px] font-black uppercase tracking-widest italic hover:bg-primary hover:text-white transition-all">Start Broadcast</button>
              </div>
            </div>
          )}
        </div>
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-spin-slow { animation: spin 20s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
