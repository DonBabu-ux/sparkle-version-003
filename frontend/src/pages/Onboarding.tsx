import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { Sparkles, Compass, UserPlus, PenSquare, MessageCircle, Shield, Key, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function Onboarding() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Navbar />
      
      <main className="max-w-2xl mx-auto px-4 pt-32 md:pt-40 pb-56">
        
        {/* Header / About */}
        <div className="mb-12 text-center animate-fade-in relative">
          <div className="w-20 h-20 bg-gradient-to-br from-[#FF3D6D] to-[#FF7B00] rounded-3xl mx-auto flex items-center justify-center mb-6 shadow-2xl shadow-pink-200/50 transform rotate-3">
            <Sparkles size={40} className="text-white transform -rotate-3" />
          </div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-4">Welcome to Sparkle</h1>
          <p className="text-slate-500 text-[16px] leading-relaxed max-w-lg mx-auto font-medium">
            Sparkle is a social platform where you can discover trending ideas ("sparks"), connect with people, and share your own content. It’s designed to help you stay informed, express yourself, and engage with what matters to you.
          </p>
        </div>

        <div className="space-y-6 animate-slide-up">
          
          {/* What You Can Do */}
          <section className="bg-white rounded-[32px] p-8 shadow-xl shadow-slate-200/20 border border-slate-100/60">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                <Compass size={24} className="text-indigo-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">What You Can Do</h2>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-8">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-blue-50/80 flex items-center justify-center mb-3">
                  <Compass size={20} className="text-blue-500" />
                </div>
                <h3 className="font-bold text-slate-800 text-lg">Explore Sparks</h3>
                <p className="text-[14px] text-slate-500 leading-relaxed font-medium">Browse trending topics and discover what people are talking about worldwide.</p>
              </div>
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-purple-50/80 flex items-center justify-center mb-3">
                  <UserPlus size={20} className="text-purple-500" />
                </div>
                <h3 className="font-bold text-slate-800 text-lg">Follow Creators</h3>
                <p className="text-[14px] text-slate-500 leading-relaxed font-medium">Stay continually updated with fresh posts from people you find interesting.</p>
              </div>
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-rose-50/80 flex items-center justify-center mb-3">
                  <PenSquare size={20} className="text-rose-500" />
                </div>
                <h3 className="font-bold text-slate-800 text-lg">Share Sparks</h3>
                <p className="text-[14px] text-slate-500 leading-relaxed font-medium">Post your thoughts, bold ideas, or media content to engage with others.</p>
              </div>
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50/80 flex items-center justify-center mb-3">
                  <MessageCircle size={20} className="text-emerald-500" />
                </div>
                <h3 className="font-bold text-slate-800 text-lg">Engage deeply</h3>
                <p className="text-[14px] text-slate-500 leading-relaxed font-medium">Like, comment, vividly repost, and join the most active conversations.</p>
              </div>
            </div>
          </section>

          {/* How Your Feed Works */}
          <section className="bg-white rounded-[32px] p-8 shadow-xl shadow-slate-200/20 border border-slate-100/60">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                <Sparkles size={24} className="text-amber-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">How Your Feed Works</h2>
            </div>
            <p className="text-[15px] text-slate-500 leading-relaxed mb-6 font-medium">Your personalized feed is strictly curated based on:</p>
            
            <div className="bg-slate-50 rounded-2xl p-5 mb-4">
              <ul className="space-y-4">
                <li className="flex items-center gap-4 text-[15px] text-slate-700 font-bold">
                  <CheckCircle2 size={20} className="text-amber-500" /> Who you follow
                </li>
                <li className="flex items-center gap-4 text-[15px] text-slate-700 font-bold">
                  <CheckCircle2 size={20} className="text-amber-500" /> What you interact with
                </li>
                <li className="flex items-center gap-4 text-[15px] text-slate-700 font-bold">
                  <CheckCircle2 size={20} className="text-amber-500" /> Trending sparks in your area
                </li>
              </ul>
            </div>
            <p className="text-sm text-slate-400 font-bold italic">The more you engage, the better your feed becomes.</p>
          </section>

          {/* Privacy & Safety */}
          <section className="bg-white rounded-[32px] p-8 shadow-xl shadow-slate-200/20 border border-slate-100/60">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <Shield size={24} className="text-emerald-500" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Privacy & Safety</h2>
            </div>
            <ul className="space-y-4 mb-2">
              <li className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Shield size={14} className="text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-[15px]">You control your content</h4>
                  <p className="text-[14px] text-slate-500 font-medium">Manage exactly what you share and who gets to see it.</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <UserPlus size={14} className="text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-[15px]">Active monitoring</h4>
                  <p className="text-[14px] text-slate-500 font-medium">Suspicious activity is proactively monitored to protect your account 24/7.</p>
                </div>
              </li>
            </ul>
          </section>

          {/* Getting Started */}
          <section className="bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 rounded-[32px] p-8 shadow-2xl shadow-indigo-900/20 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            
            <h2 className="text-2xl font-black text-white tracking-tight mb-8 relative z-10">Ready to begin your journey?</h2>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8 relative z-10">
              <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl text-white font-bold text-sm flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-white text-indigo-900 flex items-center justify-center text-xs">1</span> 
                Follow 5 creators
              </div>
              <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl text-white font-bold text-sm flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-white text-indigo-900 flex items-center justify-center text-xs">2</span> 
                Explore trends
              </div>
              <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl text-white font-bold text-sm flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-white text-indigo-900 flex items-center justify-center text-xs">3</span> 
                Post your first spark
              </div>
            </div>
            
            <button 
              onClick={() => navigate('/explore')}
              className="w-full sm:w-auto px-10 py-4 bg-gradient-to-r from-[#FF3D6D] to-[#FF7B00] text-white text-lg font-black rounded-2xl hover:shadow-xl hover:shadow-pink-500/30 hover:-translate-y-1 transition-all flex items-center justify-center gap-3 mx-auto relative z-10"
            >
              Start Exploring <ChevronRight size={22} strokeWidth={3} />
            </button>
          </section>

        </div>
      </main>
    </div>
  );
}
