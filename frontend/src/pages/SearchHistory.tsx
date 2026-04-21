import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, Clock, Trash2, X, Lock, Search as SearchIcon, User
} from 'lucide-react';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { useUserStore } from '../store/userStore';

export default function SearchHistory() {
  const navigate = useNavigate();
  const { user: currentUser } = useUserStore();
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
    if (!window.confirm("Clear all search history?")) return;
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

  // --- 🧠 GROUP BY DATE LOGIC 🧠 ---
  const groupedHistory = history.reduce((groups: any, item: any) => {
    const date = new Date(item.searched_at).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(item);
    return groups;
  }, {});

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
  };

  return (
    <div className="bg-[#F0F2F5] min-h-screen">
      <Navbar />
      
      <div className="lg:ml-[80px] xl:ml-[80px] min-h-screen pb-40">
        
        {/* STICKY HEADER */}
        <header className="sticky top-0 z-[2000] bg-white px-4 md:px-8 py-4 border-b border-slate-200 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <ChevronLeft size={24} className="text-[#111]" strokeWidth={2.5} />
              </button>
              <div>
                <h1 className="text-[18px] md:text-[20px] font-bold text-[#111] leading-tight">Search history</h1>
                <p className="text-[12px] font-medium text-slate-500 uppercase tracking-wider">Activity Log</p>
              </div>
          </div>
          {history.length > 0 && (
            <button 
                onClick={clearAll}
                className="text-[13px] font-bold text-blue-600 hover:underline px-4 py-2"
            >
                Clear History
            </button>
          )}
        </header>

        <main className="max-w-3xl mx-auto w-full py-6 md:py-8">
          {loading ? (
            <div className="py-20 flex justify-center opacity-20">
              <div className="w-10 h-10 border-4 border-[#111] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : history.length === 0 ? (
            <div className="py-40 text-center">
              <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100">
                <SearchIcon size={32} className="text-slate-300" strokeWidth={2} />
              </div>
              <h3 className="text-[20px] font-bold text-slate-800">No history found</h3>
              <p className="text-[14px] mt-2 text-slate-500 max-w-xs mx-auto">When you search on Sparkle, your activity will appear here to help you find things again.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedHistory).map(([date, items]: [string, any]) => (
                <div key={date} className="bg-white md:rounded-xl shadow-sm border-y md:border border-slate-200 overflow-hidden">
                  {/* DATE HEADER */}
                  <div className="px-5 py-4 bg-slate-50/50 border-b border-slate-100">
                    <h2 className="text-[15px] font-bold text-slate-900">{date}</h2>
                  </div>

                  {/* ITEMS */}
                  <div className="divide-y divide-slate-100">
                    {items.map((item: any) => (
                      <div 
                        key={item.id}
                        className="flex gap-4 p-5 hover:bg-slate-50 transition-all group relative"
                      >
                        {/* PROFILE PIC CIRCLE */}
                        <div className="shrink-0">
                          <div className="w-10 h-10 rounded-full ring-1 ring-slate-200 overflow-hidden bg-slate-100">
                            {currentUser?.avatar_url ? (
                              <img src={currentUser.avatar_url} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <User size={20} />
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* CONTENT AREA */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col">
                            <span className="text-[14px] text-slate-600 leading-snug">
                              You searched Sparkle
                            </span>
                            <span 
                                onClick={() => navigate(`/search?q=${item.query}`)}
                                className="text-[16px] font-bold text-[#111] cursor-pointer hover:underline decoration-2 underline-offset-2 mb-1"
                            >
                                "{item.query}"
                            </span>
                            
                            {/* PRIVACY & TIME ROW */}
                            <div className="flex items-center gap-4 mt-0.5">
                                <div className="flex items-center gap-1.5 text-slate-500 font-medium text-[12px]">
                                    <Lock size={12} strokeWidth={2.5} />
                                    <span>Only me</span>
                                </div>
                                <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                <span className="text-slate-500 font-medium text-[12px]">
                                    {formatTime(item.searched_at)}
                                </span>
                            </div>
                          </div>
                        </div>

                        {/* DELETE BUTTON */}
                        <button 
                          onClick={() => deleteItem(item.id)}
                          className="p-2 text-slate-300 hover:text-[#111] hover:bg-slate-100 rounded-full transition-all self-start"
                        >
                          <X size={20} strokeWidth={2.5} />
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
        body { background-color: #F0F2F5; }
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        main { animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
}
