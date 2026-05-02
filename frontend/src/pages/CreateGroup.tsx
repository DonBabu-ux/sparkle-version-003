import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api/api';
import axios from 'axios';
import { Compass, Sparkles, Globe, Layers, Eye, EyeOff, ArrowLeft, ArrowRight, Shield } from 'lucide-react';

export default function CreateGroup() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    campus: 'main',
    category: 'general',
    is_public: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setLoading(true);
    setError('');
    
    try {
      const response = await api.post('/groups', formData);
      if (response.data.success) {
        navigate(`/groups/${response.data.id}`);
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to create circle. Please try again.');
      } else {
        setError('Failed to create circle. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen font-sans" style={{ background: 'linear-gradient(135deg, #fff0f4 0%, #fff9fa 55%, #fef0f5 100%)' }}>
      <Navbar />
      <div className="fixed top-[-80px] right-[-80px] w-[420px] h-[420px] rounded-full pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(255,61,109,0.18) 0%, transparent 70%)' }} />
      <div className="fixed bottom-[-60px] left-[-60px] w-[360px] h-[360px] rounded-full pointer-events-none z-0" style={{ background: 'radial-gradient(circle, rgba(255,100,150,0.14) 0%, transparent 70%)' }} />

      <main className="max-w-4xl mx-auto px-6 py-32 relative z-10">
        <button 
          onClick={() => navigate('/groups')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold mb-12 transition-colors group"
        >
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">Back to Circles</span>
        </button>

        <header className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5" style={{ background: 'rgba(255,61,109,0.12)', border: '1px solid rgba(255,61,109,0.25)' }}>
            <Sparkles size={13} style={{ color: '#FF3D6D' }} />
            <span style={{ fontSize: '10px', fontWeight: 800, color: '#FF3D6D', letterSpacing: '0.12em', textTransform: 'uppercase', fontStyle: 'normal' }}>New Community</span>
          </div>
          <h1 style={{ fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.05, color: '#1a1a2e', fontStyle: 'normal', textTransform: 'none', marginBottom: '12px' }}>
            Create a <span style={{ color: '#FF3D6D' }}>Circle</span>
          </h1>
          <p style={{ fontSize: '1rem', color: '#64748b', fontWeight: 500, fontStyle: 'normal', textTransform: 'none' }}>
            Build a space for your tribe, interests, or project.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200">
           <div className="lg:col-span-7 p-10 rounded-[40px]" style={{ background: 'rgba(255,255,255,0.92)', border: '1.5px solid rgba(255,61,109,0.12)', boxShadow: '0 4px 32px rgba(255,61,109,0.07)' }}>
              {error && (
                <div className="mb-8 p-4 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-2xl animate-shake flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">⚠️</div>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-10">
                 <div className="space-y-4">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Circle Name</label>
                    <input 
                      type="text" 
                      required
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      placeholder="e.g. Photography Club" 
                      className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-slate-900 font-bold focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all placeholder:text-slate-300"
                    />
                 </div>

                 <div className="space-y-4">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Description</label>
                    <textarea 
                      value={formData.description}
                      onChange={e => setFormData({...formData, description: e.target.value})}
                      placeholder="What is this community about?" 
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-6 text-slate-900 font-medium focus:bg-white focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all placeholder:text-slate-300 min-h-[120px] resize-none"
                    />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                       <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                          <Globe size={14} /> Campus
                       </label>
                       <select 
                         value={formData.campus}
                         onChange={e => setFormData({...formData, campus: e.target.value})}
                         className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-sm font-bold text-slate-600 focus:bg-white focus:ring-4 focus:ring-primary/5 outline-none transition-all appearance-none cursor-pointer"
                       >
                         <option value="main">Main Campus</option>
                         <option value="north">North Sector</option>
                         <option value="south">South Sector</option>
                         <option value="virtual">Virtual</option>
                       </select>
                    </div>
                    <div className="space-y-4">
                       <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                          <Layers size={14} /> Category
                       </label>
                       <select 
                         value={formData.category}
                         onChange={e => setFormData({...formData, category: e.target.value})}
                         className="w-full h-14 bg-slate-50 border border-slate-100 rounded-2xl px-6 text-sm font-bold text-slate-600 focus:bg-white focus:ring-4 focus:ring-primary/5 outline-none transition-all appearance-none cursor-pointer"
                       >
                         <option value="general">General</option>
                         <option value="tech">Technology</option>
                         <option value="art">Art & Design</option>
                         <option value="gaming">Gaming</option>
                         <option value="study">Academic</option>
                       </select>
                    </div>
                 </div>

                 <div 
                   onClick={() => setFormData({...formData, is_public: !formData.is_public})}
                   className={`p-6 rounded-3xl border-2 cursor-pointer transition-all flex items-center justify-between ${formData.is_public ? 'bg-white border-primary/20 shadow-lg shadow-primary/5' : 'bg-slate-50 border-slate-100 opacity-60 hover:opacity-100'}`}
                 >
                    <div className="flex items-center gap-4">
                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${formData.is_public ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                          {formData.is_public ? <Eye size={24} /> : <EyeOff size={24} />}
                       </div>
                       <div>
                         <h4 className="text-sm font-bold text-slate-900">Public Visibility</h4>
                         <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                           {formData.is_public ? 'Anyone can join and see posts' : 'Membership requires approval'}
                         </p>
                       </div>
                    </div>
                    <div className={`w-12 h-6 rounded-full relative transition-all ${formData.is_public ? 'bg-primary' : 'bg-slate-300'}`}>
                       <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.is_public ? 'left-7' : 'left-1'}`}></div>
                    </div>
                 </div>

                 <button
                   type="submit"
                   disabled={loading}
                   style={{ width: '100%', height: '56px', background: 'linear-gradient(135deg, #FF3D6D, #e01f55)', color: '#fff', borderRadius: '18px', fontWeight: 800, fontSize: '14px', border: 'none', cursor: 'pointer', boxShadow: '0 8px 28px rgba(255,61,109,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', fontStyle: 'normal', textTransform: 'none', opacity: loading ? 0.6 : 1, transition: 'all 0.2s' }}
                 >
                   {loading ? (
                     <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                   ) : (
                     <>Create Circle <ArrowRight size={18} /></>
                   )}
                 </button>
              </form>
           </div>

           <div className="lg:col-span-5 space-y-8">
              <div className="bg-slate-900 p-10 rounded-[40px] text-white shadow-2xl relative overflow-hidden group">
                 <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-50 blur-3xl animate-pulse"></div>
                 <div className="relative z-10">
                    <Compass size={40} className="text-primary mb-6" />
                    <h3 className="text-2xl font-black mb-4">Guidelines</h3>
                    <ul className="space-y-4">
                       {[
                         "Be respectful to all members",
                         "Keep content relevant to the circle",
                         "No spam or unauthorized promotions",
                         "Report any inappropriate behavior"
                       ].map((rule, i) => (
                         <li key={i} className="flex items-start gap-3 text-sm text-slate-400 font-medium leading-relaxed">
                            <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-primary mt-0.5 shrink-0">{i+1}</div>
                            {rule}
                         </li>
                       ))}
                    </ul>
                 </div>
              </div>

              <div className="flex items-center gap-4 p-6 rounded-[24px]" style={{ background: 'rgba(255,255,255,0.92)', border: '1.5px solid rgba(255,61,109,0.12)', boxShadow: '0 2px 16px rgba(255,61,109,0.05)' }}>
                 <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500">
                    <Shield size={24} />
                 </div>
                 <div>
                    <h4 className="text-sm font-bold text-slate-900">Safety First</h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight leading-none mt-1">Circles are moderated by creators</p>
                 </div>
              </div>
           </div>
        </div>
      </main>

      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-in-from-bottom { from { transform: translateY(20px); } to { transform: translateY(0); } }
        .animate-in { animation-duration: 500ms; animation-fill-mode: both; }
        .fade-in { animation-name: fade-in; }
        .slide-in-from-bottom-4 { animation-name: slide-in-from-bottom; }
        .slide-in-from-bottom-6 { animation-name: slide-in-from-bottom; }
        .delay-200 { animation-delay: 200ms; }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.2s ease-in-out 0s 2; }
      `}</style>
    </div>
  );
}
