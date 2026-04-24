import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Clock, Trash2, RotateCw, Lock, Sparkles, X
} from 'lucide-react';
import api from '../api/api';
import Navbar from '../components/Navbar';

export default function SearchHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<{ id: string; query: string; searched_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
      setToast({ message, type });
      setTimeout(() => setToast(null), 3000);
  };

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/search/history');
      if (res.data.status === 'success') setHistory(res.data.data || []);
    } catch (err) {
      console.error('History fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteItem = async (id: string) => {
    try {
      await api.delete(`/search/history/${id}`);
      setHistory(prev => prev.filter(item => item.id !== id));
      showToast('Memory cleared.');
    } catch (err) {
      console.error('Delete item failed:', err);
      showToast('Failed to clear memory.', 'error');
    }
  };

  const clearAll = async () => {
    if (!window.confirm("Erase all search memories? This cannot be undone.")) return;
    try {
      await api.delete('/search/history');
      setHistory([]);
      showToast('All memories erased.');
    } catch (err) {
      console.error('Clear all failed:', err);
      showToast('Failed to clear history.', 'error');
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const groupedHistory = history.reduce((groups: Record<string, typeof history>, item) => {
    const date = new Date(item.searched_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(item);
    return groups;
  }, {});

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex bg-white min-h-screen text-black font-sans overflow-x-hidden selection:bg-primary/10">
      <Navbar />
      
      {/* Cinematic Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] right-[-5%] w-[60vw] h-[60vw] bg-primary/[0.03] rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-5%] w-[40vw] h-[40vw] bg-indigo-500/[0.02] rounded-full blur-[100px]" />
      </div>

      <main className="flex-1 lg:ml-72 flex flex-col relative z-10">
        
        {/* Sleek Header */}
        <header className="sticky top-0 z-[100] bg-white/70 backdrop-blur-3xl border-b border-black/[0.03] px-6 py-8">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => navigate(-1)} 
                className="w-12 h-12 flex items-center justify-center bg-black/5 hover:bg-black hover:text-white rounded-2xl transition-all active:scale-95 group shadow-sm"
              >
                  <ArrowLeft size={18} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
              </button>
              <div>
                <h1 className="text-xl font-black text-black uppercase tracking-tight italic leading-none">History</h1>
                <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.2em] mt-2">Your search signals</p>
              </div>
            </div>

            {history.length > 0 && (
              <button 
                onClick={clearAll} 
                className="px-6 py-3 bg-red-50 hover:bg-red-500 hover:text-white text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border border-red-100"
              >
                Clear All
              </button>
            )}
          </div>
        </header>

        <main className="max-w-3xl mx-auto w-full p-6 lg:p-12 pb-40">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-6 opacity-20">
               <RotateCw className="animate-spin" size={40} strokeWidth={2.5} />
               <span className="text-[10px] font-black uppercase tracking-[0.3em]">Syncing frequencies...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <div className="w-24 h-24 bg-black/[0.02] rounded-[32px] flex items-center justify-center text-black/10 mb-8 shadow-inner">
                <Clock size={48} strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-black text-black italic uppercase tracking-tight mb-3">Clean Slate</h2>
              <p className="text-black/20 font-bold text-sm max-w-[280px] leading-relaxed">Your search memories are empty. Time to discover new sparks in the village!</p>
              <button 
                onClick={() => navigate('/search')} 
                className="mt-10 px-10 py-5 bg-black text-white rounded-[24px] font-black text-xs uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-black/10 italic"
              >
                Start Searching
              </button>
            </div>
          ) : (
            <div className="space-y-16 animate-in fade-in duration-700">
              {Object.entries(groupedHistory).map(([date, items], idx) => (
                <div key={date} className="animate-in slide-in-from-bottom-4 duration-700" style={{ animationDelay: `${idx * 0.1}s` }}>
                  <div className="flex items-center gap-4 mb-8">
                     <h3 className="text-xs font-black text-black italic uppercase tracking-[0.2em] opacity-20">{date}</h3>
                     <div className="flex-1 h-[1px] bg-black/[0.05]" />
                  </div>
                  
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex items-center gap-6 p-6 bg-black/[0.02] hover:bg-black text-black hover:text-white rounded-[32px] transition-all group duration-500 shadow-sm"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-black/[0.03] group-hover:bg-white/10 flex items-center justify-center text-black/10 group-hover:text-white transition-all">
                          <Clock size={20} strokeWidth={2.5} />
                        </div>
                        
                        <div className="flex-1 cursor-pointer min-w-0" onClick={() => navigate(`/search?q=${item.query}`)}>
                          <span className="block text-xl font-black italic leading-none truncate mb-2">"{item.query}"</span>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">
                              {formatTime(item.searched_at)}
                            </span>
                            <span className="opacity-10 text-xs">•</span>
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest opacity-40 group-hover:text-primary transition-colors">
                              <Lock size={12} />
                              <span>Private Memory</span>
                            </div>
                          </div>
                        </div>

                        <button 
                          onClick={() => deleteItem(item.id)}
                          className="w-10 h-10 flex items-center justify-center text-black/10 hover:text-white hover:bg-red-500 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={18} strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </main>

      {/* Minimal Toast */}
      <AnimatePresence>
          {toast && (
              <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 px-8 py-4 rounded-2xl shadow-2xl z-[9999] font-black text-[10px] uppercase tracking-widest ${toast.type === 'success' ? 'bg-black text-white' : 'bg-red-500 text-white'}`}
              >
                  {toast.type === 'success' ? <Sparkles size={16} className="text-primary" strokeWidth={3} /> : <X size={16} strokeWidth={3} />}
                  {toast.message}
              </motion.div>
          )}
      </AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
