import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { 
  Eye, Globe, Users, Heart, BarChart3, TrendingUp, 
  Plus, Sparkles, ArrowLeft, Shield, DollarSign, MessageSquare 
} from 'lucide-react';
import Spinner from '../components/ui/Spinner';

export default function ProfessionalDashboard() {
  const navigate = useNavigate();
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

  const [dist, setDist] = useState({
    videos: 0,
    photos: 0,
    stories: 0
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

        const totalPosts = (data.distribution?.video || 0) + (data.distribution?.image || 0) + (data.distribution?.text || 0) || 1;
        setDist({
          videos: Math.round(((data.distribution?.video || 0) / totalPosts) * 100),
          photos: Math.round(((data.distribution?.image || 0) / totalPosts) * 100),
          stories: 0
        });

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
    <div className="flex bg-[#fafafa] min-h-screen">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center lg:ml-72 gap-4">
        <Spinner size="large" color="text-primary" />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">Syncing Insights...</p>
      </div>
    </div>
  );

  return (
    <div className="flex bg-[#fafafa] min-h-screen text-black overflow-x-hidden font-sans pb-20">
      <Navbar />

      <main className="flex-1 lg:ml-72 p-4 md:p-8 relative z-10 max-w-4xl mx-auto w-full pt-16 md:pt-24">
        
        {/* Compact Header */}
        <header className="mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={() => navigate('/dashboard')}
              className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm border border-gray-100 text-gray-400 active:scale-90 transition-all"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-white backdrop-blur-xl shadow-sm">
              <Sparkles size={12} strokeWidth={3} className="text-primary" />
              <span className="text-[8px] font-black text-black uppercase tracking-widest italic">Creator Hub</span>
            </div>
          </div>
          
          <div className="text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tighter uppercase italic leading-none mb-1">
              Professional <span className="text-primary">Dashboard.</span>
            </h1>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">Insights & Growth Analytics</p>
          </div>
        </header>

        <div className="space-y-6 animate-fade-in">
          {/* High Density Stats Grid */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Profile Views', value: stats.profileViews, icon: <Eye size={16} />, growth: stats.followersGrowth },
              { label: 'Reach', value: stats.accountReach, icon: <Globe size={16} />, growth: 8.2 },
              { label: 'Followers', value: stats.followers, icon: <Users size={16} />, growth: null },
              { label: 'Interactions', value: stats.totalSparks + stats.totalComments, icon: <Heart size={16} />, growth: stats.followersGrowth }
            ].map(s => (
              <div key={s.label} className="p-4 bg-white rounded-[24px] border border-gray-100 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest italic">{s.label}</span>
                  <div className="w-7 h-7 rounded-lg bg-primary/5 text-primary flex items-center justify-center">
                    {s.icon}
                  </div>
                </div>
                <div className="text-xl font-black text-gray-900 uppercase italic leading-none mb-1">
                  {s.value > 999 ? `${(s.value / 1000).toFixed(1)}k` : s.value}
                </div>
                {s.growth !== null && (
                   <div className="text-[8px] font-black text-emerald-500 uppercase italic">
                     +{s.growth}% <TrendingUp size={8} className="inline ml-0.5" />
                   </div>
                )}
              </div>
            ))}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Insights Placeholder */}
            <div className="bg-white rounded-[24px] p-5 border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-black uppercase tracking-widest italic flex items-center gap-2">
                  <BarChart3 size={14} className="text-primary" /> Reach Graph
                </h3>
                <span className="text-[8px] font-black text-gray-300 uppercase">Last 30 Days</span>
              </div>
              <div className="h-40 bg-gray-50/50 rounded-2xl flex items-center justify-center border border-dashed border-gray-100">
                <p className="text-[8px] font-black text-gray-300 uppercase tracking-[0.2em] italic">Telemetry Active</p>
              </div>
            </div>

            {/* Distribution */}
            <div className="bg-white rounded-[24px] p-5 border border-gray-100 shadow-sm">
              <h3 className="text-[10px] font-black uppercase tracking-widest italic mb-4 flex items-center gap-2">
                <Shield size={14} className="text-primary" /> Content Logic
              </h3>
              <div className="space-y-4">
                <div className="h-2 bg-gray-50 rounded-full overflow-hidden flex">
                  <div className="bg-primary h-full transition-all duration-1000" style={{ width: `${dist.videos}%` }} />
                  <div className="bg-gray-900 h-full transition-all duration-1000" style={{ width: `${dist.photos}%` }} />
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span className="text-[8px] font-black text-gray-400 uppercase italic">Videos ({dist.videos}%)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-gray-900" />
                    <span className="text-[8px] font-black text-gray-400 uppercase italic">Photos ({dist.photos}%)</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-50 flex justify-between">
                   <div className="text-center">
                     <div className="text-sm font-black text-gray-900 italic leading-none">{stats.totalSparks}</div>
                     <div className="text-[7px] font-black text-gray-400 uppercase tracking-widest mt-1">Sparks</div>
                   </div>
                   <div className="text-center">
                     <div className="text-sm font-black text-gray-900 italic leading-none">{stats.totalComments}</div>
                     <div className="text-[7px] font-black text-gray-400 uppercase tracking-widest mt-1">Comments</div>
                   </div>
                   <div className="text-center">
                     <div className="text-sm font-black text-gray-900 italic leading-none">{stats.totalShares}</div>
                     <div className="text-[7px] font-black text-gray-400 uppercase tracking-widest mt-1">Shares</div>
                   </div>
                </div>
              </div>
            </div>
          </div>

          {/* Monetization - Compact */}
          <section className="bg-gray-900 rounded-[32px] p-6 text-white relative overflow-hidden shadow-xl shadow-gray-200">
             <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 blur-[60px] pointer-events-none" />
             <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-primary">
                   <DollarSign size={16} strokeWidth={3} />
                </div>
                <h3 className="text-[10px] font-black uppercase tracking-widest italic">Capital & Ads</h3>
             </div>
             
             <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 flex justify-between items-center">
                <div>
                   <p className="text-[7px] font-black text-white/40 uppercase tracking-widest mb-1">Available Funds</p>
                   <p className="text-lg font-black italic tracking-tight">₹ 0.00</p>
                </div>
                <button className="h-8 px-4 bg-primary text-white rounded-lg text-[9px] font-black uppercase tracking-widest italic active:scale-90 transition-all shadow-lg shadow-primary/20">
                  + Add
                </button>
             </div>

             <div className="grid grid-cols-2 gap-3">
                <button className="py-2.5 bg-primary text-white rounded-xl text-[9px] font-black uppercase tracking-widest italic shadow-lg shadow-primary/20 active:scale-95 transition-all">Create Ad</button>
                <button className="py-2.5 bg-white/10 text-white rounded-xl text-[9px] font-black uppercase tracking-widest italic hover:bg-white/20 transition-all">Boost Hub</button>
             </div>
          </section>
        </div>
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
      `}</style>
    </div>
  );
}
