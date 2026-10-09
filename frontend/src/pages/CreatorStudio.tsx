import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { motion } from 'framer-motion';
import { ArrowLeft, RefreshCw, Video, Flame, Play, Sparkles, FileText, Image as ImageIcon, Radio } from 'lucide-react';
import Spinner from '../components/ui/Spinner';
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

const MOCK_CONTENT: UploadedContent[] = [
  { id: '1', type: 'Video', title: 'Life at Main Campus - Vibe Check!', reach: 4120, comments: 45, sparks: 380, created_at: '2026-07-05' },
  { id: '2', type: 'Image', title: 'Checkout my new study aesthetic setup.', reach: 2450, comments: 20, sparks: 190, created_at: '2026-07-03' },
  { id: '3', type: 'Text',  title: 'Is it just me or is the new library librarying?', reach: 1890, comments: 85, sparks: 310, created_at: '2026-07-01' },
];

export default function CreatorStudio() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StudioStats | null>(null);
  const [ content,  ] = useState<UploadedContent[]>(MOCK_CONTENT);

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
            <h1 className="text-lg font-black text-slate-900 tracking-tighter italic uppercase leading-none">Creator Studio</h1>
            <p className="text-[8px] font-black text-[#FF1F6D] uppercase tracking-widest italic mt-0.5">Content command center</p>
          </div>
        </div>
        <button onClick={fetchStats} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-600">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <main className="max-w-[1000px] mx-auto p-4 md:p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-40">
            <Spinner size="large" color="text-[#FF1F6D]" />
          </div>
        ) : (
          <>
            {/* Quick Actions Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { title: 'Moment upload', desc: 'Share dynamic short videos.', icon: <Video size={18} />, color: 'from-[#FF1F6D] to-[#ff6b35]', onClick: () => navigate('/moments/create') },
                { title: 'Create Story', desc: 'Post stories on student wall.', icon: <Sparkles size={18} />, color: 'from-violet-500 to-purple-500', onClick: () => navigate('/afterglow/create') },
                { title: 'Go Live Stream', desc: 'Sync live feed feeds.', icon: <Radio size={18} />, color: 'from-amber-500 to-orange-500', onClick: () => navigate('/streams') },
              ].map((act, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -3, scale: 1.02 }}
                  onClick={act.onClick}
                  className="glass-card p-5 rounded-3xl cursor-pointer shadow-sm flex items-start justify-between border-slate-100 hover:border-[#FF1F6D]/20 transition-all bg-white"
                >
                  <div className="space-y-2">
                    <h3 className="text-xs font-black text-slate-800 uppercase italic tracking-wider">{act.title}</h3>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{act.desc}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${act.color} flex items-center justify-center text-white shadow-md`}>
                    {act.icon}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Studio Stats Summary */}
              <div className="glass-card rounded-3xl p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-900 italic uppercase">Dashboard Stats</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Followers Gained', value: stats?.followers || 0, icon: <Flame size={16} className="text-amber-500" /> },
                    { label: 'Sparks Received', value: stats?.totalSparks || 0, icon: <Flame size={16} className="text-[#FF1F6D]" /> },
                    { label: 'Video Performance', value: stats?.videoViews || 0, icon: <Play size={16} className="text-indigo-500" /> },
                  ].map((st, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200/50 rounded-2xl">
                      <div className="flex items-center gap-2">
                        {st.icon}
                        <span className="text-[10px] font-black text-slate-500 uppercase italic">{st.label}</span>
                      </div>
                      <span className="text-sm font-black text-slate-900 italic">{st.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Uploaded Portfolio Content List */}
              <div className="md:col-span-2 glass-card rounded-3xl p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-slate-900 italic uppercase">Recent Publications</h3>
                <div className="space-y-3">
                  {content.map((item) => (
                    <div key={item.id} className="p-4 bg-slate-50 border border-slate-200/50 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                          {item.type === 'Video' ? <Video size={16} className="text-[#FF1F6D]" /> :
                           item.type === 'Image' ? <ImageIcon size={16} className="text-pink-500" /> :
                           <FileText size={16} className="text-purple-500" />}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-slate-800 uppercase italic leading-none">{item.title}</h4>
                          <p className="text-[8px] text-slate-400 font-bold uppercase italic tracking-wider mt-1.5 flex items-center gap-2">
                            <span>{item.type}</span>
                            <span>•</span>
                            <span>{new Date(item.created_at).toLocaleDateString('en-KE', { dateStyle: 'medium' })}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-4 items-center">
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-800 italic">{item.reach.toLocaleString()}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase italic">reach</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-800 italic">{item.sparks.toLocaleString()}</p>
                          <p className="text-[8px] font-black text-slate-400 uppercase italic">sparks</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
