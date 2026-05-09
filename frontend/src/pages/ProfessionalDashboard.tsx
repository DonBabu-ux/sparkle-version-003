import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, ChevronRight, Info, TrendingUp,
  DollarSign, Zap, Shield, PieChart, Plus, Settings, 
  Heart, MessageSquare, Share2, HelpCircle
} from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import { useUserStore } from '../store/userStore';

// Simple SVG Line Component for charts
const SparkLine = ({ color, height = 60, points = [] }: { color: string, height?: number, points: number[] }) => {
  if (points.length === 0) return null;
  const max = Math.max(...points) || 1;
  const width = 100;
  const step = width / (points.length - 1);
  const pathData = points.map((p, i) => `${i * step},${height - (p / max) * height}`).join(' L ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
      <path
        d={`M ${pathData}`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export default function ProfessionalDashboard() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    profileViews: 0,
    followersGrowth: 0,
    accountReach: 0,
    followers: 0,
    totalSparks: 0,
    totalComments: 0,
    totalShares: 0
  });

  const [distribution, setDistribution] = useState({
    video: 0,
    image: 0,
    text: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/analytics/creator');
        const data = res.data;
        setStats({
          profileViews: data.profileViews || 0,
          followersGrowth: data.followersGrowth || 0,
          accountReach: data.accountReach || 0,
          followers: data.followers || 0,
          totalSparks: data.totalSparks || 0,
          totalComments: data.totalComments || 0,
          totalShares: data.totalShares || 0
        });
        setDistribution(data.distribution || { video: 0, image: 0, text: 0 });
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
        setLoading(false);
      }
    };
    fetchStats();
    document.title = 'Professional Dashboard | Sparkle';
  }, []);

  if (loading) return (
    <div className="flex bg-[#f8f9fa] min-h-screen items-center justify-center font-sans">
      <Spinner size="large" color="text-slate-400" />
    </div>
  );

  const totalPosts = (distribution.video || 0) + (distribution.image || 0) + (distribution.text || 0) || 1;
  const videoPercent = Math.round(((distribution.video || 0) / totalPosts) * 100);
  const imagePercent = Math.round(((distribution.image || 0) / totalPosts) * 100);

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-black font-sans pb-10">
      {/* Sticky Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1000px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft size={22} className="text-black" strokeWidth={3} />
            </button>
            <h1 className="text-lg font-black text-black tracking-tighter italic uppercase">Pro Hub.</h1>
          </div>
          <div className="flex items-center gap-2">
             <button className="p-2 hover:bg-slate-100 rounded-full transition-colors"><Settings size={20} className="text-black" strokeWidth={2.5} /></button>
             <button className="px-4 py-2 bg-[#FF1F6D] text-white rounded-full text-[10px] font-black uppercase tracking-widest italic shadow-lg shadow-[#FF1F6D]/30 hover:scale-105 active:scale-95 transition-all">Boost Hub</button>
          </div>
        </div>
      </div>

      <main className="max-w-[1000px] mx-auto p-3 md:p-6 space-y-4">
        
        {/* Main Analytics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          {/* Card 1: Page Likes */}
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-lg shadow-slate-200/40 flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Page Likes</h2>
              <ChevronRight size={16} className="text-black" strokeWidth={3} />
            </div>
            
            <div className="mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-black italic tracking-tighter">{stats.followers.toLocaleString()}</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase italic">Total</span>
              </div>
              <div className="text-[10px] font-black text-emerald-600 flex items-center gap-1 mt-0.5 uppercase italic">
                <TrendingUp size={12} strokeWidth={3} /> 0.1% growth
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-black italic">20</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase italic">New</span>
              </div>
              <div className="text-[10px] font-black text-emerald-600 flex items-center gap-1 mt-0.5 uppercase italic">
                <TrendingUp size={12} strokeWidth={3} /> 53.8%
              </div>
            </div>

            <div className="mt-auto">
               <div className="flex justify-end gap-3 mb-2 text-[8px] font-black text-slate-400 uppercase tracking-tighter italic">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-1 bg-[#1d3c6a] rounded-full" /> This week
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-1 bg-slate-200 rounded-full" /> Last week
                  </div>
               </div>
               <div className="h-16 relative">
                  <div className="absolute inset-0 opacity-40">
                    <SparkLine color="#94a3b8" points={[10, 5, 12, 18, 5, 8, 12]} height={60} />
                  </div>
                  <SparkLine color="#1d3c6a" points={[5, 3, 15, 10, 15, 6, 6]} height={60} />
               </div>
            </div>
          </div>

          {/* Card 2: Post Reach */}
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-lg shadow-slate-200/40 flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Post Reach</h2>
              <ChevronRight size={16} className="text-black" strokeWidth={3} />
            </div>

            <div className="mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-black italic tracking-tighter">{stats.accountReach.toLocaleString()}</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase italic">Nodes reached</span>
              </div>
              <div className="text-[10px] font-black text-emerald-600 flex items-center gap-1 mt-0.5 uppercase italic">
                <TrendingUp size={12} strokeWidth={3} /> 59.1%
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-black italic">{stats.accountReach.toLocaleString()}</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase italic">Signal reach</span>
              </div>
              <div className="text-[10px] font-black text-emerald-600 flex items-center gap-1 mt-0.5 uppercase italic">
                <TrendingUp size={12} strokeWidth={3} /> 59.1%
              </div>
            </div>

            <div className="mt-auto">
               <div className="flex justify-end gap-3 mb-2 text-[8px] font-black text-slate-400 uppercase tracking-tighter italic">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-1 bg-[#FF7E33] rounded-full" /> This week
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-1 bg-slate-200 rounded-full" /> Last week
                  </div>
               </div>
               <div className="h-16 relative">
                  <div className="absolute inset-0 opacity-40">
                    <SparkLine color="#94a3b8" points={[8, 12, 10, 10, 4, 3, 12]} height={60} />
                  </div>
                  <SparkLine color="#FF7E33" points={[6, 12, 12, 12, 10, 12, 11]} height={60} />
               </div>
            </div>
          </div>

          {/* Card 3: Engagement */}
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-lg shadow-slate-200/40 flex flex-col">
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Engagement</h2>
              <ChevronRight size={16} className="text-black" strokeWidth={3} />
            </div>

            <div className="mb-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-black italic tracking-tighter">{(stats.totalSparks + stats.totalComments).toLocaleString()}</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase italic">Engaged</span>
              </div>
              <div className="text-[10px] font-black text-emerald-600 flex items-center gap-1 mt-0.5 uppercase italic">
                <TrendingUp size={12} strokeWidth={3} /> 15.3%
              </div>
            </div>

            <div className="space-y-4">
               {[
                 { label: 'Sparks', value: stats.totalSparks, color: '#FF1F6D', points: [10, 12, 20, 18, 22, 18, 15] },
                 { label: 'Comments', value: stats.totalComments, color: '#FF7EB3', points: [5, 8, 15, 8, 12, 8, 8] },
                 { label: 'Shares', value: stats.totalShares, color: '#7048E8', points: [8, 12, 10, 14, 12, 14, 11] }
               ].map((item, i) => (
                 <div key={i} className="flex items-center group">
                    <div className="w-16">
                      <p className="text-sm font-black text-black italic leading-none">{item.value}</p>
                      <p className="text-[8px] text-black font-black uppercase italic mt-1 tracking-widest">{item.label}</p>
                    </div>
                    <div className="flex-1 h-6 relative">
                       <SparkLine color={item.color} points={item.points} height={40} />
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>

        {/* Functional Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Monetization Card */}
          <div className="bg-[#000000] text-white p-5 rounded-xl shadow-xl shadow-slate-300/30 relative overflow-hidden group">
            <div className="flex justify-between items-start mb-5">
               <div>
                 <h3 className="text-lg font-black italic uppercase tracking-tight leading-none">Monetization Hub</h3>
                 <p className="text-[8px] text-slate-500 font-black italic uppercase mt-1 tracking-widest">Creator Node Capital</p>
               </div>
               <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center text-[#FF1F6D] border border-white/10">
                 <DollarSign size={18} strokeWidth={3} />
               </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-4">
               <p className="text-[8px] text-slate-500 font-black mb-1 uppercase tracking-widest italic">Available Node Balance</p>
               <div className="flex justify-between items-end">
                 <span className="text-3xl font-black italic tracking-tighter text-white">₹ 0.00</span>
                 <button onClick={() => alert('Add funds logic triggered')} className="px-4 py-1.5 bg-[#FF1F6D] text-white rounded-lg text-[9px] font-black uppercase tracking-widest italic hover:scale-105 active:scale-95 transition-all shadow-lg shadow-[#FF1F6D]/30">
                    Add Funds
                 </button>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
               <button className="py-2.5 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest italic hover:bg-white/10 transition-all">Ad Manager</button>
               <button className="py-2.5 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest italic hover:bg-white/10 transition-all">Withdraw</button>
            </div>
          </div>

          {/* Content Engine */}
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col justify-between">
            <div className="flex justify-between items-center mb-5">
               <div>
                 <h3 className="text-lg font-black text-black italic uppercase tracking-tight leading-none">Content Engine</h3>
                 <p className="text-[8px] text-slate-500 font-black italic uppercase mt-1 tracking-widest">Node Distribution Logic</p>
               </div>
               <div className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center text-black border border-slate-100">
                 <PieChart size={18} strokeWidth={2.5} />
               </div>
            </div>

            <div className="flex items-center gap-6">
               <div className="relative w-20 h-20 shrink-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                     <circle cx="50" cy="50" r="40" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                     <circle 
                       cx="50" cy="50" r="40" fill="transparent" stroke="#FF1F6D" strokeWidth="12" 
                       strokeDasharray={`${videoPercent * 2.51} 251`} 
                       strokeLinecap="round"
                     />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-black italic text-black">{videoPercent}%</div>
               </div>
               <div className="flex-1 space-y-4">
                  <div className="space-y-1">
                     <div className="flex justify-between items-center text-[9px]">
                        <span className="font-black text-slate-800 uppercase italic">Videos</span>
                        <span className="font-black text-black italic text-xs">{videoPercent}%</span>
                     </div>
                     <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#FF1F6D]" style={{ width: `${videoPercent}%` }} />
                     </div>
                  </div>
                  <div className="space-y-1">
                     <div className="flex justify-between items-center text-[9px]">
                        <span className="font-black text-slate-800 uppercase italic">Photos</span>
                        <span className="font-black text-black italic text-xs">{imagePercent}%</span>
                     </div>
                     <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-black" style={{ width: `${imagePercent}%` }} />
                     </div>
                  </div>
               </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center">
               <div className="flex items-center gap-2">
                  <Zap size={14} className="text-emerald-500" fill="currentColor" />
                  <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest italic">Node: <span className="text-emerald-600">Optimal</span></span>
               </div>
               <button className="text-[9px] font-black text-[#FF1F6D] uppercase tracking-widest italic hover:underline">All Nodes</button>
            </div>
          </div>
        </div>

        {/* Signal Breakdown & Pulse */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xl shadow-slate-200/40">
            <h2 className="text-base font-black text-black italic uppercase tracking-tight mb-5">Signal Breakdown</h2>
            <div className="space-y-1">
              {[
                { label: 'Viral Sparks', value: stats.totalSparks, icon: <Heart size={16} />, color: 'text-[#FF1F6D]', bg: 'bg-pink-50' },
                { label: 'Node Comments', value: stats.totalComments, icon: <MessageSquare size={16} />, color: 'text-black', bg: 'bg-slate-50' },
                { label: 'Signal Shares', value: stats.totalShares, icon: <Share2 size={16} />, color: 'text-black', bg: 'bg-slate-50' }
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 px-3 -mx-3 rounded-xl transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${item.bg} ${item.color} flex items-center justify-center border border-slate-100`}>
                      {item.icon}
                    </div>
                    <span className="text-xs font-black text-slate-800 uppercase italic tracking-wide">{item.label}</span>
                  </div>
                  <span className="text-lg font-black text-black italic">{item.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-xl shadow-slate-200/40 flex flex-col">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-base font-black text-black italic uppercase tracking-tight">Real-time Pulse</h2>
              <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-full border border-emerald-100">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black text-emerald-600 italic uppercase">Live</span>
              </div>
            </div>
            <div className="space-y-4 flex-1">
              {[
                { user: 'don.babu', action: 'Ignited a spark', time: 'Just now' },
                { user: 'sparkle_king', action: 'Left a signal', time: '2m ago' },
                { user: 'design_ninja', action: 'Linked to you', time: '5m ago' }
              ].map((act, i) => (
                <div key={i} className="flex items-center justify-between group py-1 cursor-pointer hover:bg-slate-50 px-3 -mx-3 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                       <div className="w-full h-full bg-gradient-to-tr from-[#FF1F6D]/20 to-indigo-500/20" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-black italic leading-none mb-1 uppercase">
                        <span className="text-[#FF1F6D]">@{act.user}</span> {act.action}
                      </p>
                      <p className="text-[8px] text-slate-500 font-black italic uppercase tracking-widest">{act.time}</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-slate-200 group-hover:text-[#FF1F6D] transition-colors" strokeWidth={3} />
                </div>
              ))}
            </div>
            <button className="mt-6 w-full py-3.5 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest italic hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-black/20">
              Open Full Pulse
            </button>
          </div>
        </div>

        {/* Footer Utilities */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
           {[
             { label: 'Pro Support', icon: <MessageSquare size={16} />, color: 'text-indigo-600' },
             { label: 'Security Nodes', icon: <Shield size={16} />, color: 'text-emerald-600' },
             { label: 'Creator Manual', icon: <HelpCircle size={16} />, color: 'text-amber-600' },
             { label: 'Account Logic', icon: <Settings size={16} />, color: 'text-black' }
           ].map((item, i) => (
             <button key={i} className="bg-white p-4 rounded-xl border border-slate-100 flex flex-col items-center gap-2 hover:shadow-lg transition-all active:scale-95 group shadow-sm shadow-slate-200/40">
                <div className={`w-9 h-9 rounded-xl bg-slate-50 ${item.color} flex items-center justify-center border border-slate-100`}>
                  {item.icon}
                </div>
                <span className="text-[9px] font-black text-black italic uppercase tracking-widest">{item.label}</span>
             </button>
           ))}
        </div>

      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .font-sans { font-family: 'Inter', -apple-system, sans-serif; }
      `}</style>
    </div>
  );
}
