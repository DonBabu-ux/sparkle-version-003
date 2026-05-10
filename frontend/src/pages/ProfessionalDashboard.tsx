import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, ChevronRight, Info, TrendingUp, BadgeCheck,
  DollarSign, Zap, Shield, PieChart, Plus, Settings, 
  Heart, MessageSquare, Share2, HelpCircle, X,
  Calendar, BarChart2, MousePointer2
} from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import { useUserStore } from '../store/userStore';

// --- Interactive SVG Chart Component ---
const InteractiveChart = ({ 
  data, 
  color, 
  height = 120, 
  showDots = true,
  interactive = false,
  onHover 
}: { 
  data: number[], 
  color: string, 
  height?: number, 
  showDots?: boolean,
  interactive?: boolean,
  onHover?: (index: number | null) => void 
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const points = useMemo(() => {
    if (!data.length) return [];
    const max = Math.max(...data, 10);
    const width = 300;
    const step = width / (data.length - 1);
    return data.map((val, i) => ({
      x: i * step,
      y: height - (val / max) * height,
      val
    }));
  }, [data, height]);

  if (!points.length) return null;

  const pathData = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const areaData = `${pathData} L ${points[points.length - 1].x},${height} L 0,${height} Z`;

  return (
    <div className="relative w-full h-full group" onMouseLeave={() => { setHoverIndex(null); onHover?.(null); }}>
      <svg viewBox={`0 0 300 ${height}`} className="w-full h-full overflow-visible preserve-3d">
        {/* Area Gradient */}
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        
        <motion.path
          initial={{ d: `M 0,${height} L ${points.map(p => `0,${height}`).join(' ')}` }}
          animate={{ d: areaData }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          fill={`url(#grad-${color})`}
        />

        <motion.path
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: "easeInOut" }}
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {showDots && points.map((p, i) => (
          <motion.circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoverIndex === i ? 5 : 3}
            fill={hoverIndex === i ? color : "white"}
            stroke={color}
            strokeWidth="2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.1 }}
            onMouseEnter={() => { setHoverIndex(i); onHover?.(i); }}
            className="cursor-pointer transition-all"
          />
        ))}

        {/* Vertical Scan Line */}
        {interactive && hoverIndex !== null && (
          <line 
            x1={points[hoverIndex].x} y1="0" x2={points[hoverIndex].x} y2={height} 
            stroke={color} strokeWidth="1" strokeDasharray="4 2" opacity="0.5" 
          />
        )}
      </svg>
    </div>
  );
};

