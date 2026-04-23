import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle2, Sparkles, Key, Hash, Orbit, ChevronLeft } from 'lucide-react';
import api from '../api/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const emailParam = searchParams.get('email') || '';
  const tokenParam = searchParams.get('token') || searchParams.get('code') || '';

  const [otp, setOtp] = useState(tokenParam);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Password strength
  const strength = (() => {
    if (!newPassword) return 0;
    let s = 0;
    if (newPassword.length >= 8) s++;
    if (/[A-Z]/.test(newPassword)) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    return s;
  })();
  const strengthColors = ['', '#e11d48', '#f59e0b', '#10b981', '#059669'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) return setError('Passwords do not match.');
    if (newPassword.length < 8) return setError('Password must be at least 8 characters.');

    const resetCode = otp || tokenParam;
    if (!resetCode) return setError('Missing verification code.');

    const payload = { 
      token: resetCode, 
      email: emailParam, 
      code: resetCode, 
      newPassword 
    };

    setLoading(true);
    try {
      await api.post('/auth/reset-password', payload);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Reset failed. The code may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdf2f4] flex items-center justify-center p-6 font-sans overflow-hidden">
      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/20 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/20 rounded-full blur-[120px] pointer-events-none z-0" />

      <div className="w-full max-w-6xl bg-white/80 backdrop-blur-3xl rounded-[56px] shadow-2xl flex overflow-hidden animate-fade-in border border-white relative z-10">
        
        {/* LEFT: Visual Side */}
        <div className="hidden lg:flex w-2/5 relative bg-black flex-col p-20 justify-between overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 rounded-full blur-[100px] animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px]"></div>
          
          <div className="relative z-10 space-y-12">
            <div className="flex items-center gap-4">
               <div className="w-16 h-16 bg-primary text-white rounded-[24px] flex items-center justify-center shadow-2xl shadow-primary/30 group hover:rotate-12 transition-transform duration-700">
                  <Sparkles size={32} strokeWidth={3} />
               </div>
               <h1 className="text-4xl font-black text-white tracking-tighter italic uppercase underline decoration-primary decoration-4 underline-offset-8">Sparkle</h1>
            </div>
            
            <div className="space-y-6">
              <h2 className="text-7xl font-black text-white leading-none tracking-tighter uppercase italic">
                 Security <span className="text-primary">First.</span>
              </h2>
              <p className="text-white/40 text-xl font-bold leading-relaxed italic max-w-xs">
                 Establish a complex frequency passcode to secure your node in the village.
              </p>
            </div>
          </div>

          <div className="relative z-10">
            <div className="space-y-8">
               <div className="flex items-center gap-6 group">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-primary transition-all">
                     <Lock className="text-white/20 group-hover:text-white" size={24} strokeWidth={3} />
                  </div>
                  <div>
                    <p className="text-white font-black text-[10px] uppercase tracking-[0.3em] italic">Protocol</p>
                    <p className="text-white font-bold text-base italic">Min. 8 Characters</p>
                  </div>
               </div>
               <div className="flex items-center gap-6 group">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-primary transition-all">
                     <Orbit className="text-white/20 group-hover:text-white" size={24} strokeWidth={3} />
                  </div>
                  <div>
                    <p className="text-white font-black text-[10px] uppercase tracking-[0.3em] italic">Complexity</p>
                    <p className="text-white font-bold text-base italic">Alpha-Numeric-Symbol</p>
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Form Side */}
        <div className="flex-1 flex flex-col p-12 md:p-24 relative bg-white/40 overflow-y-auto no-scrollbar">
          {error && (
             <div className="mb-12 bg-rose-50 border-2 border-rose-100 p-6 rounded-[28px] flex items-center gap-5 animate-fade-in">
                <div className="w-3 h-3 rounded-full bg-rose-600 animate-ping"></div>
                <p className="text-rose-600 text-xs font-black uppercase tracking-[0.2em] italic">{error}</p>
             </div>
          )}

          <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
            {success ? (
              /* ── Success State ── */
              <div className="animate-fade-in text-center space-y-12">
                <div className="flex flex-col items-center">
                  <div className="w-28 h-28 bg-emerald-50 rounded-[40px] flex items-center justify-center mb-10 shadow-2xl shadow-emerald-500/10 scale-in animate-bounce">
                     <CheckCircle2 size={48} className="text-emerald-500" strokeWidth={3} />
                  </div>
                  <h2 className="text-5xl font-black text-black tracking-tighter uppercase italic leading-none mb-6">
                    Identity <span className="text-emerald-500">Secured.</span>
                  </h2>
                  <p className="text-lg font-bold text-black opacity-40 italic leading-relaxed">
                    Your encryption protocols have been updated. Harmonizing with login systems...
                  </p>
                </div>

                <div className="relative w-full h-2 bg-emerald-50 rounded-full overflow-hidden p-0.5 shadow-inner">
                   <div className="h-full bg-emerald-500 rounded-full animate-progress-bar"></div>
                </div>
              </div>
            ) : (
              /* ── Form State ── */
              <div className="animate-fade-in">
                <div className="mb-16">
                  <h1 className="text-6xl font-black text-black tracking-tighter uppercase italic leading-none mb-6">Recalibrate <span className="text-primary italic">Secret.</span></h1>
                  <p className="text-lg font-bold text-black opacity-30 italic">
                    Verify the security code transmitted to <span className="text-primary font-black opacity-100">{emailParam}</span>
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-10">
                   {/* OTP Field */}
                   <div className="space-y-4">
                      <label className="flex items-center gap-3 text-[10px] font-black text-black opacity-20 uppercase tracking-[0.4em] ml-6 italic">
                         <Hash size={18} strokeWidth={4} /> Authorization Key
                      </label>
                      <input 
                         type="text" 
                         inputMode="numeric"
                         maxLength={6}
                         value={otp}
                         onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                         className="w-full h-24 bg-black/5 border-2 border-transparent focus:border-primary focus:bg-white rounded-[32px] px-10 text-center text-4xl font-black text-black tracking-[0.6em] transition-all outline-none italic shadow-inner"
                         placeholder="••••••"
                         required
                      />
                   </div>

                   {/* New Password */}
                   <div className="space-y-4">
                      <label className="flex items-center gap-3 text-[10px] font-black text-black opacity-20 uppercase tracking-[0.4em] ml-6 italic">
                         <Lock size={18} strokeWidth={4} /> New Protocol Code
                      </label>
                      <div className="relative">
                         <input 
                            type={showPassword ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full h-20 bg-black/5 border-2 border-transparent focus:border-primary focus:bg-white rounded-[28px] px-8 text-lg font-black text-black placeholder:text-black/5 transition-all outline-none italic shadow-inner"
                            placeholder="SECRET_HARMONIC"
                            required
                         />
                         <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-8 top-1/2 -translate-y-1/2 text-black/20 hover:text-primary transition-colors"
                         >
                            {showPassword ? <EyeOff size={24} strokeWidth={4} /> : <Eye size={24} strokeWidth={4} />}
                         </button>
                      </div>
                      {/* Strength Meter */}
                      {newPassword && (
                        <div className="flex gap-2 px-8">
                           {[1, 2, 3, 4].map(i => (
                              <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-700 ${i <= strength ? '' : 'bg-black/5'}`} style={{ backgroundColor: i <= strength ? strengthColors[strength] : undefined }} />
                           ))}
                        </div>
                      )}
                   </div>

                   {/* Confirm Password */}
                   <div className="space-y-4">
                      <label className="flex items-center gap-3 text-[10px] font-black text-black opacity-20 uppercase tracking-[0.4em] ml-6 italic">
                         <Key size={18} strokeWidth={4} /> Repeat Code
                      </label>
                      <input 
                         type={showPassword ? 'text' : 'password'}
                         value={confirmPassword}
                         onChange={(e) => setConfirmPassword(e.target.value)}
                         className={`w-full h-20 bg-black/5 border-2 rounded-[28px] px-8 text-lg font-black text-black placeholder:text-black/5 focus:bg-white transition-all outline-none italic shadow-inner ${confirmPassword && newPassword !== confirmPassword ? 'border-rose-500 bg-rose-50' : 'border-transparent focus:border-primary'}`}
                         placeholder="REPEAT_SECRET"
                         required
                      />
                   </div>

                   <button 
                      type="submit" 
                      disabled={loading}
                      className="w-full h-24 bg-primary text-white rounded-[32px] font-black text-sm uppercase tracking-[0.3em] shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center italic"
                   >
                      {loading ? 'Transmitting...' : 'Update Protocol'}
                   </button>

                   <Link 
                      to="/forgot-password" 
                      className="flex items-center justify-center gap-4 text-black opacity-30 hover:opacity-100 hover:text-primary text-[10px] font-black uppercase tracking-[0.4em] transition-all italic"
                   >
                      <ChevronLeft size={16} strokeWidth={4} className="hover:-translate-x-2 transition-transform" /> Sync New Key
                   </Link>
                </form>
              </div>
            )}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes progress { from { width: 0%; } to { width: 100%; } }
        .animate-progress-bar { animation: progress 3s linear forwards; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin 15s linear infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
