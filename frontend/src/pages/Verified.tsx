import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, BadgeCheck, ShieldCheck, Star, FileText, Upload, Send, 
  CheckCircle2, ChevronDown, Lock, TrendingUp, Users, Zap, Shield, Target
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { useUserStore } from '../store/userStore';
import { getAvatarUrl } from '../utils/imageUtils';
import Spinner from '../components/ui/Spinner';
import api from '../api/api';

export default function Verified() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [stats, setStats] = useState({ followers: 0, engagement: 0, trustLevel: 1 });
  const [formData, setFormData] = useState({
    category: '',
    documentType: '',
    description: ''
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/analytics/creator');
        const data = res.data;
        const engScore = Math.min(Math.round(((data.totalSparks + data.totalComments) / (data.followers || 1)) * 100), 100);
        
        setStats({
          followers: data.followers || 0,
          engagement: engScore,
          trustLevel: data.reputation?.trustLevel || 1
        });
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch criteria stats:', err);
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const isEligible = stats.followers >= 1000 && stats.engagement >= 70 && stats.trustLevel >= 3;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setTimeout(() => {
      setSubmitLoading(false);
      setStep(3);
    }, 2000);
  };

  if (loading) return (
    <div className="min-h-screen bg-white dark:bg-[#101217] flex items-center justify-center">
      <Spinner size="large" color="text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-[#101217] text-black dark:text-white font-sans pb-20 lg:pb-0 overflow-x-hidden pt-12 md:pt-20 relative transition-colors duration-300">
      <Navbar />

      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[300px] md:w-[700px] h-[300px] md:h-[700px] bg-red-200/20 rounded-full blur-[80px] md:blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[250px] md:w-[500px] h-[250px] md:h-[500px] bg-pink-200/20 rounded-full blur-[60px] md:blur-[120px] pointer-events-none z-0" />

      <div className="max-w-2xl mx-auto pt-10 md:pt-16 px-4 md:px-6 relative z-10 pb-20">
        {/* Header */}
        <header className="flex items-center gap-5 md:gap-8 mb-10 md:mb-12 animate-fade-in">
          <button 
            onClick={() => navigate(-1)} 
            className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white dark:bg-[#101217]/50 backdrop-blur-3xl flex items-center justify-center text-black dark:text-white shadow-lg border border-white dark:border-white/10 hover:scale-105 active:scale-95 transition-all"
          >
            <ArrowLeft size={22} md:size={26} strokeWidth={3} />
          </button>
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-black dark:text-white tracking-tight italic leading-none uppercase">Trust Node</h1>
            <p className="text-sm md:text-base font-medium text-black/40 dark:text-white/40 mt-2 italic uppercase tracking-widest">Identity & Reputation Evolution</p>
          </div>
        </header>

        <main className="animate-fade-in">
          {step === 1 && (
            <div className="space-y-6">
              {/* Profile Trust Card */}
              <div className="bg-white/70 dark:bg-[#121212]/80 backdrop-blur-3xl rounded-[40px] shadow-2xl shadow-black/5 border border-white/60 dark:border-white/5 p-8 md:p-10 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5">
                   <Shield size={120} strokeWidth={1} />
                </div>

                <div className="relative w-28 h-28 md:w-32 md:h-32 mx-auto mb-6">
                  <img 
                    src={getAvatarUrl(user?.avatar_url, user?.username)} 
                    alt="" 
                    className="w-full h-full rounded-full object-cover border-4 border-white dark:border-black shadow-2xl"
                  />
                  <div className="absolute -bottom-1 -right-1 bg-white dark:bg-[#101217] rounded-full p-1.5 shadow-lg">
                    {stats.trustLevel >= 3 ? (
                      <BadgeCheck size={32} fill="#ff1f6d" color="white" strokeWidth={1} />
                    ) : (
                      <ShieldCheck size={32} className="text-slate-400" strokeWidth={2.5} />
                    )}
                  </div>
                </div>

                <h3 className="text-2xl font-black text-black dark:text-white tracking-tight italic mb-2 uppercase">Level {stats.trustLevel}: {['', 'Recognized', 'Trusted', 'Established', 'Confirmed', 'Verified'][stats.trustLevel]}</h3>
                <div className="flex justify-center gap-1 mb-8">
                   {[1,2,3,4,5].map(lvl => (
                     <div key={lvl} className={`h-1.5 w-8 rounded-full transition-all ${lvl <= stats.trustLevel ? 'bg-[#FF1F6D] shadow-[0_0_10px_rgba(255,31,109,0.5)]' : 'bg-slate-200 dark:bg-white/10'}`} />
                   ))}
                </div>

                {!isEligible ? (
                  <div className="space-y-6 text-left">
                     <div className="p-6 bg-black/5 dark:bg-white/5 rounded-[32px] border border-black/5 dark:border-white/5">
                        <div className="flex justify-between items-center mb-4">
                           <div className="flex items-center gap-2">
                              <Users size={16} className="text-black" />
                              <span className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">Global Followers</span>
                           </div>
                           <span className="text-xs font-black italic">{stats.followers}/1,000</span>
                        </div>
                        <div className="h-2.5 bg-white/50 rounded-full overflow-hidden p-0.5 border border-white">
                           <div className="h-full bg-black rounded-full transition-all duration-1000" style={{ width: `${Math.min((stats.followers / 1000) * 100, 100)}%` }} />
                        </div>
                     </div>

                     <div className="p-6 bg-[#FF1F6D]/5 rounded-[32px] border border-[#FF1F6D]/10">
                        <div className="flex justify-between items-center mb-4">
                           <div className="flex items-center gap-2">
                              <Zap size={16} className="text-[#FF1F6D]" />
                              <span className="text-[10px] font-black uppercase italic tracking-widest text-[#FF1F6D]">Engagement Node</span>
                           </div>
                           <span className="text-xs font-black italic text-[#FF1F6D]">{stats.engagement}%/70%</span>
                        </div>
                        <div className="h-2.5 bg-white/50 rounded-full overflow-hidden p-0.5 border border-white">
                           <div className="h-full bg-[#FF1F6D] rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(255,31,109,0.3)]" style={{ width: `${Math.min((stats.engagement / 70) * 100, 100)}%` }} />
                        </div>
                     </div>

                     <div className="p-6 bg-purple-50 dark:bg-purple-500/5 rounded-[32px] border border-purple-100 dark:border-purple-500/10">
                        <div className="flex justify-between items-center mb-4">
                           <div className="flex items-center gap-2">
                              <Star size={16} className="text-purple-600" />
                              <span className="text-[10px] font-black uppercase italic tracking-widest text-purple-600">Reputation Badges</span>
                           </div>
                           <span className="text-xs font-black italic text-purple-600">{stats.trustLevel >= 3 ? '2/2' : stats.trustLevel >= 1 ? '1/2' : '0/2'}</span>
                        </div>
                        <div className="flex gap-3">
                           <div className={`flex-1 p-3 rounded-2xl border ${stats.trustLevel >= 1 ? 'bg-white border-amber-200' : 'bg-slate-50 border-slate-100 opacity-50'} flex flex-col items-center gap-1`}>
                              <Zap size={14} className={stats.trustLevel >= 1 ? 'text-amber-500' : 'text-slate-300'} fill={stats.trustLevel >= 1 ? 'currentColor' : 'none'} />
                              <span className="text-[7px] font-black uppercase tracking-tighter text-black">Spark Seed</span>
                           </div>
                           <div className={`flex-1 p-3 rounded-2xl border ${stats.trustLevel >= 3 ? 'bg-white border-emerald-200' : 'bg-slate-50 border-slate-100 opacity-50'} flex flex-col items-center gap-1`}>
                              <TrendingUp size={14} className={stats.trustLevel >= 3 ? 'text-emerald-500' : 'text-slate-300'} />
                              <span className="text-[7px] font-black uppercase tracking-tighter text-black">Viral Node</span>
                           </div>
                        </div>
                     </div>

                     <div className="flex items-center gap-4 p-5 bg-amber-50 rounded-3xl border border-amber-100/50">
                        <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                           <Lock size={20} strokeWidth={3} />
                        </div>
                        <p className="text-[10px] font-bold text-amber-800 leading-tight uppercase italic tracking-tight">
                           Application Locked. Increase your Node engagement and follower reach to unlock the Verification evolution.
                        </p>
                     </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 p-6 bg-emerald-50 rounded-[32px] border border-emerald-100">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 animate-bounce">
                           <Zap size={24} strokeWidth={3} />
                        </div>
                        <div className="text-left">
                           <h4 className="text-xs font-black text-emerald-900 dark:text-emerald-500 uppercase italic">Verification Unlocked!</h4>
                           <p className="text-[10px] font-bold text-emerald-700/70 dark:text-emerald-500/40 uppercase italic tracking-tight">You have met the Sparkle Global criteria. Proceed to evolution.</p>
                        </div>
                    </div>
                    <button 
                      onClick={() => setStep(2)} 
                      className="w-full py-5 rounded-[22px] bg-black dark:bg-white text-white dark:text-black font-black text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-3 uppercase tracking-wider italic"
                    >
                      Begin Evolution
                      <TrendingUp size={20} strokeWidth={3} />
                    </button>
                  </div>
                )}
              </div>

              {/* System Perks */}
              <div className="grid grid-cols-2 gap-4">
                 {[
                   { label: 'Priority Node', icon: <Zap size={18} />, color: 'bg-indigo-50 text-indigo-600' },
                   { label: 'Global Search', icon: <Target size={18} />, color: 'text-emerald-600 bg-emerald-50' },
                   { label: 'Shield Sync', icon: <Shield size={18} />, color: 'text-amber-600 bg-amber-50' },
                   { label: 'Legacy Badge', icon: <Star size={18} />, color: 'text-[#FF1F6D] bg-pink-50' }
                 ].map((perk, i) => (
                   <div key={i} className="bg-white/60 dark:bg-white/5 backdrop-blur-xl p-4 rounded-3xl border border-white dark:border-white/10 flex flex-col items-center gap-2 text-center">
                      <div className={`w-10 h-10 rounded-2xl ${perk.color} flex items-center justify-center border border-white dark:border-white/10 shadow-sm`}>
                        {perk.icon}
                      </div>
                      <span className="text-[9px] font-black text-black dark:text-white uppercase italic tracking-widest">{perk.label}</span>
                   </div>
                 ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="bg-white/70 dark:bg-[#121212]/80 backdrop-blur-3xl rounded-[40px] shadow-2xl shadow-black/5 border border-white/60 dark:border-white/5 p-8 md:p-12 transition-all">
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-black/40 dark:text-white/40 uppercase tracking-widest pl-2 italic">Select Evolution Category</label>
                  <div className="relative">
                    <select
                      required
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full appearance-none bg-white/80 dark:bg-white/5 border-2 border-white/50 dark:border-white/10 text-black dark:text-white text-sm font-bold rounded-2xl px-6 py-4 focus:outline-none focus:border-[#FF1F6D] transition-all cursor-pointer shadow-sm italic"
                    >
                      <option value="">What fits your Node?</option>
                      <option value="creator">Creator Elite</option>
                      <option value="public_figure">Public Entity</option>
                      <option value="brand">Brand Node</option>
                      <option value="community_leader">Community Architect</option>
                      <option value="other">Other Unique Signal</option>
                    </select>
                    <ChevronDown size={18} strokeWidth={3} className="absolute right-5 top-1/2 -translate-y-1/2 text-black/20 dark:text-white/20 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-black/40 dark:text-white/40 uppercase tracking-widest pl-2 italic">Identity Node Auth</label>
                  <div className="relative">
                    <select
                      required
                      value={formData.documentType}
                      onChange={e => setFormData({ ...formData, documentType: e.target.value })}
                      className="w-full appearance-none bg-white/80 dark:bg-white/5 border-2 border-white/50 dark:border-white/10 text-black dark:text-white text-sm font-bold rounded-2xl px-6 py-4 focus:outline-none focus:border-[#FF1F6D] transition-all cursor-pointer shadow-sm italic"
                    >
                      <option value="">Select identity source</option>
                      <option value="passport">Global Passport</option>
                      <option value="drivers_license">Driver's Node</option>
                      <option value="national_id">National Registry ID</option>
                    </select>
                    <ChevronDown size={18} strokeWidth={3} className="absolute right-5 top-1/2 -translate-y-1/2 text-black/20 dark:text-white/20 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-black/40 dark:text-white/40 uppercase tracking-widest pl-2 italic">Signal Evidence (Upload)</label>
                  <div className="group relative">
                    <input type="file" id="id-upload" className="sr-only" required />
                    <label 
                      htmlFor="id-upload" 
                      className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-black/10 dark:border-white/10 rounded-[32px] bg-white/40 dark:bg-white/5 group-hover:bg-white/60 dark:group-hover:bg-white/10 group-hover:border-[#FF1F6D]/30 transition-all cursor-pointer"
                    >
                      <div className="w-14 h-14 rounded-full bg-white dark:bg-[#101217] shadow-md flex items-center justify-center text-black/20 dark:text-white/20 group-hover:text-[#FF1F6D] transition-colors mb-3">
                        <Upload size={24} strokeWidth={2.5} />
                      </div>
                      <span className="text-[10px] font-black text-black/60 dark:text-white/60 uppercase italic tracking-widest">Transmit File Signal</span>
                      <span className="text-[8px] font-bold text-black/30 dark:text-white/20 mt-1 uppercase italic tracking-widest">JPG, PNG, PDF (10MB MAX)</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-black/40 dark:text-white/40 uppercase tracking-widest pl-2 italic">Reputation Logic</label>
                  <textarea
                    rows={4}
                    placeholder="Briefly explain your social signal impact..."
                    required
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-white/80 dark:bg-white/5 border-2 border-white/50 dark:border-white/10 text-black dark:text-white text-sm font-bold rounded-2xl px-6 py-4 focus:outline-none focus:border-[#FF1F6D] transition-all shadow-sm placeholder:text-black/20 dark:placeholder:text-white/20 italic"
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  disabled={submitLoading} 
                  className="w-full py-5 rounded-[22px] bg-[#FF1F6D] text-white font-black text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-[#FF1F6D]/20 flex items-center justify-center gap-3 uppercase tracking-wider italic"
                >
                  {submitLoading ? (
                    <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Send size={20} strokeWidth={3} />
                      Submit Evolution
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="bg-white/70 dark:bg-[#121212]/80 backdrop-blur-3xl rounded-[40px] shadow-2xl shadow-black/5 border border-white/60 dark:border-white/5 p-10 md:p-14 text-center transition-all animate-scale-in">
              <div className="w-24 h-24 md:w-32 md:h-32 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner border border-emerald-100 dark:border-emerald-500/20">
                <CheckCircle2 size={56} md:size={80} strokeWidth={2} />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-black dark:text-white tracking-tight italic mb-3 uppercase">Signal Transmitted</h2>
              <p className="text-sm md:text-base text-black/50 dark:text-white/40 leading-relaxed font-medium mb-10 max-w-sm mx-auto italic uppercase">
                Your reputation evolution is being processed. Expect node confirmation within 24–48 hours.
              </p>

              <div className="flex justify-between items-center px-4 mb-12 relative">
                <div className="absolute top-4 left-10 right-10 h-0.5 bg-black/5 dark:bg-white/5 z-0" />
                <div className="flex flex-col items-center gap-3 relative z-10">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 size={16} strokeWidth={3} />
                  </div>
                  <span className="text-[10px] font-black uppercase text-emerald-500 tracking-wider italic">Sent</span>
                </div>
                <div className="flex flex-col items-center gap-3 relative z-10">
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-[#121212] text-black/10 dark:text-white/10 flex items-center justify-center shadow-sm border border-black/5 dark:border-white/5">
                    <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  </div>
                  <span className="text-[10px] font-black uppercase text-black/20 dark:text-white/20 tracking-wider italic">Auditing</span>
                </div>
                <div className="flex flex-col items-center gap-3 relative z-10">
                  <div className="w-8 h-8 rounded-full bg-white dark:bg-[#121212] text-black/10 dark:text-white/10 flex items-center justify-center shadow-sm border border-black/5 dark:border-white/5">
                    <div className="w-2 h-2 rounded-full bg-current" />
                  </div>
                  <span className="text-[10px] font-black uppercase text-black/20 dark:text-white/20 tracking-wider italic">Finalized</span>
                </div>
              </div>

              <button 
                onClick={() => navigate('/dashboard')} 
                className="w-full py-5 rounded-[22px] bg-black dark:bg-white text-white dark:text-black font-black text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/10 dark:shadow-white/10 uppercase tracking-wider italic"
              >
                Return to Node
              </button>
            </div>
          )}
        </main>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-scale-in { animation: scaleIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
}
