import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { motion } from 'framer-motion';
import {
  ArrowLeft, RefreshCw, BarChart2, TrendingUp, Users, Radio,
  Eye, Video, MessageSquare, Share2, Heart, Award, ArrowUpRight, BookOpen
} from 'lucide-react';
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
    <div className="min-h-dvh bg-[#fafafd] text-slate-800 font-sans pb-16 relative">
      <style>{`
        .glass-card { background: rgba(255, 255, 255, 0.85); border: 1px solid rgba(255, 31, 109, 0.15); backdrop-filter: blur(20px); }
      `}</style>

      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-50 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-slate-800" strokeWidth={2.5} />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tighter italic uppercase leading-none">Creator Analytics</h1>
            <p className="text-[8px] font-black text-[#FF1F6D] uppercase tracking-widest italic mt-0.5">Real-time performance metrics</p>
          </div>
        </div>
        <button onClick={fetchAnalytics} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <main className="max-w-[1000px] mx-auto p-4 md:p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-40">
            <Spinner size="large" color="text-[#FF1F6D]" />
          </div>
        ) : !data ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
            <BarChart2 size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-black text-slate-400 uppercase italic">Failed to load analytics</p>
          </div>
        ) : (
          <>
            {/* Reach Summary */}
            <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-3xl p-6 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF1F6D] rounded-full blur-[100px] opacity-10 pointer-events-none" />
              <div className="relative z-10 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Performance Overview</span>
                    <h2 className="text-2xl font-black text-slate-900 italic uppercase mt-1">Creator Reach</h2>
                  </div>
                  <div className="bg-[#FF1F6D]/10 text-[#FF1F6D] px-3 py-1 rounded-full text-[10px] font-black uppercase italic flex items-center gap-1">
                    <TrendingUp size={12} /> Active Growth
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase italic">Followers</span>
                    <p className="text-2xl font-black text-[#FF1F6D] italic mt-0.5">{(data.followers || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase italic">Account Reach</span>
                    <p className="text-2xl font-black text-slate-900 italic mt-0.5">{(data.accountReach || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase italic">Profile Views</span>
                    <p className="text-2xl font-black text-slate-900 italic mt-0.5">{(data.profileViews || 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-500 uppercase italic">Gained this Month</span>
                    <p className="text-2xl font-black text-emerald-600 italic mt-0.5">+{(data.followersGrowth || 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Detailed Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: 'Video Views',      value: data.videoViews,       icon: <Video size={18} />,          color: 'text-amber-500' },
                { label: 'Total Sparks',     value: data.totalSparks,      icon: <Heart size={18} />,          color: 'text-red-500' },
                { label: 'Comments Received', value: data.totalComments,    icon: <MessageSquare size={18} />,  color: 'text-emerald-500' },
                { label: 'Total Shares',     value: data.totalShares,      icon: <Share2 size={18} />,         color: 'text-sky-500' },
                { label: 'Post Saves',       value: data.saves,            icon: <Award size={18} />,          color: 'text-indigo-500' },
                { label: 'Watch Time (Min)', value: data.watchTime,        icon: <Radio size={18} />,          color: 'text-[#FF1F6D]' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card rounded-2xl p-4 shadow-sm"
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[9px] font-black text-slate-400 uppercase italic tracking-widest">{item.label}</span>
                    <div className={`${item.color} p-1.5 rounded-lg bg-slate-50 border border-slate-100`}>
                      {item.icon}
                    </div>
                  </div>
                  <p className="text-2xl font-black text-slate-900 italic mt-1">{(item.value || 0).toLocaleString()}</p>
                </motion.div>
              ))}
            </div>

            {/* Strategy & Tips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card rounded-3xl p-6 shadow-sm space-y-4">
                <h3 className="text-base font-black text-slate-900 italic uppercase flex items-center gap-2">
                  <BookOpen size={18} className="text-[#FF1F6D]" /> Creator Strategy Pointers
                </h3>
                <div className="space-y-3">
                  {[
                    'Leverage the "Boost Post" option to trigger targeted content syndication on high-performing video segments.',
                    'Keep your average video length between 15-30 seconds to optimize the total watch time score in the algorithm.',
                    'Prompt users to comment in the first 5 seconds to maximize immediate sparks index calculations.',
                  ].map((tip, idx) => (
                    <div key={idx} className="flex gap-2 text-xs font-semibold text-slate-600 leading-relaxed">
                      <span className="text-[#FF1F6D] font-black">0{idx + 1}.</span>
                      <p>{tip}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass-card rounded-3xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900 italic uppercase flex items-center gap-2">
                    <Award size={18} className="text-[#FF1F6D]" /> Sparkle Creator Milestone
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 leading-relaxed mt-2">
                    Complete monetization triggers by building high quality content and matching community interaction guidelines.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/verified')}
                  className="w-full mt-4 py-3 bg-gradient-to-r from-[#FF1F6D] to-[#ff6b35] text-white text-[10px] font-black uppercase tracking-widest italic rounded-2xl shadow-lg shadow-[#FF1F6D]/20 flex items-center justify-center gap-1.5 hover:scale-105 active:scale-95 transition-all"
                >
                  Verify Creator Badge <ArrowUpRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
