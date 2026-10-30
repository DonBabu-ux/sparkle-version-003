import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, History, Calendar, Sparkles, ChevronRight, Share2, X } from 'lucide-react';
import api from '../api/api';
import type { Post } from '../types/post';
import { logger } from '../utils/logger';
import { showSuccess } from '../utils/toast';

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
        logger.error('Failed to fetch memories:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMemories();
  }, []);

  return (
    <div className="bg-[#f8e7ed] dark:bg-zinc-900 min-h-dvh text-[#18181b] dark:text-zinc-100 font-sans transition-colors duration-300 overflow-x-hidden">
      <main className="flex-1 p-6 lg:p-12 relative z-10 max-w-5xl mx-auto w-full">
        <div className="max-w-[700px] mx-auto pb-24">
          <header className="flex gap-5 mb-10 items-start">
            <button
              onClick={() => navigate(-1)}
              className="w-11 h-11 rounded-full bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 flex items-center justify-center text-[#18181b] dark:text-zinc-100 shadow-sm hover:text-primary transition-colors shrink-0"
            >
              <ArrowLeft size={20} strokeWidth={2.5} />
            </button>
            <div className="min-w-0">
              <h1 className="text-3xl font-black text-[#18181b] dark:text-zinc-100 tracking-tight leading-none">Memories</h1>
              <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1">Relive your favorite moments</p>
            </div>
          </header>

          <div className="space-y-10">
            {/* Today's Special Memory */}
            <div className="bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-3xl p-8 shadow-sm relative overflow-hidden group">
              <div className="flex flex-col items-center text-center">
                <div className="inline-flex items-center gap-2 bg-[#f0e5ec] dark:bg-zinc-700 px-3 py-1.5 rounded-full text-xs font-semibold text-[#18181b] dark:text-zinc-100 mb-6">
                  <Calendar size={14} strokeWidth={2.5} className="text-primary" />
                  <span>On this day</span>
                </div>

                <div className="text-slate-600 dark:text-zinc-400 text-xs font-semibold mb-1">{new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                <h3 className="text-lg font-bold text-[#18181b] dark:text-zinc-100 mb-6">On this day in previous years</h3>

                {memories.length > 0 ? (
                  <div
                    className="w-full aspect-video rounded-2xl overflow-hidden cursor-pointer relative shadow-sm group/img"
                    onClick={() => setPreviewImage(memories[0])}
                  >
                    <img
                      src={memories[0].media_url || '/uploads/posts/default.png'}
                      className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                      alt=""
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity duration-300">
                      <div className="w-14 h-14 bg-black/40 rounded-full flex items-center justify-center text-white">
                        <Sparkles size={24} strokeWidth={2} className="text-[#ff1493]" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full py-12 bg-[#f6eef3] dark:bg-zinc-900 rounded-2xl border-2 border-dashed border-[#e6d8e1] dark:border-zinc-700 flex flex-col items-center gap-4 text-slate-600 dark:text-zinc-400">
                    <History size={40} strokeWidth={1.5} />
                    <p className="text-[13px]">No posts found from this day.</p>
                  </div>
                )}
              </div>
            </div>

            {/* List of Recent Memories */}
            <div>
              <div className="flex items-center justify-between mb-6 px-2">
                <h2 className="text-lg font-bold text-[#18181b] dark:text-zinc-100">Past highlights</h2>
                <div className="h-px flex-1 bg-[#ede3e9] dark:bg-zinc-900 mx-6"></div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {loading ? (
                  Array(4).fill(0).map((_, i) => (
                    <div key={i} className="aspect-square bg-[#f6eef3] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-2xl animate-pulse" />
                  ))
                ) : memories.map(memory => (
                  <div
                    key={memory.post_id}
                    className="bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-2xl overflow-hidden shadow-sm cursor-pointer group"
                    onClick={() => setPreviewImage(memory)}
                  >
                    <div className="relative h-48 overflow-hidden">
                      <img src={memory.media_url || '/uploads/posts/default.png'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="" />
                      <div className="absolute top-3 right-3 bg-black/60 px-2.5 py-1 rounded-full text-white text-[11px] font-semibold">
                        {new Date(memory.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div className="p-5">
                      <p className="text-sm text-slate-600 dark:text-zinc-400 truncate">
                        {memory.content || 'A memory worth keeping'}
                      </p>
                      <div className="flex items-center justify-between mt-4">
                        <div className="flex items-center gap-1.5 text-primary">
                          <Sparkles size={14} strokeWidth={2.5} />
                          <span className="text-xs font-bold">{memory.sparks || 0}</span>
                        </div>
                        <ChevronRight size={18} className="text-slate-600 dark:text-zinc-400 group-hover:translate-x-1 transition-transform" strokeWidth={2.5} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={async () => {
                  const url = `${window.location.origin}/memories`;
                  if (navigator.share) {
                    try {
                      await navigator.share({ title: 'My Sparkle Memories', url });
                      return;
                    } catch { /* dismissed — fall through to copy */ }
                  }
                  try {
                    await navigator.clipboard.writeText(url);
                    showSuccess('Memories link copied to clipboard!');
                  } catch { /* clipboard unavailable */ }
                }}
                className="w-full h-12 flex items-center justify-center gap-2 bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-2xl text-[#18181b] dark:text-zinc-100 text-sm font-bold hover:bg-primary hover:text-white hover:border-primary transition-colors group shadow-sm"
              >
                <Share2 size={16} strokeWidth={2.5} className="group-hover:rotate-12 transition-transform" />
                <span>Share memories</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-(--z-modal) flex items-center justify-center p-4 md:p-10 animate-fade-in" onClick={() => setPreviewImage(null)}>
          <div className="absolute inset-0 bg-black/90"></div>
          
          <button
            className="absolute top-8 right-8 w-12 h-12 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center text-white z-10 transition-colors"
            onClick={() => setPreviewImage(null)}
          >
            <X size={22} strokeWidth={2.5} />
          </button>

          <div className="relative z-10 w-full max-w-5xl h-full flex flex-col items-center justify-center gap-8" onClick={e => e.stopPropagation()}>
            <img
              src={previewImage.media_url || '/uploads/posts/default.png'}
              alt="Memory"
              className="max-w-full max-h-[75vh] object-contain rounded-2xl animate-scale-in"
            />

            <button
              className="px-6 h-11 bg-white/15 border border-white/25 rounded-full text-white text-sm font-bold hover:bg-primary hover:border-primary transition-colors flex items-center gap-2"
              onClick={() => navigate(`/post/${previewImage.post_id}`)}
            >
              View full post <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



