import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Copy, Check, MessageCircle, Mail, Send, Smartphone, Sparkles, Orbit, ChevronRight } from 'lucide-react';
import Navbar from '../components/Navbar';

export default function Invite() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const inviteLink = "https://sparkle.app/join/ref=village_node";
  const inviteMessage = `Join the village frequency on Sparkle — fast, high-fidelity, and saves data. Sync here: ${inviteLink}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Synchronize with Sparkle',
          text: inviteMessage,
          url: inviteLink,
        });
      } catch (err) {
        console.error('Transmission failed:', err);
      }
    } else {
      copyToClipboard();
    }
  };

  const shareOptions = [
    { name: 'WhatsApp', icon: MessageCircle, color: '#25D366', action: () => window.open(`https://wa.me/?text=${encodeURIComponent(inviteMessage)}`) },
    { name: 'Telegram', icon: Send, color: '#0088cc', action: () => window.open(`https://t.me/share/url?url=${inviteLink}&text=${encodeURIComponent(inviteMessage)}`) },
    { name: 'Messenger', icon: MessageCircle, color: '#0084FF', action: () => window.open(`fb-messenger://share/?link=${encodeURIComponent(inviteLink)}`) },
    { name: 'Email', icon: Mail, color: '#EA4335', action: () => window.open(`mailto:?subject=Join the village on Sparkle&body=${encodeURIComponent(inviteMessage)}`) }
  ];

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black font-sans overflow-x-hidden">
      <Navbar />

      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-4xl mx-auto w-full pt-16 md:pt-12">
        {/* Header */}
        <header className="mb-24 animate-fade-in px-4">
           <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12">
              <div className="max-w-3xl space-y-8">
                 <div className="inline-flex items-center gap-4 px-6 py-2.5 rounded-full bg-white/80 border border-white backdrop-blur-3xl shadow-xl shadow-primary/5">
                    <Share2 size={18} strokeWidth={3} className="text-primary" />
                    <span className="text-[10px] font-black text-black uppercase tracking-[0.4em] italic">Amplify Signal</span>
                 </div>
                 <h1 className="text-5xl md:text-9xl font-black text-black tracking-tighter leading-none italic uppercase">
                    Invite <span className="text-primary">Neighbors</span>
                 </h1>
                  <p className="text-xl font-bold text-black opacity-60 leading-relaxed italic max-w-2xl">
                    Grow your village orbit. Everything is better when the frequency is shared.
                  </p>
              </div>
              
              <button 
                onClick={() => navigate(-1)}
                className="w-16 h-16 rounded-[24px] bg-white border border-white shadow-2xl flex items-center justify-center text-black hover:scale-110 active:scale-95 transition-all"
              >
                <ArrowLeft size={28} strokeWidth={4} />
              </button>
           </div>
        </header>

        <div className="space-y-16 animate-fade-in">
          {/* Hero Card */}
          <section className="bg-black text-white rounded-[56px] p-16 shadow-2xl shadow-primary/20 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 blur-[100px] pointer-events-none transition-opacity group-hover:opacity-100 opacity-60"></div>
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-12 text-center md:text-left">
              <div className="w-24 h-24 rounded-[32px] bg-white text-black flex items-center justify-center shadow-2xl transform group-hover:rotate-12 transition-transform duration-700">
                <Sparkles size={40} strokeWidth={3} className="text-primary" />
              </div>
              <div className="flex-1 space-y-4">
                <h2 className="text-4xl font-black italic tracking-tighter uppercase leading-none">Shared Harmonics</h2>
                <p className="text-lg font-bold text-white/50 italic max-w-md">Sparkle is fast, high-fidelity, and optimized for campus networks. Sync your circle today!</p>
              </div>
            </div>
          </section>

          {/* Link Section */}
          <section className="bg-white/80 backdrop-blur-3xl rounded-[48px] p-10 md:p-12 shadow-2xl shadow-primary/5 border border-white">
             <h3 className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] ml-8 mb-8 italic">Transmission ID</h3>
             <div className="flex flex-col md:flex-row gap-6">
                <div className="flex-1 bg-black/5 rounded-[28px] h-20 px-10 flex items-center shadow-inner border border-black/5">
                   <span className="text-lg font-black text-black opacity-40 italic truncate">{inviteLink}</span>
                </div>
                <button 
                  onClick={copyToClipboard} 
                  className={`px-12 h-20 rounded-[28px] font-black text-sm uppercase tracking-[0.2em] italic flex items-center justify-center gap-4 transition-all duration-500 shadow-2xl ${copied ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-primary text-white shadow-primary/30 hover:scale-105 active:scale-95'}`}
                >
                  {copied ? <Check size={24} strokeWidth={4} /> : <Copy size={24} strokeWidth={4} />}
                  <span>{copied ? 'Synced' : 'Clone'}</span>
                </button>
             </div>
          </section>

          {/* Share Grid */}
          <section>
             <h3 className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] ml-8 mb-10 italic">Broadcast Channels</h3>
             <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
                {shareOptions.map(option => (
                  <button key={option.name} className="flex flex-col items-center gap-6 p-8 bg-white/60 backdrop-blur-3xl border border-white rounded-[40px] shadow-xl shadow-primary/5 group hover:scale-[1.05] transition-all duration-500 hover:shadow-primary/10 active:scale-95" onClick={option.action}>
                    <div className="w-16 h-16 rounded-[22px] flex items-center justify-center shadow-xl transition-all duration-500 group-hover:rotate-6 text-white" style={{ backgroundColor: option.color }}>
                      <option.icon size={28} strokeWidth={3} />
                    </div>
                    <span className="text-[10px] font-black text-black/40 uppercase tracking-[0.2em] italic group-hover:text-black transition-colors">{option.name}</span>
                  </button>
                ))}
                <button className="flex flex-col items-center gap-6 p-8 bg-black text-white rounded-[40px] shadow-2xl shadow-black/10 group hover:scale-[1.05] transition-all duration-500 active:scale-95" onClick={handleNativeShare}>
                  <div className="w-16 h-16 rounded-[22px] bg-white/10 flex items-center justify-center shadow-inner group-hover:rotate-6 transition-transform">
                    <Smartphone size={28} strokeWidth={3} className="text-primary" />
                  </div>
                  <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] italic group-hover:text-white transition-colors">Aura</span>
                </button>
             </div>
          </section>

          {/* Rewards */}
          <section className="bg-white/80 backdrop-blur-3xl rounded-[56px] p-12 md:p-16 border border-white shadow-2xl shadow-primary/5">
             <div className="flex items-center gap-6 mb-12">
                <div className="w-14 h-14 bg-primary/5 rounded-[22px] flex items-center justify-center text-primary animate-pulse">
                   <Sparkles size={28} strokeWidth={3} />
                </div>
                <h3 className="text-4xl font-black text-black uppercase tracking-tighter italic">Grow & Earn</h3>
             </div>
             
             <div className="space-y-8 px-4">
                {[
                  "Propagate link to 5 neighbors",
                  "Wait for node synchronization",
                  "Unlock Sparkle Plus for 30 cycles"
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-8 group">
                    <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center font-black italic shadow-xl group-hover:bg-primary transition-all">
                       {i + 1}
                    </div>
                    <span className="text-xl font-black text-black opacity-30 group-hover:opacity-100 group-hover:translate-x-3 transition-all italic uppercase tracking-tighter">{step}</span>
                  </div>
                ))}
             </div>
             
             <div className="mt-16 w-full py-8 bg-black/5 rounded-[32px] flex items-center justify-center gap-6 group cursor-pointer hover:bg-black hover:text-white transition-all duration-700">
                <Orbit size={24} strokeWidth={4} className="text-primary animate-spin-slow" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] italic">Check Status Board</span>
                <ChevronRight size={20} strokeWidth={4} className="group-hover:translate-x-3 transition-transform" />
             </div>
          </section>
        </div>
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-spin-slow { animation: spin 15s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
