import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, History, Calendar, Sparkles, ChevronRight, Share2, X } from 'lucide-react';
import api from '../api/api';
import Navbar from '../components/Navbar';
import type { Post } from '../types/post';

export default function Memories() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [memories, setMemories] = useState<Post[]>([]);
  const [previewImage, setPreviewImage] = useState<Post | null>(null);

  useEffect(() => {
    const fetchMemories = async () => {
      setLoading(true);
      try {
        // Mocking memories as top posts from the past
        const res = await api.get('/posts/feed?limit=5');
        setMemories(res.data.posts || res.data || []);
      } catch (err) {
        console.error('Failed to fetch memories:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMemories();
  }, []);

  return (
    <div className="flex bg-white dark:bg-black min-h-screen text-black dark:text-white font-sans transition-colors duration-300 overflow-x-hidden">
      <Navbar />
      
      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-4xl mx-auto w-full pt-20 lg:pt-0">
        <div className="max-w-[700px] mx-auto pb-24">
          <header className="flex gap-5 mb-10 items-start">
            <button 
              onClick={() => navigate(-1)} 
              className="w-11 h-11 rounded-full bg-white dark:bg-white/10 border border-black/5 dark:border-white/10 flex items-center justify-center text-black dark:text-white shadow-sm hover:scale-105 active:scale-95 transition-all shrink-0"
            >
              <ArrowLeft size={20} strokeWidth={3} />
            </button>
            <div className="min-w-0">
              <h1 className="text-4xl lg:text-5xl font-black text-black dark:text-white tracking-tighter leading-none italic uppercase">Memories</h1>
              <p className="text-sm font-bold text-black/40 dark:text-white/40 uppercase tracking-widest mt-2">Relive your favorite Sparkle moments</p>
            </div>
          </header>

          <div className="space-y-10">
            {/* Today's Special Memory */}
            <div className="bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-[32px] p-8 shadow-xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] group-hover:scale-110 transition-transform duration-1000">
                <History size={160} strokeWidth={1} />
              </div>

              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-5 py-2 rounded-full font-black text-[10px] uppercase tracking-[0.2em] mb-6">
                  <Calendar size={14} strokeWidth={3} />
                  <span>On This Day</span>
                </div>
                
                <div className="text-black/40 dark:text-white/40 font-bold text-xs uppercase tracking-widest mb-1 italic">{new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                <h3 className="text-3xl font-black text-black dark:text-white italic uppercase tracking-tighter mb-8">1 Year Ago Today</h3>
                
                {memories.length > 0 ? (
                  <div 
                    className="w-full aspect-video rounded-[24px] overflow-hidden cursor-pointer relative shadow-2xl group/img" 
                    onClick={() => setPreviewImage(memories[0])}
                  >
                    <img 
                      src={memories[0].media_url || '/uploads/posts/default.png'} 
                      className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-1000" 
                      alt="" 
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover/img:bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-all duration-500">
                      <div className="w-16 h-16 bg-white/20 backdrop-blur-xl rounded-full flex items-center justify-center text-white scale-75 group-hover/img:scale-100 transition-all duration-500">
                        <Sparkles size={32} strokeWidth={2.5} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full py-16 bg-black/5 dark:bg-white/5 rounded-[24px] border-2 border-dashed border-black/10 dark:border-white/10 flex flex-col items-center gap-4 text-black/20 dark:text-white/20">
                    <History size={48} strokeWidth={1.5} />
                    <p className="font-bold text-xs uppercase tracking-widest italic">No posts found from this day.</p>
                  </div>
                )}
              </div>
            </div>

            {/* List of Recent Memories */}
            <div>
              <div className="flex items-center justify-between mb-6 px-2">
                <h2 className="text-lg font-black text-black dark:text-white italic uppercase tracking-widest">Past Highlights</h2>
                <div className="h-px flex-1 bg-black/5 dark:bg-white/10 mx-6"></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {loading ? (
                  Array(4).fill(0).map((_, i) => (
                    <div key={i} className="aspect-square bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-[28px] animate-pulse" />
                  ))
                ) : memories.map(memory => (
                  <div 
                    key={memory.post_id} 
                    className="bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-[28px] overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 cursor-pointer group" 
                    onClick={() => setPreviewImage(memory)}
                  >
                    <div className="relative h-48 overflow-hidden">
                      <img src={memory.media_url || '/uploads/posts/default.png'} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="" />
                      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl text-white font-black text-[10px] uppercase tracking-widest">
                        {new Date(memory.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div className="p-5">
                      <p className="text-sm font-bold text-black/70 dark:text-white/70 truncate italic">
                        {memory.content || 'A beautiful memory worth keeping...'}
                      </p>
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-1.5 text-primary">
                          <Sparkles size={14} strokeWidth={3} />
                          <span className="text-xs font-black tracking-widest">{memory.sparks || 0}</span>
                        </div>
                        <ChevronRight size={18} className="text-black/20 dark:text-white/20 group-hover:translate-x-1 transition-transform" strokeWidth={3} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6">
              <button className="w-full h-16 flex items-center justify-center gap-3 bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl text-black dark:text-white font-black text-xs uppercase tracking-[0.2em] hover:bg-primary hover:text-white hover:border-primary transition-all duration-500 group shadow-lg active:scale-[0.98]">
                <Share2 size={18} strokeWidth={3} className="group-hover:rotate-12 transition-transform" />
                <span>Share Memories</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 animate-fade-in" onClick={() => setPreviewImage(null)}>
          <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl"></div>
          
          <button 
            className="absolute top-8 right-8 w-12 h-12 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full flex items-center justify-center text-white z-10 transition-all" 
            onClick={() => setPreviewImage(null)}
          >
            <X size={24} strokeWidth={3} />
          </button>

          <div className="relative z-10 w-full max-w-5xl h-full flex flex-col items-center justify-center gap-8" onClick={e => e.stopPropagation()}>
            <img 
              src={previewImage.media_url || '/uploads/posts/default.png'} 
              alt="Memory" 
              className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl animate-scale-in" 
            />
            
            <button 
              className="px-10 py-5 bg-white dark:bg-white/10 border border-white/20 rounded-2xl text-white font-black text-xs uppercase tracking-[0.3em] hover:bg-primary hover:border-primary transition-all duration-500 shadow-2xl flex items-center gap-3 italic"
              onClick={() => navigate(`/post/${previewImage.post_id}`)}
            >
              View Full Post <ChevronRight size={18} strokeWidth={3} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scaleIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
}
