import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Sparkles, Compass, UserPlus, PenSquare, MessageCircle, Shield, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function Onboarding() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#fdf2f4] text-black font-sans overflow-x-hidden">
      <Navbar />
      
      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="max-w-4xl mx-auto px-6 pt-32 md:pt-48 pb-56 relative z-10">
        
        {/* Header / About */}
        <div className="mb-24 text-center animate-fade-in relative">
          <div className="w-24 h-24 bg-primary text-white rounded-[32px] mx-auto flex items-center justify-center mb-10 shadow-2xl shadow-primary/30 transform group hover:rotate-12 transition-transform duration-700">
            <Sparkles size={48} strokeWidth={2.5} />
          </div>
          <h1 className="text-6xl md:text-8xl font-black text-black tracking-tighter leading-none mb-8 italic uppercase">
            Village <span className="text-primary">Genesis</span>
          </h1>
          <p className="text-xl font-bold text-black opacity-60 leading-relaxed max-w-2xl mx-auto italic">
            Sparkle is the campus network for discovered frequencies. Connect with neighbors, share signals, and amplify the village harmonics.
          </p>
        </div>

        <div className="space-y-12 animate-fade-in delay-200">
          
          {/* What You Can Do */}
          <section className="bg-white/80 backdrop-blur-3xl rounded-[56px] p-12 md:p-20 shadow-2xl shadow-primary/5 border border-white">
            <div className="flex items-center gap-6 mb-16 px-4">
              <div className="w-16 h-16 rounded-[28px] bg-primary/5 text-primary flex items-center justify-center border border-primary/10">
                <Compass size={32} strokeWidth={3} className="animate-spin-slow" />
              </div>
              <div>
                 <h2 className="text-4xl font-black text-black tracking-tighter uppercase italic leading-none">Your Orbit</h2>
                 <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] mt-2 italic">Standard operational procedures.</p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-12 lg:gap-20">
              <div className="space-y-6 group">
                <div className="w-14 h-14 rounded-2xl bg-black/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-sm border border-black/5">
                   <Compass size={28} strokeWidth={4} />
                </div>
                <h3 className="text-2xl font-black text-black uppercase tracking-tighter italic leading-none">Scan Signals</h3>
                <p className="text-[15px] font-bold text-black opacity-60 leading-relaxed italic">Browse high-frequency topics and discover what neighbors are broadcasting.</p>
              </div>
              <div className="space-y-6 group">
                <div className="w-14 h-14 rounded-2xl bg-black/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-sm border border-black/5">
                   <UserPlus size={28} strokeWidth={4} />
                </div>
                <h3 className="text-2xl font-black text-black uppercase tracking-tighter italic leading-none">Sync Nodes</h3>
                <p className="text-[15px] font-bold text-black opacity-60 leading-relaxed italic">Synchronize with creators and influencers to stay updated with fresh pulses.</p>
              </div>
              <div className="space-y-6 group">
                <div className="w-14 h-14 rounded-2xl bg-black/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-sm border border-black/5">
                   <PenSquare size={28} strokeWidth={4} />
                </div>
                <h3 className="text-2xl font-black text-black uppercase tracking-tighter italic leading-none">Broadcast Sparks</h3>
                <p className="text-[15px] font-bold text-black opacity-60 leading-relaxed italic">Post your frequencies, bold visions, or visual chronicles to engage with the village.</p>
              </div>
              <div className="space-y-6 group">
                <div className="w-14 h-14 rounded-2xl bg-black/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all duration-500 shadow-sm border border-black/5">
                   <MessageCircle size={28} strokeWidth={4} />
                </div>
                <h3 className="text-2xl font-black text-black uppercase tracking-tighter italic leading-none">High Fidelity</h3>
                <p className="text-[15px] font-bold text-black opacity-60 leading-relaxed italic">Like, comment, and echo sparks to solidify active village conversations.</p>
              </div>
            </div>
          </section>

          {/* How Your Feed Works */}
          <section className="bg-white/80 backdrop-blur-3xl rounded-[56px] p-12 md:p-16 shadow-2xl shadow-primary/5 border border-white">
            <div className="flex items-center gap-6 mb-12 px-4">
              <div className="w-16 h-16 rounded-[28px] bg-primary text-white flex items-center justify-center shadow-2xl shadow-primary/30">
                <Sparkles size={32} strokeWidth={3} />
              </div>
              <div>
                 <h2 className="text-4xl font-black text-black tracking-tighter uppercase italic leading-none">Algorithm Sync</h2>
                 <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] mt-2 italic">Your personalized village stream.</p>
              </div>
            </div>
            
            <p className="text-lg font-bold text-black opacity-60 leading-relaxed mb-10 px-4 italic">Your personalized feed is strictly curated based on your unique coordinates:</p>
            
            <div className="bg-black/5 rounded-[40px] p-10 mb-8 space-y-6">
              {[
                "Who you synchronize with",
                "Frequencies you echo",
                "Trending sparks in your sector"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-6 group">
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-lg border border-primary/20 text-primary">
                    <CheckCircle2 size={18} strokeWidth={4} />
                  </div>
                  <span className="text-xl font-black text-black uppercase tracking-tighter italic opacity-40 group-hover:opacity-100 group-hover:translate-x-2 transition-all">{item}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] font-black text-primary uppercase tracking-[0.4em] italic px-8">Increased engagement improves signal clarity.</p>
          </section>

          {/* Privacy & Safety */}
          <section className="bg-black text-white rounded-[56px] p-12 md:p-16 shadow-2xl shadow-primary/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 blur-[100px] pointer-events-none"></div>
            <div className="flex items-center gap-6 mb-12 relative z-10">
              <div className="w-16 h-16 rounded-[28px] bg-white text-black flex items-center justify-center">
                <Shield size={32} strokeWidth={3} />
              </div>
              <div>
                 <h2 className="text-4xl font-black text-white tracking-tighter uppercase italic leading-none">Encrypted</h2>
                 <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.4em] mt-2 italic">Safety and protocol enforcement.</p>
              </div>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-12 relative z-10">
               <div className="space-y-4">
                  <h4 className="font-black text-primary text-xl uppercase tracking-tighter italic">Total Ownership</h4>
                  <p className="text-base font-bold text-white/40 italic">Manage exactly what signals you propagate and who receives them.</p>
               </div>
               <div className="space-y-4">
                  <h4 className="font-black text-primary text-xl uppercase tracking-tighter italic">Active Sentry</h4>
                  <p className="text-base font-bold text-white/40 italic">Suspicious harmonics are proactively filtered to protect your node 24/7.</p>
               </div>
            </div>
          </section>

          {/* Final Call */}
          <section className="text-center py-20 animate-fade-in delay-500">
             <h2 className="text-5xl md:text-7xl font-black text-black tracking-tighter uppercase italic leading-none mb-12">
                Ready for <span className="text-primary italic">Lift-off?</span>
             </h2>

             <div className="flex flex-col sm:flex-row gap-8 justify-center items-center mb-16">
                 {[
                   { n: "1", t: "Sync Nodes" },
                   { n: "2", t: "Scan Trends" },
                   { n: "3", t: "Broadcast" }
                 ].map((step, i) => (
                    <div key={i} className="flex flex-col items-center gap-4 group">
                       <div className="text-5xl font-black text-black/5 group-hover:text-primary/20 transition-colors leading-none italic">{step.n}</div>
                       <div className="text-[10px] font-black text-black uppercase tracking-[0.4em] italic leading-none">{step.t}</div>
                    </div>
                 ))}
             </div>
             
             <button 
              onClick={() => navigate('/dashboard')}
              className="px-16 py-8 bg-primary text-white text-xl font-black rounded-[32px] shadow-2xl shadow-primary/40 hover:scale-[1.05] hover:shadow-primary/60 transition-all active:scale-95 flex items-center justify-center gap-6 mx-auto uppercase tracking-[0.2em] italic"
            >
              Initialize Orbit <ChevronRight size={32} strokeWidth={4} />
            </button>
          </section>

        </div>
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .delay-200 { animation-delay: 0.2s; }
        .delay-500 { animation-delay: 0.5s; }
        .animate-spin-slow { animation: spin 15s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
