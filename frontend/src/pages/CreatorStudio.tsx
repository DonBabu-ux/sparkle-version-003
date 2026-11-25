import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, Video, Flame, Play, Sparkles, FileText, Image as ImageIcon, Radio } from 'lucide-react';
import Skeleton from '../components/ui/Skeleton';
import { logger } from '../utils/logger';

interface StudioStats {
  followers: number;
  totalSparks: number;
  videoViews: number;
}

interface UploadedContent {
  id: string;
  type: 'Video' | 'Image' | 'Text';
  title: string;
  reach: number;
  comments: number;
  sparks: number;
  created_at: string;
}

export default function CreatorStudio() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StudioStats | null>(null);
  const [content] = useState<UploadedContent[]>([]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/analytics/creator');
      setStats({
        followers: res.data.followers || 0,
        totalSparks: res.data.totalSparks || 0,
        videoViews: res.data.videoViews || 0,
      });
    } catch (e) {
      logger.error('Failed to load stats:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="min-h-dvh bg-[#f8e7ed] dark:bg-zinc-900 text-[#18181b] dark:text-zinc-100 font-sans pb-16">

      {/* Header */}
      <div className="bg-[#fdf8fa] dark:bg-zinc-800 border-b border-[#e6d8e1] dark:border-zinc-700 px-4 py-3 sticky top-0 z-50 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-[#f6eef3] dark:hover:bg-zinc-700 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-[#18181b] dark:text-zinc-100" strokeWidth={2.5} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-[#18181b] dark:text-zinc-100 tracking-tight leading-none">Creator Studio</h1>
            <p className="text-xs text-slate-600 dark:text-zinc-300 mt-0.5">Create and manage your content</p>
          </div>
        </div>
        <button onClick={fetchStats} className="p-2 hover:bg-[#f6eef3] dark:hover:bg-zinc-700 rounded-full transition-colors text-slate-600 dark:text-zinc-300">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <main className="max-w-[1000px] mx-auto p-4 md:p-6 space-y-6">
        {loading ? (
          <div className="animate-fade-in space-y-6">
            {/* Quick Actions Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-[#fdf8fa] dark:bg-zinc-800 p-5 rounded-3xl border border-[#e6d8e1] dark:border-zinc-700 shadow-sm flex items-start justify-between gap-3">
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                  <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                </div>
              ))}
            </div>

            {/* Studio Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-[#fdf8fa] dark:bg-zinc-800 p-6 rounded-3xl border border-[#e6d8e1] dark:border-zinc-700 shadow-sm space-y-3">
                  <Skeleton className="h-8 w-8 rounded-2xl" />
                  <Skeleton className="h-7 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>

            {/* Recent content list */}
            <div className="bg-[#fdf8fa] dark:bg-zinc-800 p-6 rounded-3xl border border-[#e6d8e1] dark:border-zinc-700 shadow-sm space-y-4">
              <Skeleton className="h-4 w-32" />
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-14 h-14 rounded-2xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-8 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            {/* Quick Actions Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: 'Upload moment', desc: 'Share a short video with your followers.', icon: <Video size={18} />, onClick: () => navigate('/moments/create') },
                { title: 'Create story', desc: 'Post a story to the student wall.', icon: <Sparkles size={18} />, onClick: () => navigate('/afterglow/create') },
                { title: 'Go live', desc: 'Start a live stream with your followers.', icon: <Radio size={18} />, onClick: () => navigate('/streams') },
              ].map((act, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -3, scale: 1.02 }}
                  onClick={act.onClick}
                  className="bg-[#fdf8fa] dark:bg-zinc-800 p-5 rounded-3xl cursor-pointer shadow-sm flex items-start justify-between border border-[#e6d8e1] dark:border-zinc-700 hover:border-[#ff1493]/40 transition-colors"
                >
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-[#18181b] dark:text-zinc-100">{act.title}</h3>
                    <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">{act.desc}</p>
                  </div>
                  <span className="text-[#ff1493]">{act.icon}</span>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              {/* Studio Stats Summary */}
              <div className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-3xl p-6 border border-[#e6d8e1] dark:border-zinc-700 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-[#18181b] dark:text-zinc-100">Your stats</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Followers', value: stats?.followers || 0, icon: <Flame size={16} className="text-[#ff1493]" /> },
                    { label: 'Sparks received', value: stats?.totalSparks || 0, icon: <Flame size={16} className="text-[#ff1493]" /> },
                    { label: 'Video views', value: stats?.videoViews || 0, icon: <Play size={16} className="text-[#ff1493]" /> },
                  ].map((st, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-2xl">
                      <div className="flex items-center gap-2">
                        {st.icon}
                        <span className="text-xs uppercase tracking-wide font-semibold text-slate-600 dark:text-zinc-300">{st.label}</span>
                      </div>
                      <span className="text-sm font-bold text-[#18181b] dark:text-zinc-100">{st.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Uploaded Portfolio Content List */}
              <div className="md:col-span-2 bg-[#fdf8fa] dark:bg-zinc-800 rounded-3xl p-6 border border-[#e6d8e1] dark:border-zinc-700 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-[#18181b] dark:text-zinc-100">Recent uploads</h3>
                {content.length > 0 ? (
                  <div className="space-y-3">
                    {content.map((item) => (
                      <div key={item.id} className="p-4 bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-[#ff1493]">
                            {item.type === 'Video' ? <Video size={16} /> :
                             item.type === 'Image' ? <ImageIcon size={16} /> :
                             <FileText size={16} />}
                          </span>
                          <div>
                            <h4 className="text-sm font-bold text-[#18181b] dark:text-zinc-100 leading-none">{item.title}</h4>
                            <p className="text-xs font-medium text-slate-600 dark:text-zinc-300 mt-1.5 flex items-center gap-2">
                              <span>{item.type}</span>
                              <span>•</span>
                              <span>{new Date(item.created_at).toLocaleDateString('en-KE', { dateStyle: 'medium' })}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-4 items-center">
                          <div className="text-right">
                            <p className="text-sm font-bold text-[#18181b] dark:text-zinc-100">{item.reach.toLocaleString()}</p>
                            <p className="text-xs font-medium text-slate-600 dark:text-zinc-300">reach</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-[#18181b] dark:text-zinc-100">{item.sparks.toLocaleString()}</p>
                            <p className="text-xs font-medium text-slate-600 dark:text-zinc-300">sparks</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText size={32} className="text-slate-600 dark:text-zinc-300 mb-3" />
                    <p className="text-sm font-bold text-[#18181b] dark:text-zinc-100">No uploads yet</p>
                    <p className="text-xs text-slate-600 dark:text-zinc-300 mt-1">Content you upload will show up here.</p>
                  </div>
                )}
              </div>
            </div>
            </div>
          )}
      </main>
    </div>
  );
}