export default function ProfessionalDashboard() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [activeDetail, setActiveDetail] = useState<string | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [timeRange, setTimeRange] = useState('7D');
  const [showSubscription, setShowSubscription] = useState(false);

  const [stats, setStats] = useState({
    profileViews: 0,
    followersGrowth: 0,
    accountReach: 0,
    followers: 0,
    totalSparks: 0,
    totalComments: 0,
    totalShares: 0
  });

  const [series, setSeries] = useState({
    sparks: [0, 0, 0, 0, 0, 0, 0],
    follows: [0, 0, 0, 0, 0, 0, 0],
    comments: [0, 0, 0, 0, 0, 0, 0],
    engagement: [0, 0, 0, 0, 0, 0, 0]
  });

  const [distribution, setDistribution] = useState({
    video: 0,
    image: 0,
    text: 0
  });

  // Real historical data from API
  const historicalData: Record<string, number[]> = {
    'Page Likes': series.follows,
    'Post Reach': series.sparks.map(s => s * 4), // Reach calculated from real sparks
    'Engagement': series.engagement
  };

  const [pulseData, setPulseData] = useState<any[]>([]);
  const [loadingPulse, setLoadingPulse] = useState(true);

  const [isBoosted, setIsBoosted] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/analytics/creator');
        const data = res.data;
        setStats({
          profileViews: data.profileViews || 0,
          followersGrowth: 0,
          accountReach: data.accountReach || 0,
          followers: data.followers || 0,
          totalSparks: data.totalSparks || 0,
          totalComments: data.totalComments || 0,
          totalShares: data.totalShares || 0
        });
        if (data.series) {
          setSeries(data.series);
        }
        setIsBoosted(data.isBoosted || false);
        setDistribution(data.distribution || { video: 0, image: 0, text: 0 });
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch analytics:', err);
        setLoading(false);
      }
    };

    const fetchPulse = async () => {
      try {
        const res = await api.get('/notifications');
        // Filter out John Doe / Mock sounding data
        const realNotifs = res.data.filter((n: any) => 
          !n.message.toLowerCase().includes('john doe') && 
          !n.actor?.name?.toLowerCase().includes('john doe')
        );
        setPulseData(realNotifs.slice(0, 4));
        setLoadingPulse(false);
      } catch (err) {
        console.error('Failed to fetch pulse:', err);
        setLoadingPulse(false);
      }
    };

    fetchStats();
    fetchPulse();
    document.title = 'Professional Dashboard | Sparkle';
  }, []);

  if (loading) return (
    <div className="flex bg-[#F0F2F5] min-h-screen items-center justify-center font-sans">
      <Spinner size="large" color="text-slate-400" />
    </div>
  );

  const totalPosts = (distribution.video || 0) + (distribution.image || 0) + (distribution.text || 0) || 1;
  const videoPercent = Math.round(((distribution.video || 0) / totalPosts) * 100);
  const imagePercent = Math.round(((distribution.image || 0) / totalPosts) * 100);

  const getDetailColor = (title: string) => {
    if (title === 'Page Likes') return '#1d3c6a';
    if (title === 'Post Reach') return '#FF7E33';
    return '#FF1F6D';
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-black font-sans pb-10 overflow-x-hidden">
      {/* Sticky Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1000px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft size={22} className="text-black" strokeWidth={3} />
            </button>
            <div className="flex flex-col">
              <h1 className="text-lg font-black text-black tracking-tighter italic uppercase leading-tight">Pro Hub.</h1>
              {isBoosted && (
                <span className="text-[7px] font-black bg-[#FF1F6D] text-white px-1.5 py-0.5 rounded-full uppercase italic tracking-widest w-fit animate-pulse">10% Boost Active</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
             <button onClick={() => navigate('/settings')} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><Settings size={20} className="text-black" strokeWidth={2.5} /></button>
             <button 
               onClick={() => setShowSubscription(true)}
               className="px-4 py-2 bg-[#FF1F6D] text-white rounded-full text-[10px] font-black uppercase tracking-widest italic shadow-lg shadow-[#FF1F6D]/30 hover:scale-105 active:scale-95 transition-all"
             >
               Boost Hub
             </button>
          </div>
        </div>
      </div>

      <main className="max-w-[1000px] mx-auto p-3 md:p-6 space-y-4">
        
        {/* Main Analytics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          
          {[
            { title: 'Page Likes', value: stats.followers, subValue: '20 New', growth: '+0.1%', color: '#1d3c6a', points: series.follows },
            { title: 'Post Reach', value: stats.accountReach, subValue: stats.accountReach, growth: '+59.1%', color: '#FF7E33', points: series.sparks },
            { title: 'Engagement', value: stats.totalSparks + stats.totalComments, subValue: stats.totalSparks, growth: '+15.3%', color: '#FF1F6D', points: series.engagement }
          ].map((card, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -4 }}
              onClick={() => setActiveDetail(card.title)}
              className="bg-white p-4 rounded-xl border border-slate-100 shadow-lg shadow-slate-200/40 flex flex-col cursor-pointer transition-all active:scale-[0.98]"
            >
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">{card.title}</h2>
                <div className="w-6 h-6 rounded-full bg-slate-50 flex items-center justify-center">
                   <ChevronRight size={14} className="text-black" strokeWidth={3} />
                </div>
              </div>
              
              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-black italic tracking-tighter">{card.value.toLocaleString()}</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase italic">Total</span>
                </div>
                <div className="text-[10px] font-black text-emerald-600 flex items-center gap-1 mt-0.5 uppercase italic">
                  <TrendingUp size={12} strokeWidth={3} /> {card.growth} growth
                </div>
              </div>

              <div className="h-16 relative mt-auto pt-4">
                 <InteractiveChart color={card.color} data={card.points} height={60} showDots={false} />
              </div>
              <p className="text-[9px] font-black text-slate-400 uppercase italic mt-2 text-right">View Details</p>
            </motion.div>
          ))}
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
                 <span className="text-3xl font-black italic tracking-tighter text-white">KES 0.00</span>
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
                { label: 'Viral Sparks', value: stats.totalSparks, icon: <Heart size={16} />, color: 'text-black', bg: 'bg-pink-50' },
                { label: 'Node Comments', value: stats.totalComments, icon: <MessageSquare size={16} />, color: 'text-black', bg: 'bg-slate-50' },
                { label: 'Signal Shares', value: stats.totalShares, icon: <Share2 size={16} />, color: 'text-black', bg: 'bg-slate-50' }
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 px-3 -mx-3 rounded-xl transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl ${item.bg} ${item.color} flex items-center justify-center border border-slate-100`}>
                      <span className={item.label === 'Viral Sparks' ? 'text-[#FF1F6D]' : 'text-black'}>{item.icon}</span>
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
              {loadingPulse ? (
                <div className="flex items-center justify-center h-full">
                  <Spinner size="small" color="text-[#FF1F6D]" />
                </div>
              ) : pulseData.length > 0 ? (
                pulseData.map((notif, i) => (
                  <div key={i} className="flex items-center justify-between group py-1 cursor-pointer hover:bg-slate-50 px-3 -mx-3 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden">
                        {notif.actor?.profile_image ? (
                          <img src={notif.actor.profile_image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-tr from-[#FF1F6D]/20 to-indigo-500/20" />
                        )}
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-slate-800 italic leading-tight mb-1 uppercase max-w-[200px] truncate">
                          {notif.message}
                        </p>
                        <p className="text-[8px] text-slate-500 font-black italic uppercase tracking-widest">{formatTime(notif.created_at)}</p>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-slate-200 group-hover:text-[#FF1F6D] transition-colors" strokeWidth={3} />
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <p className="text-[10px] font-black text-slate-400 uppercase italic">No pulse signals detected yet.</p>
                </div>
              )}
            </div>
            <button className="mt-6 w-full py-3.5 bg-black text-white rounded-xl text-[10px] font-black uppercase tracking-widest italic hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-black/20">
              Open Full Pulse
            </button>
          </div>
        </div>

        {/* Footer Utilities */}
         <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: 'Pro Support', icon: <MessageSquare size={14} />, color: 'text-indigo-600', onClick: () => navigate('/support') },
              { label: 'Security Nodes', icon: <Shield size={14} />, color: 'text-emerald-600', onClick: () => navigate('/settings') },
              { label: 'Creator Manual', icon: <HelpCircle size={14} />, color: 'text-amber-600', onClick: () => navigate('/help') },
              { label: 'Verify Node', icon: <BadgeCheck size={14} />, color: 'text-[#FF1F6D]', onClick: () => navigate('/verified') }
            ].map((item, i) => (
              <button 
                key={i} 
                onClick={item.onClick}
                className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col items-center gap-1.5 hover:shadow-md transition-all active:scale-95 group shadow-sm shadow-slate-200/40"
              >
                 <div className={`w-8 h-8 rounded-lg bg-slate-50 ${item.color} flex items-center justify-center border border-slate-100`}>
                   {item.icon}
                 </div>
                 <span className="text-[8px] font-black text-black italic uppercase tracking-widest text-center leading-none">{item.label}</span>
              </button>
            ))}
         </div>

      </main>

      {/* --- Detailed Analytics Overlay --- */}
      <AnimatePresence>
        {activeDetail && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
          >
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white w-full max-w-[600px] rounded-t-[32px] md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest italic">Signal Detail</h3>
                  <h2 className="text-2xl font-black text-black italic tracking-tighter uppercase">{activeDetail}</h2>
                </div>
                <button 
                  onClick={() => setActiveDetail(null)}
                  className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-slate-50 transition-colors"
                >
                  <X size={20} className="text-black" strokeWidth={3} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-8 overflow-y-auto">
                
                {/* Stats Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase italic mb-1">Current Period</p>
                    <p className="text-3xl font-black text-black italic leading-none">
                      {historicalData[activeDetail][historicalData[activeDetail].length - 1].toLocaleString()}
                    </p>
                    <p className="text-[10px] font-black text-emerald-600 mt-2 uppercase italic">+12.4% vs last period</p>
                  </div>
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-100 shadow-sm">
                    <p className="text-[9px] font-black text-slate-400 uppercase italic mb-1">Peak Value</p>
                    <p className="text-3xl font-black text-black italic leading-none">
                      {Math.max(...historicalData[activeDetail]).toLocaleString()}
                    </p>
                    <p className="text-[10px] font-black text-slate-500 mt-2 uppercase italic tracking-tighter">All time high reached</p>
                  </div>
                </div>

                {/* Interactive Large Chart */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                       {['24H', '7D', '30D', 'ALL'].map((r) => (
                         <button 
                           key={r}
                           onClick={() => setTimeRange(r)}
                           className={`px-3 py-1 rounded-full text-[9px] font-black uppercase italic transition-all ${timeRange === r ? 'bg-black text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}
                         >
                           {r}
                         </button>
                       ))}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase italic">
                       <MousePointer2 size={12} strokeWidth={3} className="text-primary animate-bounce" /> 
                       Hover to scan
                    </div>
                  </div>

                  <div className="bg-white border-2 border-slate-50 rounded-2xl p-4 h-[200px] shadow-inner relative overflow-hidden">
                     <InteractiveChart 
                       data={historicalData[activeDetail]} 
                       color={getDetailColor(activeDetail)} 
                       height={160} 
                       interactive={true}
                       onHover={setSelectedPoint}
                     />
                     
                     {/* Dynamic Tooltip Overlay */}
                     <AnimatePresence>
                       {selectedPoint !== null && (
                         <motion.div 
                           initial={{ opacity: 0, scale: 0.8 }}
                           animate={{ opacity: 1, scale: 1 }}
                           exit={{ opacity: 0, scale: 0.8 }}
                           className="absolute top-4 right-4 bg-black text-white px-4 py-2 rounded-xl shadow-xl border border-white/10 flex flex-col items-end pointer-events-none"
                         >
                           <p className="text-[9px] font-black text-slate-400 uppercase italic">Value at Point</p>
                           <p className="text-lg font-black italic">{historicalData[activeDetail][selectedPoint].toLocaleString()}</p>
                           <p className="text-[8px] font-black text-[#FF1F6D] uppercase italic">Node Sequence: {selectedPoint + 1}</p>
                         </motion.div>
                       )}
                     </AnimatePresence>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="space-y-3 pt-4 border-t border-slate-100">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase italic tracking-widest">Recommended Actions</h4>
                   <div className="grid grid-cols-1 gap-2">
                      <button 
                        onClick={() => {
                          setActiveDetail(null);
                          setShowSubscription(true);
                        }}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-[#FF1F6D]/5 hover:border-[#FF1F6D]/20 border border-transparent transition-all group active:scale-95"
                      >
                         <div className="flex items-center gap-3">
                            <Zap size={18} className="text-amber-500 group-hover:text-[#FF1F6D]" fill="currentColor" />
                            <span className="text-[11px] font-black text-black uppercase italic">Boost this Signal</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black text-[#FF1F6D] uppercase italic opacity-0 group-hover:opacity-100 transition-opacity">Ignite Hub</span>
                            <ChevronRight size={14} className="text-slate-300 group-hover:text-black transition-colors" strokeWidth={3} />
                         </div>
                      </button>
                      
                      <button 
                        onClick={() => {
                          const dummyData = `Metric,Value\n${activeDetail},${historicalData[activeDetail].join(',')}`;
                          const blob = new Blob([dummyData], { type: 'text/csv' });
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.setAttribute('hidden', '');
                          a.setAttribute('href', url);
                          a.setAttribute('download', `sparkle_analytics_${activeDetail.toLowerCase().replace(' ', '_')}.csv`);
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                        }}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-black/5 hover:border-black/10 border border-transparent transition-all group active:scale-95"
                      >
                         <div className="flex items-center gap-3">
                            <Share2 size={18} className="text-indigo-500 group-hover:text-black" />
                            <span className="text-[11px] font-black text-black uppercase italic">Export Analytics Node</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <span className="text-[8px] font-black text-slate-400 uppercase italic opacity-0 group-hover:opacity-100 transition-opacity">CSV Output</span>
                            <ChevronRight size={14} className="text-slate-300 group-hover:text-black transition-colors" strokeWidth={3} />
                         </div>
                      </button>
                   </div>
                </div>
              </div>
              
              {/* Modal Footer */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-center">
                 <p className="text-[9px] font-black uppercase italic tracking-[0.2em]">Sparkle Advanced Analytics v2.0</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Signal Boost Subscription Overlay --- */}
      <AnimatePresence>
        {showSubscription && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-6 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-[800px] rounded-[40px] shadow-2xl overflow-hidden flex flex-col md:flex-row relative"
            >
               <button 
                 onClick={() => setShowSubscription(false)}
                 className="absolute top-6 right-6 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors z-10"
               >
                 <X size={20} className="text-black" strokeWidth={3} />
               </button>

               {/* Left Side: Visual/Branding */}
               <div className="md:w-[35%] bg-black p-8 flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute inset-0 opacity-20 pointer-events-none">
                     <div className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-[#FF1F6D] rounded-full blur-[80px]" />
                     <div className="absolute bottom-[-50px] left-[-50px] w-40 h-40 bg-indigo-500 rounded-full blur-[80px]" />
                  </div>
                  
                  <div className="relative z-10">
                     <h2 className="text-3xl font-black text-white italic leading-none uppercase tracking-tighter mb-2">Power Up.</h2>
                     <p className="text-[10px] font-black text-[#FF1F6D] uppercase tracking-widest italic mb-6">Subscription Tier Logic</p>
                     <p className="text-xs text-slate-400 font-medium leading-relaxed">
                        Ignite your content with advanced node distribution and viral sequence optimization.
                     </p>
                  </div>

                  <div className="relative z-10 bg-white/5 border border-white/10 p-4 rounded-2xl">
                     <div className="flex items-center gap-3 mb-2">
                        <Zap size={16} className="text-amber-400" fill="currentColor" />
                        <span className="text-[10px] font-black text-white uppercase italic">Instant Activation</span>
                     </div>
                     <p className="text-[9px] text-slate-400 font-bold uppercase italic">Global Node Sync Enabled</p>
                  </div>
               </div>

               {/* Right Side: Plans */}
               <div className="flex-1 p-8 md:p-10 space-y-8">
                  <div>
                    <h3 className="text-2xl font-black text-black italic tracking-tighter uppercase mb-2">Select Your Boost Tier</h3>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Weekly & Monthly Distribution Plans</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     {[
                       { name: 'Nano', price: 'KES 99', color: 'bg-slate-50', text: 'text-black', btn: 'bg-black text-white', perks: ['2x Reach', 'Basic Pulse'] },
                       { name: 'Viral', price: 'KES 499', color: 'bg-[#FF1F6D]', text: 'text-white', btn: 'bg-white text-[#FF1F6D]', perks: ['10x Reach', 'Pro Analytics', 'Signal Priority'], popular: true },
                       { name: 'Matrix', price: 'KES 999', color: 'bg-[#0A0A0A]', text: 'text-white', btn: 'bg-[#FF1F6D] text-white', perks: ['Unlimited Reach', 'Global Node Sync', '24/7 Creator Support'], border: 'border border-white/20 shadow-[0_0_20px_rgba(255,31,109,0.15)]' }
                     ].map((plan, i) => (
                       <div key={i} className={`${plan.color} ${plan.text} ${plan.border || 'border border-transparent'} p-5 rounded-3xl flex flex-col relative group hover:scale-[1.03] transition-all shadow-xl`}>
                          {plan.popular && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-[#FF1F6D] px-3 py-1 rounded-full text-[8px] font-black uppercase italic shadow-md border border-[#FF1F6D]/20">Most Popular</div>
                          )}
                          <h4 className="text-xs font-black uppercase italic tracking-widest mb-1">{plan.name} Boost</h4>
                          <div className="flex items-baseline gap-1 mb-6">
                            <span className="text-2xl font-black italic">{plan.price}</span>
                            <span className="text-[8px] font-bold uppercase opacity-60">/ Week</span>
                          </div>
                          
                          <div className="flex-1 space-y-3 mb-6">
                             {plan.perks.map((p, j) => (
                               <div key={j} className="flex items-center gap-2">
                                  <div className={`w-1 h-1 rounded-full ${plan.text === 'text-white' ? 'bg-white' : 'bg-black'}`} />
                                  <span className="text-[9px] font-bold uppercase italic tracking-tighter">{p}</span>
                               </div>
                             ))}
                          </div>

                          <button className={`w-full py-3 rounded-xl ${plan.btn} text-[9px] font-black uppercase tracking-widest italic shadow-lg active:scale-95 transition-all`}>
                             Pay Now
                          </button>
                       </div>
                     ))}
                  </div>

                  <div className="text-center pt-4 border-t border-slate-100">
                     <p className="text-[9px] font-black text-slate-400 uppercase italic">Secure Transaction via Sparkle Node Gateway (KES Enabled)</p>
                  </div>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .font-sans { font-family: 'Inter', -apple-system, sans-serif; }
        .preserve-3d { transform-style: preserve-3d; }
      `}</style>
    </div>
  );
}
