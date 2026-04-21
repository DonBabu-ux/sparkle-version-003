import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

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
          profileViews: data.profileViews,
          followersGrowth: data.followersGrowth,
          accountReach: data.accountReach,
          followers: data.followers,
          totalSparks: data.totalSparks,
          totalComments: data.totalComments,
          totalShares: data.totalShares
        });

        // Distribution from counts
        const totalPosts = (data.distribution.video || 0) + (data.distribution.image || 0) + (data.distribution.text || 0) || 1;
        setDist({
          videos: Math.round(((data.distribution.video || 0) / totalPosts) * 100),
          photos: Math.round(((data.distribution.image || 0) / totalPosts) * 100),
          stories: 0 // Fetching stories might need another count
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

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 p-4 lg:p-8">
      {/* Header aligned exactly with EJS pro-header */}
      <div className="max-w-6xl mx-auto">
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[24px] p-8 md:p-10 text-white shadow-2xl shadow-indigo-200 mb-8">
          <button onClick={() => navigate('/dashboard')} className="absolute top-8 right-8 w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center transition-colors shadow-sm">
            <i className="fas fa-times"></i>
          </button>
          
          <div className="relative z-10">
            <h1 className="text-3xl font-black mb-2 tracking-tight" style={{fontFamily: 'Outfit'}}>Professional Dashboard</h1>
            <p className="text-white/80 font-medium max-w-sm">Insights, Analytics & Monetization for Sparkle Creators</p>
          </div>
          
          <i className="fas fa-chart-line absolute -bottom-10 -right-5 opacity-10" style={{ fontSize: '180px' }}></i>
        </div>

        {loading ? (
           <div className="flex justify-center items-center h-64 text-indigo-500">
             <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
           </div>
        ) : (
          <div className="space-y-8 animate-fade-in">
            {/* Overview Stats */}
            <div>
              <h2 className="text-lg font-black text-slate-800 mb-4">Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                <div className="glass-card bg-white/80 p-6 rounded-[20px]">
                  <div className="flex justify-between items-center text-[11px] font-black tracking-widest text-slate-400 uppercase mb-2">
                    Profile Views <i className="fas fa-eye text-indigo-500 text-sm"></i>
                  </div>
                  <div className="text-3xl font-black text-slate-800">{stats.profileViews.toLocaleString()}</div>
                  <div className="text-xs font-bold text-emerald-500 mt-2"><i className="fas fa-arrow-up"></i> +{stats.followersGrowth}%</div>
                </div>

                <div className="glass-card bg-white/80 p-6 rounded-[20px]">
                  <div className="flex justify-between items-center text-[11px] font-black tracking-widest text-slate-400 uppercase mb-2">
                    Account Reach <i className="fas fa-globe text-rose-500 text-sm"></i>
                  </div>
                  <div className="text-3xl font-black text-slate-800">{stats.accountReach.toLocaleString()}</div>
                  <div className="text-xs font-bold text-emerald-500 mt-2"><i className="fas fa-arrow-up"></i> +8.2%</div>
                </div>

                <div className="glass-card bg-white/80 p-6 rounded-[20px]">
                  <div className="flex justify-between items-center text-[11px] font-black tracking-widest text-slate-400 uppercase mb-2">
                    Followers <i className="fas fa-users text-blue-500 text-sm"></i>
                  </div>
                  <div className="text-3xl font-black text-slate-800">{stats.followers.toLocaleString()}</div>
                  <div className="text-xs font-bold text-slate-400 mt-2"><i className="fas fa-minus"></i> Stable</div>
                </div>

                <div className="glass-card bg-white/80 p-6 rounded-[20px]">
                  <div className="flex justify-between items-center text-[11px] font-black tracking-widest text-slate-400 uppercase mb-2">
                    Interactions <i className="fas fa-heart text-rose-500 text-sm"></i>
                  </div>
                  <div className="text-3xl font-black text-slate-800">{(stats.totalSparks + stats.totalComments).toLocaleString()}</div>
                  <div className="text-xs font-bold text-emerald-500 mt-2"><i className="fas fa-arrow-up"></i> +{stats.followersGrowth}%</div>
                </div>

              </div>
            </div>

            {/* Middle Section (Analytics Graph Placeholder + Ads Removed matching EJS) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="glass-card bg-white/60 p-6 rounded-[20px]">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-black text-slate-800 m-0">Insights Graph</h2>
                  <select className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-black text-slate-600 outline-none">
                    <option>Last 7 Days</option>
                    <option>Last 30 Days</option>
                  </select>
                </div>
                {/* Simulated Graph block */}
                <div className="h-[200px] bg-white rounded-2xl flex flex-col items-center justify-center border border-slate-100 shadow-sm relative overflow-hidden">
                   <div className="absolute inset-0 bg-gradient-to-t from-indigo-50/50 to-transparent"></div>
                   <div className="absolute bottom-0 w-full h-[150px] opacity-20" style={{ background: 'url("data:image/svg+xml,%3Csvg preserveAspectRatio=\'none\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0,100 L0,50 C20,60 40,30 60,70 C80,10 90,80 100,20 L100,100 Z\' fill=\'%236366f1\'/%3E%3C/svg%3E") no-repeat center/100% 100%' }}></div>
                   <span className="text-xs font-bold text-slate-400 relative z-10 bg-white/80 px-3 py-1 rounded-full shadow-sm backdrop-blur-sm">Chart.js implementation ready!</span>
                </div>
              </div>

              <div className="glass-card bg-white/60 p-6 rounded-[20px] flex flex-col justify-between">
                <div>
                  <h2 className="text-lg font-black text-slate-800 m-0 mb-4">Content Analytics</h2>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Content Types Distribution</p>
                  
                  <div className="h-3 bg-slate-100 rounded-full flex overflow-hidden mb-4">
                    <div className="h-full bg-purple-500 transition-all duration-1000" style={{ width: `${dist.videos}%`}}></div>
                    <div className="h-full bg-rose-400 transition-all duration-1000" style={{ width: `${dist.photos}%`}}></div>
                    <div className="h-full bg-blue-400 transition-all duration-1000" style={{ width: `${dist.stories}%`}}></div>
                  </div>
                  
                  <div className="flex gap-4 mb-6">
                    <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-purple-500"></div> Videos ({dist.videos}%)</div>
                    <div className="text-xs font-bold text-slate-500 flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-rose-400"></div> Photos/Posts ({dist.photos}%)</div>
                  </div>
                </div>

                <div className="pt-5 border-t border-slate-200">
                  <h3 className="text-sm font-black text-slate-800 mb-3">Audience Engagement</h3>
                  <div className="flex justify-between">
                    <div>
                      <div className="text-2xl font-black text-slate-800">{stats.totalSparks.toLocaleString()}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Sparks</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black text-slate-800">{stats.totalComments.toLocaleString()}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Comments</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Ad Monetization Block */}
            <div className="relative overflow-hidden glass-card p-6 md:p-8 rounded-[24px] bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-100">
                <i className="fas fa-bullhorn absolute -right-6 -top-6 text-9xl text-rose-500 opacity-5 -rotate-12"></i>
                <h2 className="text-xl font-black text-slate-800 mb-2 relative z-10">Ads & Monetization</h2>
                <p className="text-slate-500 font-medium text-sm max-w-lg mb-6 relative z-10">Reach more students across the Sparkle network. Turn your best performing posts into ads.</p>

                <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 mb-6 flex justify-between items-center border border-white shadow-sm relative z-10 max-w-lg">
                  <div>
                    <div className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1">Available Balance</div>
                    <div className="text-2xl font-black text-emerald-500">₹ 0.00</div>
                  </div>
                  <button className="bg-emerald-500 hover:bg-emerald-600 transition-colors text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-200">
                     + Add Funds
                  </button>
                </div>

                <div className="flex gap-3 relative z-10 max-w-lg">
                   <button className="flex-1 premium-btn shadow-rose-200 text-sm py-3 justify-center bg-gradient-to-r from-rose-500 to-pink-500">Create Ad</button>
                   <button className="flex-1 bg-white text-slate-700 font-bold text-sm py-3 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50 transition-colors" onClick={() => { alert('Select a post to boost from your profile!'); navigate('/profile'); }}>Boost Post</button>
                </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
