import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Clock, Trash2, MoreHorizontal
} from 'lucide-react';
import api from '../api/api';
import Navbar from '../components/Navbar';

export default function SearchHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  const deleteItem = async (id: number) => {
    try {
      await api.delete(`/search/history/${id}`);
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error('Delete item failed:', err);
    }
  };

  const clearAll = async () => {
    try {
      await api.delete('/search/history');
      setHistory([]);
    } catch (err) {
      console.error('Clear all failed:', err);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return (
    <div className="bg-white min-h-[101vh] overflow-y-auto">
      <Navbar />
      
      {/* 🏙️ FACEBOOK STYLE HISTORY PAGE 🏙️ */}
      <div className="lg:ml-[80px] xl:ml-[80px] bg-white min-h-screen pb-40">
        
        {/* STICKY HEADER */}
        <header className="sticky top-0 z-[2000] bg-white/95 backdrop-blur-md px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
                  <ChevronLeft size={28} className="text-[#111]" strokeWidth={2.5} />
              </button>
              <h1 className="text-[20px] font-black text-[#111] tracking-tight">Search History</h1>
          </div>
          {history.length > 0 && (
            <button 
                onClick={clearAll}
                className="text-[13px] font-black text-rose-500 uppercase tracking-widest px-4 py-2 bg-rose-50 rounded-xl hover:bg-rose-100 transition-all border border-rose-100"
            >
                Clear All
            </button>
          )}
        </header>

        {/* NATURAL FLOWING LIST */}
        <main className="max-w-2xl mx-auto w-full px-6 py-8">
          {loading ? (
            <div className="py-20 flex justify-center opacity-20">
              <div className="w-10 h-10 border-4 border-[#111] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="py-40 text-center opacity-30">
              <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Clock size={32} strokeWidth={2.5} />
              </div>
              <h3 className="text-[18px] font-black text-[#111] uppercase tracking-widest">Your history is clear</h3>
              <p className="text-[12px] mt-2 font-bold uppercase tracking-widest text-slate-400">Past searches will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {history.map((item, i) => (
                <div 
                  key={`hist-item-${item.id || i}`}
                  className="flex items-center gap-5 py-5 px-2 hover:bg-slate-50 transition-all group relative border-b border-transparent"
                >
                  <div className="w-[48px] h-[48px] rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 group-hover:bg-white transition-colors">
                    <Clock size={22} />
                  </div>
                  
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/search?q=${item.query}`)}>
                    <div className="text-[16px] font-bold text-slate-800 truncate leading-tight mb-1 group-hover:text-blue-600 transition-colors">
                        {item.query}
                    </div>
                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em]">
                        {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>

                  <button 
                    onClick={() => deleteItem(item.id)}
                    className="p-3 text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all"
                    title="Delete entry"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* EXTRA BOTTOM PADDING FOR SMOOTH SCROLL */}
          <div className="h-40" />
        </main>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        main { animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
}
