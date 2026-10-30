import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, BarChart2, TrendingUp, Radio, Video, MessageSquare, Share2, Heart, Award, ArrowUpRight, BookOpen } from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import { logger } from '../utils/logger';

interface AnalyticsData {
  profileViews: number;
  followersGrowth: number;
  accountReach: number;
  followers: number;
  totalSparks: number;
  totalComments: number;
  totalShares: number;
  videoViews: number;
  watchTime: number;
  saves: number;
  distribution?: { video: number; image: number; text: number };
}

export default function CreatorAnalytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/analytics/creator');
      setData(res.data);
    } catch (e) {
      logger.error('Failed to load creator analytics:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <div className="min-h-dvh bg-[#f8e7ed] dark:bg-zinc-900 text-[#18181b] dark:text-zinc-100 font-sans pb-16">

      {/* Header */}
      <div className="bg-[#fdf8fa] dark:bg-zinc-800 border-b border-[#e6d8e1] dark:border-zinc-700 px-4 py-3 sticky top-0 z-50 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-[#f6eef3] dark:hover:bg-zinc-700 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-[#18181b] dark:text-zinc-100" strokeWidth={2.5} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-[#18181b] dark:text-zinc-100 tracking-tight leading-none">Creator Analytics</h1>
            <p className="text-xs text-slate-600 dark:text-zinc-300 mt-0.5">How your content is performing</p>
          </div>
        </div>
        <button onClick={fetchAnalytics} className="p-2 hover:bg-[#f6eef3] dark:hover:bg-zinc-700 rounded-full transition-colors text-slate-600 dark:text-zinc-300">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <main className="max-w-[1000px] mx-auto p-4 md:p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-40">
            <Spinner size="large" color="text-[#ff1493]" />
          </div>
        ) : !data ? (
          <div className="text-center py-20 bg-[#fdf8fa] dark:bg-zinc-800 rounded-3xl border border-[#e6d8e1] dark:border-zinc-700 shadow-sm">
            <BarChart2 size={40} className="text-slate-600 dark:text-zinc-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-[#18181b] dark:text-zinc-100">Couldn't load your analytics</p>
          </div>
        ) : (
          <>
            {/* Reach Summary */}
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
              className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-3xl p-6 border border-[#e6d8e1] dark:border-zinc-700 shadow-sm">

              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-zinc-300">Performance overview</span>
                    <h2 className="text-2xl font-bold text-[#18181b] dark:text-zinc-100 tracking-tight mt-1">Creator reach</h2>
                  </div>
                  <div className="bg-[#f0e5ec] dark:bg-zinc-700 text-[#ff1493] px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                    <TrendingUp size={12} /> Growing
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-[#ede3e9] dark:border-zinc-900">
                  <div>
                    <span className="text-xs uppercase tracking-wide font-semibold text-slate-600 dark:text-zinc-300">Followers</span>
                    <p className="text-3xl font-bold text-[#18181b] dark:text-zinc-100 mt-0.5">{(data.followers || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide font-semibold text-slate-600 dark:text-zinc-300">Account reach</span>
                    <p className="text-3xl font-bold text-[#18181b] dark:text-zinc-100 mt-0.5">{(data.accountReach || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide font-semibold text-slate-600 dark:text-zinc-300">Profile views</span>
                    <p className="text-3xl font-bold text-[#18181b] dark:text-zinc-100 mt-0.5">{(data.profileViews || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-xs uppercase tracking-wide font-semibold text-slate-600 dark:text-zinc-300">Gained this month</span>
                    <p className="text-3xl font-bold text-[#18181b] dark:text-zinc-100 mt-0.5">+{(data.followersGrowth || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Detailed Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'Video views',      value: data.videoViews,       icon: <Video size={18} /> },
                { label: 'Total sparks',     value: data.totalSparks,      icon: <Heart size={18} /> },
                { label: 'Comments received', value: data.totalComments,   icon: <MessageSquare size={18} /> },
                { label: 'Total shares',     value: data.totalShares,      icon: <Share2 size={18} /> },
                { label: 'Post saves',       value: data.saves,            icon: <Award size={18} /> },
                { label: 'Watch time (min)', value: data.watchTime,        icon: <Radio size={18} /> },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-2xl p-4 border border-[#e6d8e1] dark:border-zinc-700 shadow-sm"
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs uppercase tracking-wide font-semibold text-slate-600 dark:text-zinc-300">{item.label}</span>
                    <span className="text-[#ff1493]">{item.icon}</span>
                  </div>
                  <p className="text-3xl font-bold text-[#18181b] dark:text-zinc-100 mt-1">{(item.value || 0).toLocaleString()}</p>
                </motion.div>
              ))}
            </div>

            {/* Strategy & Tips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-3xl p-6 border border-[#e6d8e1] dark:border-zinc-700 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-[#18181b] dark:text-zinc-100 flex items-center gap-2">
                  <BookOpen size={18} className="text-[#ff1493]" /> Tips to grow
                </h3>
                <div className="space-y-3">
                  {[
                    'Use Boost Post on your best videos to get them in front of more people.',
                    'Keep your videos between 15 and 30 seconds so people watch them all the way through.',
                    'Ask people to comment in the first 5 seconds to start conversations early.',
                  ].map((tip, idx) => (
                    <div key={idx} className="flex gap-2 text-xs font-medium text-slate-600 dark:text-zinc-300 leading-relaxed">
                      <span className="text-[#ff1493] font-bold">0{idx + 1}.</span>
                      <p>{tip}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-3xl p-6 border border-[#e6d8e1] dark:border-zinc-700 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#18181b] dark:text-zinc-100 flex items-center gap-2">
                    <Award size={18} className="text-[#ff1493]" /> Creator milestone
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed mt-2">
                    Keep posting quality content and staying active with your community to unlock verification.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/verified')}
                  className="w-full mt-4 py-3 bg-[#ff1493] text-white text-sm font-bold rounded-full hover:bg-[#ff2d87] transition-colors flex items-center justify-center gap-1.5"
                >
                  Get verified <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
