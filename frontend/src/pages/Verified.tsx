import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BadgeCheck, ShieldCheck, Star, FileText, Upload, Send, CheckCircle2, ChevronDown } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useUserStore } from '../store/userStore';
import { getAvatarUrl } from '../utils/imageUtils';
import Spinner from '../components/ui/Spinner';

export default function Verified() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    category: '',
    documentType: '',
    description: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(3);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#fdf2f4] text-black font-sans pb-20 lg:pb-0 overflow-x-hidden pt-12 md:pt-20 relative">
      <Navbar />

      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[300px] md:w-[700px] h-[300px] md:h-[700px] bg-red-200/20 rounded-full blur-[80px] md:blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[250px] md:w-[500px] h-[250px] md:h-[500px] bg-pink-200/20 rounded-full blur-[60px] md:blur-[120px] pointer-events-none z-0" />

      <div className="max-w-2xl mx-auto pt-10 md:pt-16 px-4 md:px-6 relative z-10 pb-20">
        {/* Header */}
        <header className="flex items-center gap-5 md:gap-8 mb-10 md:mb-12 animate-fade-in">
          <button 
            onClick={() => navigate(-1)} 
            className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-white/80 backdrop-blur-3xl flex items-center justify-center text-black shadow-lg border border-white hover:scale-105 active:scale-95 transition-all"
          >
            <ArrowLeft size={22} md:size={26} strokeWidth={3} />
          </button>
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-black tracking-tight italic leading-none">Verification</h1>
            <p className="text-sm md:text-base font-medium text-black/40 mt-2">Apply for a verified badge to show you're authentic.</p>
          </div>
        </header>

        <main className="animate-fade-in">
          {step === 1 && (
            <div className="bg-white/70 backdrop-blur-3xl rounded-[32px] md:rounded-[48px] shadow-2xl shadow-black/5 border border-white/60 overflow-hidden p-8 md:p-12 text-center transition-all">
              <div className="mb-10">
                <div className="relative w-28 h-28 md:w-36 md:h-36 mx-auto mb-6">
                  <img 
                    src={getAvatarUrl(user?.avatar_url, user?.username)} 
                    alt="" 
                    className="w-full h-full rounded-full object-cover border-4 border-white shadow-2xl"
                  />
                  <div className="absolute -bottom-1 -right-1 md:bottom-1 md:right-1 bg-white rounded-full p-1 shadow-lg">
                    <BadgeCheck size={36} md:size={48} fill="#ff1f6d" color="white" strokeWidth={1} />
                  </div>
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-black tracking-tight italic mb-3">Authenticity Badge</h3>
                <p className="text-sm md:text-base text-black/50 leading-relaxed max-w-md mx-auto font-medium">
                  Verification tells the community that your profile is authentic and officially recognized.
                </p>
              </div>

              <div className="grid gap-4 mb-10 text-left">
                <div className="flex gap-4 items-start p-5 bg-white/50 rounded-3xl border border-white/40">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <ShieldCheck size={24} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-black">Verified Identity</h4>
                    <p className="text-sm text-black/40 font-medium">Confirm that you are the real owner of this profile.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start p-5 bg-white/50 rounded-3xl border border-white/40">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Star size={24} strokeWidth={2.5} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-black">Priority Support</h4>
                    <p className="text-sm text-black/40 font-medium">Get faster responses and exclusive creator tools.</p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setStep(2)} 
                className="w-full py-5 rounded-[22px] bg-black text-white font-black text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-3 uppercase tracking-wider"
              >
                Apply Now
              </button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="bg-white/70 backdrop-blur-3xl rounded-[32px] md:rounded-[48px] shadow-2xl shadow-black/5 border border-white/60 overflow-hidden p-8 md:p-12 transition-all">
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-xs font-black text-black/40 uppercase tracking-widest pl-2">Select Category</label>
                  <div className="relative">
                    <select
                      required
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full appearance-none bg-white/80 border-2 border-white/50 text-black text-sm font-bold rounded-2xl px-6 py-4 focus:outline-none focus:border-primary transition-all cursor-pointer shadow-sm"
                    >
                      <option value="">What fits you best?</option>
                      <option value="student_leader">Student Leader</option>
                      <option value="creator">Content Creator</option>
                      <option value="athlete">Campus Athlete</option>
                      <option value="influencer">Social Influencer</option>
                      <option value="other">Other</option>
                    </select>
                    <ChevronDown size={18} strokeWidth={3} className="absolute right-5 top-1/2 -translate-y-1/2 text-black/20 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-black/40 uppercase tracking-widest pl-2">Document Type</label>
                  <div className="relative">
                    <select
                      required
                      value={formData.documentType}
                      onChange={e => setFormData({ ...formData, documentType: e.target.value })}
                      className="w-full appearance-none bg-white/80 border-2 border-white/50 text-black text-sm font-bold rounded-2xl px-6 py-4 focus:outline-none focus:border-primary transition-all cursor-pointer shadow-sm"
                    >
                      <option value="">Select ID type</option>
                      <option value="student_id">Student ID Card</option>
                      <option value="passport">Passport</option>
                      <option value="drivers_license">Driver's License</option>
                    </select>
                    <ChevronDown size={18} strokeWidth={3} className="absolute right-5 top-1/2 -translate-y-1/2 text-black/20 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-black/40 uppercase tracking-widest pl-2">Upload ID Image</label>
                  <div className="group relative">
                    <input type="file" id="id-upload" className="sr-only" required />
                    <label 
                      htmlFor="id-upload" 
                      className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-black/10 rounded-[32px] bg-white/40 group-hover:bg-white/60 group-hover:border-primary/30 transition-all cursor-pointer"
                    >
                      <div className="w-14 h-14 rounded-full bg-white shadow-md flex items-center justify-center text-black/20 group-hover:text-primary transition-colors mb-3">
                        <Upload size={24} strokeWidth={2.5} />
                      </div>
                      <span className="text-sm font-bold text-black/60">Choose a file or drop here</span>
                      <span className="text-[10px] font-medium text-black/30 mt-1">Supports JPG, PNG or PDF (Max 10MB)</span>
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-black/40 uppercase tracking-widest pl-2">Why should you be verified?</label>
                  <textarea
                    rows={4}
                    placeholder="Briefly explain your presence on campus or online..."
                    required
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-white/80 border-2 border-white/50 text-sm font-bold rounded-2xl px-6 py-4 focus:outline-none focus:border-primary transition-all shadow-sm placeholder:text-black/20"
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  disabled={loading} 
                  className="w-full py-5 rounded-[22px] bg-primary text-white font-black text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-3 uppercase tracking-wider"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Send size={20} strokeWidth={3} />
                      Submit Application
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div className="bg-white/70 backdrop-blur-3xl rounded-[32px] md:rounded-[48px] shadow-2xl shadow-black/5 border border-white/60 overflow-hidden p-8 md:p-12 text-center transition-all animate-scale-in">
              <div className="w-24 h-24 md:w-32 md:h-32 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                <CheckCircle2 size={56} md:size={80} strokeWidth={2} />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-black tracking-tight italic mb-3">Submitted!</h2>
              <p className="text-sm md:text-base text-black/50 leading-relaxed font-medium mb-10 max-w-sm mx-auto">
                We've received your application. Our team will review your details within 24–48 hours.
              </p>

              <div className="flex justify-between items-center px-4 mb-10 relative">
                <div className="absolute top-4 left-10 right-10 h-0.5 bg-black/5 z-0" />
                <div className="flex flex-col items-center gap-3 relative z-10">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <CheckCircle2 size={16} strokeWidth={3} />
                  </div>
                  <span className="text-[10px] font-black uppercase text-emerald-500 tracking-wider">Sent</span>
                </div>
                <div className="flex flex-col items-center gap-3 relative z-10">
                  <div className="w-8 h-8 rounded-full bg-white text-black/10 flex items-center justify-center shadow-sm border border-black/5">
                    <div className="w-2 h-2 rounded-full bg-current" />
                  </div>
                  <span className="text-[10px] font-bold uppercase text-black/20 tracking-wider">Review</span>
                </div>
                <div className="flex flex-col items-center gap-3 relative z-10">
                  <div className="w-8 h-8 rounded-full bg-white text-black/10 flex items-center justify-center shadow-sm border border-black/5">
                    <div className="w-2 h-2 rounded-full bg-current" />
                  </div>
                  <span className="text-[10px] font-bold uppercase text-black/20 tracking-wider">Done</span>
                </div>
              </div>

              <button 
                onClick={() => navigate('/home')} 
                className="w-full py-5 rounded-[22px] bg-black text-white font-black text-lg hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-black/10 uppercase tracking-wider"
              >
                Back to Feed
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
