import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Users, ShoppingBag, MessageSquare, Star, ChevronRight, Globe, Shield, Sparkles } from 'lucide-react';

export default function Landing() {
  const [showSplash, setShowSplash] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => setShowSplash(false), 600);
    }, 2800);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <SplashLoader fadeOut={fadeOut} />;
  }

  const features = [
    { icon: <Users size={24} />, title: 'Campus Social Feed', desc: 'Share posts, stories, and moments with your university community in real time.', color: 'from-pink-500 to-rose-500' },
    { icon: <MessageSquare size={24} />, title: 'Private Messaging', desc: 'Chat privately or in groups, with disappearing messages and read receipts.', color: 'from-indigo-500 to-violet-500' },
    { icon: <ShoppingBag size={24} />, title: 'Campus Marketplace', desc: 'Buy, sell, and trade textbooks, electronics, and services on campus.', color: 'from-amber-500 to-orange-500' },
    { icon: <Star size={24} />, title: 'Clubs & Communities', desc: 'Join or create clubs, attend events, and manage groups with your peers.', color: 'from-emerald-500 to-teal-500' },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden selection:bg-indigo-100 selection:text-indigo-700">
      <style>{`
        .hero-gradient { background: radial-gradient(circle at 50% -20%, #eff6ff 0%, #ffffff 60%); }
        .mesh-bg { background-image: radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.05) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(244, 63, 94, 0.05) 0px, transparent 50%); }
      `}</style>
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between glass-card px-6 py-3 rounded-2xl border-white/50 backdrop-blur-2xl shadow-xl shadow-slate-200/40">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <Sparkles size={22} fill="currentColor" />
            </div>
            <span className="text-2xl font-black tracking-tighter text-slate-800">Sparkle</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-500">
            <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
            <a href="#community" className="hover:text-indigo-600 transition-colors">Community</a>
            <a href="#safety" className="hover:text-indigo-600 transition-colors">Privacy</a>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/login" className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-indigo-600 transition-colors">Log In</Link>
            <Link to="/signup" className="premium-btn px-6 py-2.5 rounded-xl text-sm">Join Sparkle</Link>
          </div>
        </div>
      </nav>

      <main className="mesh-bg">
        {/* Hero Section */}
        <section className="relative pt-44 pb-32 px-6 hero-gradient overflow-hidden">
           <div className="absolute top-40 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-100/40 blur-[120px] rounded-full -z-10" />
           
           <div className="max-w-5xl mx-auto text-center relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100/50 text-indigo-600 text-xs font-black uppercase tracking-widest mb-8 animate-fade-in">
                <Zap size={14} fill="currentColor" /> The pulse of your campus is here
              </div>

              <h1 className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter leading-[0.95] mb-8 animate-fade-in">
                Connect your <br />
                <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-rose-500 bg-clip-text text-transparent">campus world.</span>
              </h1>
              
              <p className="max-w-2xl mx-auto text-xl font-medium text-slate-500 leading-relaxed mb-12 animate-fade-in" style={{ animationDelay: '0.1s' }}>
                Sparkle is the ultra-modern social ecosystem built exclusively for university life. Real connections, private communities, and campus marketplace.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <Link to="/signup" className="premium-btn px-10 py-5 rounded-2xl text-lg group">
                   Get Started <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <div className="flex items-center gap-3 px-6 text-sm font-bold text-slate-400">
                   <div className="flex -space-x-3">
                      {[1,2,3,4].map(i => <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200" />)}
                   </div>
                   <span>Joined by 10k+ students</span>
                </div>
              </div>
           </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-32 px-6 max-w-7xl mx-auto">
           <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">Universe of Features</h2>
              <p className="text-slate-500 font-bold max-w-xl mx-auto">Everything you need to navigate campus social life and logistics in one premium experience.</p>
           </div>

           <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((f, i) => (
                <div key={i} className="group p-8 rounded-[40px] bg-white border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-indigo-100 transition-all duration-500 hover:-translate-y-2">
                   <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center text-white mb-8 shadow-lg shadow-rose-100 group-hover:scale-110 transition-transform duration-500`}>
                      {f.icon}
                   </div>
                   <h3 className="text-xl font-black text-slate-800 mb-4 tracking-tight">{f.title}</h3>
                   <p className="text-slate-500 font-medium text-sm leading-relaxed">{f.desc}</p>
                </div>
              ))}
           </div>
        </section>

        {/* Global Stats / Proof */}
        <section className="py-24 px-6">
           <div className="max-w-6xl mx-auto glass-card rounded-[50px] p-12 md:p-20 grid md:grid-cols-3 gap-12 text-center border-white/80">
              <div>
                 <div className="text-5xl font-black text-indigo-600 mb-2">10+</div>
                 <div className="text-sm font-black text-slate-400 uppercase tracking-widest">Partner Unis</div>
              </div>
              <div>
                 <div className="text-5xl font-black text-rose-500 mb-2">50k+</div>
                 <div className="text-sm font-black text-slate-400 uppercase tracking-widest">Active Pulses</div>
              </div>
              <div>
                 <div className="text-5xl font-black text-violet-600 mb-2">100%</div>
                 <div className="text-sm font-black text-slate-400 uppercase tracking-widest">Privacy Secured</div>
              </div>
           </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 text-white pt-24 pb-12 px-6">
         <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-4 gap-12 mb-20">
               <div className="col-span-1 md:col-span-2">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                      <Sparkles size={22} className="text-indigo-400" />
                    </div>
                    <span className="text-2xl font-black tracking-tighter">Sparkle</span>
                  </div>
                  <p className="text-slate-400 font-medium text-lg max-w-md leading-relaxed">
                    Redefining campus connection through high-end engineering and design. Join the revolution today.
                  </p>
               </div>
               
               <div>
                  <h4 className="font-black text-sm uppercase tracking-widest text-slate-500 mb-6">Explore</h4>
                  <ul className="space-y-4 font-bold text-slate-400">
                     <li><Link to="/marketplace" className="hover:text-white transition-colors">Marketplace</Link></li>
                     <li><Link to="/clubs" className="hover:text-white transition-colors">Clubs</Link></li>
                     <li><Link to="/moments" className="hover:text-white transition-colors">Moments</Link></li>
                  </ul>
               </div>

               <div>
                  <h4 className="font-black text-sm uppercase tracking-widest text-slate-500 mb-6">Legal</h4>
                  <ul className="space-y-4 font-bold text-slate-400">
                     <li><Link to="/legal" className="hover:text-white transition-colors">Privacy Policy</Link></li>
                     <li><Link to="/legal" className="hover:text-white transition-colors">Terms of Use</Link></li>
                     <li><Link to="/support" className="hover:text-white transition-colors">Security</Link></li>
                  </ul>
               </div>
            </div>

            <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
               <p className="text-slate-500 font-bold text-sm">© 2026 Sparkle Platform. All rights reserved.</p>
               <div className="flex gap-6">
                  <Globe size={20} className="text-slate-600 hover:text-white transition-colors cursor-pointer" />
                  <Shield size={20} className="text-slate-600 hover:text-white transition-colors cursor-pointer" />
               </div>
            </div>
         </div>
      </footer>
    </div>
  );
}

// ─── Splash Loader Component ─────────────────────────────────────

function SplashLoader({ fadeOut }: { fadeOut: boolean }) {
  return (
    <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden transition-all duration-700 ${fadeOut ? 'bg-indigo-50 opacity-100' : ''}`} style={{
      background: fadeOut ? '#eff6ff' : 'linear-gradient(135deg, #FF3D6D 0%, #F54791 25%, #FF6B8B 50%, #FF3D6D 75%, #F54791 100%)',
      backgroundSize: '400% 400%',
      animation: 'gradientShift 12s ease infinite'
    }}>
      <style>{`
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes logoPulse { 0%, 100% { transform: scale(1); filter: brightness(1) drop-shadow(0 0 0px #fff); } 50% { transform: scale(1.1); filter: brightness(1.2) drop-shadow(0 0 30px rgba(255,255,255,0.4)); } }
        @keyframes rotateRing { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes textReveal { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes bounceSlow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-15px); } }
        .logo-ring { position: relative; width: 140px; height: 140px; }
        .ring-svg { animation: rotateRing 4s linear infinite; }
        .sparkle-content { position: absolute; inset: 0; display: flex; items-center justify-center; font-size: 6rem; font-weight: 900; color: white; animation: logoPulse 3s ease-in-out infinite; }
      `}</style>
      
      <div className={`flex flex-col items-center justify-center transition-all duration-500 ${fadeOut ? 'opacity-0 -translate-y-10' : 'opacity-100'}`}>
        <div className="logo-ring mb-8">
           <svg className="ring-svg w-full h-full" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="white" strokeWidth="0.5" strokeDasharray="1 10" />
              <circle cx="50" cy="50" r="48" fill="none" stroke="white" strokeWidth="0.2" opacity="0.3" />
           </svg>
           <div className="sparkle-content leading-none">✦</div>
        </div>

        <h1 className="text-4xl font-black text-white tracking-tighter mb-12 animate-fade-in" style={{ animationDelay: '0.5s' }}>Sparkle</h1>

        <div className="flex gap-4">
           {[0, 1, 2, 3].map(i => (
             <div key={i} className="w-4 h-4 rounded-full bg-white/90 shadow-xl shadow-white/30" 
                  style={{ animation: 'bounceSlow 1.4s infinite ease-in-out', animationDelay: `${i * 0.15}s` }} />
           ))}
        </div>
      </div>
    </div>
  );
}
