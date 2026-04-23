import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Clock, Trash2, RotateCw, Lock
} from 'lucide-react';
import api from '../api/api';
import Navbar from '../components/Navbar';

export default function SearchHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<{ id: string; query: string; searched_at: string }[]>([]);
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

  const deleteItem = async (id: string) => {
    try {
      await api.delete(`/search/history/${id}`);
      setHistory(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error('Delete item failed:', err);
    }
  };

  const clearAll = async () => {
    if (!window.confirm("Clear all search history? This cannot be undone.")) return;
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
    <div className="search-root">
      <Navbar />
      
      <div className="search-main">
        <header className="s-header">
          <div className="s-header-inner" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
            <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="s-back-btn">
                <ChevronLeft size={22} strokeWidth={3} />
              </button>
              <div>
                <h1 className="text-[18px] font-black text-slate-800 leading-none">History</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mt-1.5">Your search activity</p>
              </div>
            </div>

            {history.length > 0 && (
              <button onClick={clearAll} className="s-see-all text-rose-500 hover:text-rose-600">
                Clear All
              </button>
            )}
          </div>
        </header>

        <main className="s-content" style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
               <RotateCw className="animate-spin text-slate-300" size={32} />
               <span className="text-slate-400 font-bold text-sm tracking-widest uppercase">Syncing...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300 mb-6">
                <Clock size={40} />
              </div>
              <h2 className="text-xl font-black text-slate-800 mb-2">Clean Slate</h2>
              <p className="text-slate-400 font-medium max-w-[240px]">Your search history is empty. Time to discover something new!</p>
              <button onClick={() => navigate('/search')} className="mt-8 px-8 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:scale-105 transition-transform">
                Start Searching
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedHistory).map(([date, items]) => (
                <div key={date} className="animate-fade-in">
                  <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 pl-2">{date}</h3>
                  <div className="s-card space-y-1">
                    {items.map((item) => (
                      <div key={item.id} className="s-hist-item group">
                        <div className="s-hist-icon">
                          <Clock size={18} strokeWidth={2.5} />
                        </div>
                        <div className="flex-1 cursor-pointer" onClick={() => navigate(`/search?q=${item.query}`)}>
                          <span className="s-hist-text">"{item.query}"</span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-bold text-slate-400">
                              {formatTime(item.searched_at)}
                            </span>
                            <span className="text-slate-300">•</span>
                            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400">
                              <Lock size={10} />
                              <span>Only me</span>
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteItem(item.id)}
                          className="s-hist-more hover:text-rose-500 hover:bg-rose-50"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <style>{`
        .search-root { display:flex; min-height:100vh; background:#f7f8fc; font-family:'Outfit','Inter',system-ui,sans-serif; }
        .search-main { flex:1; min-width:0; display:flex; flex-direction:column; }
        .s-header { position:sticky; top:0; z-index:100; background:rgba(255,255,255,0.8); backdrop-filter:blur(20px); border-bottom:1.5px solid rgba(241,245,249,0.8); padding:20px 40px; display:flex; align-items:center; }
        .s-header-inner { display:flex; align-items:center; justify-content:space-between; width:100%; }
        .s-back-btn { width:44px; height:44px; border-radius:14px; background:#fff; border:1.5px solid #edf2f7; display:flex; align-items:center; justify-content:center; color:#1e293b; transition:all 0.2s; cursor:pointer; }
        .s-back-btn:hover { background:#f8fafc; border-color:#FF3D6D; color:#FF3D6D; transform:translateX(-3px); }
        .s-content { padding:32px 40px 100px; }
        .s-card { background:#fff; border-radius:28px; padding:12px; border:1px solid #edf0f7; box-shadow:0 10px 30px rgba(0,0,0,0.02); }
        .s-see-all { font-size:12px; font-weight:800; text-transform:uppercase; letter-spacing:1px; cursor:pointer; transition:all 0.2s; }
        .s-see-all:hover { transform:translateY(-1px); }

        .s-hist-item { display:flex; align-items:center; gap:16px; padding:12px 16px; border-radius:18px; transition:all 0.2s; }
        .s-hist-item:hover { background:#f8fafc; }
        .s-hist-icon { width:42px; height:42px; border-radius:14px; background:#f1f5f9; display:flex; align-items:center; justify-content:center; color:#94a3b8; transition:all 0.2s; }
        .s-hist-item:hover .s-hist-icon { background:#fff; color:#FF3D6D; box-shadow:0 4px 12px rgba(255,61,109,0.1); }
        .s-hist-text { font-size:16px; font-weight:700; color:#1e293b; letter-spacing:-0.2px; }
        .s-hist-more { color:#cbd5e1; padding:10px; border-radius:12px; transition:all 0.2s; }
        .s-hist-more:hover { color:#ef4444; background:#fff1f2; }

        @keyframes fade-in { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .animate-fade-in { animation:fade-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        @media (max-width:640px) {
          .s-header { padding:14px 20px; }
          .s-content { padding:20px 16px 100px; }
          .s-card { border-radius:24px; padding:8px; }
          .s-hist-item { gap:12px; padding:10px; }
          .s-hist-icon { width:38px; height:38px; }
          .s-hist-text { font-size:14px; }
        }
      `}</style>
    </div>
  );
}
