import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, Eye, Video, ArrowLeft, Radio, Circle, 
  Sparkles, ShieldAlert, Award 
} from 'lucide-react';
import { useUserStore } from '../store/userStore';
import LockedLivePage from './LockedLivePage';
import Spinner from '../components/ui/Spinner';

export default function Streams() {
  const navigate = useNavigate();
  const followers = useUserStore(state => state.user?.followers_count ?? 0);
  const [loading, setLoading] = useState(true);

  // Mock streams with real image references for high fidelity
  const mockStreams = [
    {
      id: 1,
      title: 'Late Night Study Session 📚',
      streamer_name: 'Tech_Ninja',
      viewer_count: 342,
      category: 'Study',
      thumbnail_url: 'https://images.unsplash.com/photo-1541339907198-e08756ebafe3?w=800',
      avatar_url: '/uploads/avatars/default.png'
    },
    {
      id: 2,
      title: 'Sparkle DJ Set LIVE 🎧',
      streamer_name: 'DJ_Sparkle',
      viewer_count: 1205,
      category: 'Music',
      thumbnail_url: 'https://images.unsplash.com/photo-1516280440502-a2fe018c6426?w=800',
      avatar_url: '/uploads/avatars/default.png'
    },
    {
      id: 3,
      title: 'Hackathon Prep & Coding',
      streamer_name: 'DevSquad',
      viewer_count: 89,
      category: 'Tech',
      thumbnail_url: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800',
      avatar_url: '/uploads/avatars/default.png'
    }
  ];

  useEffect(() => {
    // Simulate loading for the premium transition feel
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // Background particles ambiance
  const particles = Array.from({ length: 15 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 4 + 2,
    duration: Math.random() * 6 + 6,
    delay: Math.random() * 3
  }));

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#090514] via-[#0e0720] to-[#04020a] flex flex-col items-center justify-center text-white">
        <Spinner size="large" color="text-primary" />
        <p className="text-[10px] font-black uppercase tracking-widest text-[#ff4db8] mt-4 animate-pulse">
          Tuning frequencies...
        </p>
      </div>
    );
  }

  // Render locked view if user does not meet the 1000 follower requirement
  if (followers < 1000) {
    return <LockedLivePage />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#090514] via-[#0e0720] to-[#04020a] text-white overflow-hidden relative pb-24 font-sans selection:bg-[#ff008a]/20">
      
      {/* Background Ambient Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[350px] h-[350px] rounded-full bg-[#ff008a] opacity-15 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[400px] h-[400px] rounded-full bg-[#ff4db8] opacity-10 blur-[130px] pointer-events-none" />

      {/* Floating Particles */}
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-[#ff008a] opacity-35 pointer-events-none"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
          }}
          animate={{
            y: [0, -120],
            opacity: [0, 0.5, 0],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            delay: p.delay,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#090514]/80 backdrop-blur-md border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/dashboard')} 
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 hover:scale-[1.03] active:scale-95 transition-all"
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
          </button>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight" style={{ fontFamily: 'Outfit' }}>
              Live <span className="bg-gradient-to-r from-[#ff008a] via-[#ff4db8] to-[#ff66c4] bg-clip-text text-transparent">Streams</span>
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1 text-[10px] font-black text-[#ff4db8] uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff008a] animate-pulse" />
                On Air
              </span>
              <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-[9px] font-bold text-white/50">
                128 live now
              </span>
            </div>
          </div>
        </div>

        <button 
          onClick={() => alert('Starting Stream Broadcaster Console...')}
          className="bg-gradient-to-r from-[#ff008a] to-[#ff4db8] hover:from-[#ff4db8] hover:to-[#ff66c4] text-white px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-[#ff008a]/20 hover:shadow-[#ff008a]/40 hover:scale-[1.02] active:scale-95 transition-all"
        >
          <Video size={14} />
          <span>Go Live</span>
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-8 space-y-6 relative z-10">
        
        {/* Sparkle Live Welcome Hero Banner for Creators */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-[#ff008a]/10 to-[#ff4db8]/5 border border-white/10 rounded-[24px] p-6 flex items-center justify-between gap-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#ff4db8]">
              <Radio size={22} className="animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                Creator Console Unlocked
                <Award size={14} className="text-amber-400" />
              </h4>
              <p className="text-xs text-white/40 mt-1">
                You've successfully reached the 1,000 follower milestone! Share your live broadcast with the community now.
              </p>
            </div>
          </div>
        </motion.div>

        {mockStreams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mockStreams.map(stream => (
              <motion.div 
                key={stream.id} 
                whileHover={{ y: -4 }}
                className="bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-[24px] overflow-hidden flex flex-col hover:border-[#ff008a]/20 transition-all duration-300 cursor-pointer"
                onClick={() => alert(`Connecting to ${stream.streamer_name}'s live channel...`)}
              >
                
                {/* Thumbnail Area */}
                <div className="relative h-48 overflow-hidden bg-slate-900 group">
                  <img src={stream.thumbnail_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={stream.title} />
                  
                  {/* Floating Tags */}
                  <div className="absolute top-3 left-3 bg-[#ff008a] text-white px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase shadow-md flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    LIVE
                  </div>
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded text-[9px] font-bold tracking-wider flex items-center gap-1">
                    <Eye size={10} className="text-[#ff4db8]" /> 
                    {stream.viewer_count.toLocaleString()}
                  </div>
                  
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-80" />
                </div>

                {/* Content Area */}
                <div className="p-5 flex-1 flex flex-col pt-0 transform -translate-y-5">
                  <div className="flex items-end gap-3 mb-4">
                    <img src={stream.avatar_url} className="w-12 h-12 rounded-xl border-4 border-[#120b22] shadow-lg object-cover bg-white" alt="streamer" />
                    <div className="pb-1 min-w-0 flex-1">
                      <h3 className="font-bold text-white text-sm leading-tight truncate">{stream.title}</h3>
                      <div className="text-[10px] font-bold text-white/40 uppercase tracking-tight mt-0.5">@{stream.streamer_name}</div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-white/5 flex items-center justify-between">
                    <div className="text-[9px] font-black text-[#ff4db8] bg-[#ff008a]/10 border border-[#ff008a]/20 px-2 py-0.5 rounded uppercase tracking-wider">
                      {stream.category}
                    </div>
                    <div className="text-[9px] font-bold text-white/40 uppercase flex items-center gap-1">
                      Tune In <Video size={10} className="text-[#ff4db8]" />
                    </div>
                  </div>
                </div>

              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-white/[0.01] border border-white/5 border-dashed rounded-3xl">
             <Radio size={48} className="text-white/20 mb-4 animate-pulse" />
             <h4 className="text-lg font-bold text-white mb-1">No active streams</h4>
             <p className="text-white/45 text-xs max-w-sm leading-relaxed">
               No one is broadcasting right now. Be the first to start a stream and share your campus moments!
             </p>
          </div>
        )}
      </div>

    </div>
  );
}
