import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlayCircle, 
  PlusCircle, 
  ShoppingBag, 
  Users, 
  BarChart3, 
  Calendar, 
  Settings, 
  LogOut,
  Menu,
  Sparkles,
  Ghost,
  Send,
  LayoutDashboard,
  Orbit,
  ShieldCheck,
  Zap
} from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useModalStore } from '../store/modalStore';
import { getAvatarUrl } from '../utils/imageUtils';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Sidebar() {
  const { user, logout } = useUserStore();
  const { setActiveModal } = useModalStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeHub, setActiveHub] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  const toggleHub = (hubName: string) => {
    setActiveHub(activeHub === hubName ? null : hubName);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <motion.div 
      initial={false}
      animate={{ width: isHovered ? 300 : 96 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setActiveHub(null);
      }}
      className={cn(
        "fixed left-0 top-0 h-screen bg-white/80 backdrop-blur-3xl border-r border-white flex flex-col pt-12 pb-12 z-[1000] overflow-hidden transition-all shadow-[60px_0_120px_rgba(225,29,72,0.02)]",
      )}
    >
      {/* Background Decor Element (Only visible when hovered) */}
      <AnimatePresence>
        {isHovered && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-[-50px] right-[-50px] pointer-events-none opacity-[0.03] text-primary"
          >
             <Orbit size={300} strokeWidth={1} className="animate-spin-slow" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logo Section */}
      <div className="flex items-center px-8 mb-16 h-16 relative z-10">
        <div 
          className="flex items-center gap-6 cursor-pointer transition-all active:scale-95 whitespace-nowrap overflow-hidden group"
          onClick={() => navigate('/dashboard')}
        >
          <div className="shrink-0 w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center shadow-lg group-hover:bg-primary transition-all duration-500">
            <Sparkles size={24} strokeWidth={2.5} />
          </div>
          <AnimatePresence>
            {isHovered && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex flex-col ml-1"
                >
                  <span className="font-black text-3xl tracking-tighter text-black italic uppercase leading-none">
                    Sparkle<span className="text-primary italic">.</span>
                  </span>
                  <span className="text-[8px] font-black text-black opacity-20 uppercase tracking-[0.5em] mt-1 italic">Village Core v3</span>
                </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <nav className="flex flex-col gap-3 flex-1 px-5 relative z-10">
        {[
          { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
          { name: 'Connect', icon: Users, path: '/connect' },
          { name: 'Moments', icon: PlayCircle, path: '/moments' },
          { name: 'The Vault', icon: Ghost, path: '/confessions' },
          { name: 'Transmissions', icon: Send, path: '/messages' },
          { name: 'Marketplace', icon: ShoppingBag, path: '/marketplace' },
          { name: 'Profile', icon: null, path: `/profile/${user?.username}`, isProfile: true },
        ].map((item) => (
          <div key={item.name} className="flex flex-col">
            <Link to={item.path} className={cn(
              "flex items-center gap-5 p-4.5 rounded-[24px] transition-all duration-500 whitespace-nowrap overflow-hidden group/item relative",
              isActive(item.path) ? "bg-white shadow-2xl shadow-primary/15 text-primary border border-primary/10" : "text-black/40 hover:bg-white hover:text-black hover:shadow-xl"
            )}>
              {isActive(item.path) && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-primary rounded-r-full shadow-2xl shadow-primary"></div>
              )}
              <div className="shrink-0 w-8 h-8 flex items-center justify-center transition-transform group-hover/item:scale-125 group-hover/item:rotate-6">
                {item.isProfile ? (
                  <img 
                    src={getAvatarUrl(user?.avatar_url, user?.username)} 
                    className={cn("w-9 h-9 rounded-full object-cover border-2 transition-all duration-700", isActive(item.path) ? "border-primary/20" : "border-transparent group-hover/item:border-gray-100")}
                    alt="Profile"
                  />
                ) : (
                  <item.icon size={26} strokeWidth={isActive(item.path) ? 4 : 3} />
                )}
              </div>
              {isHovered && (
                <span className={cn(
                  "font-black text-[13px] uppercase tracking-[0.1em] italic transition-all duration-500", 
                  isActive(item.path) ? "text-primary translate-x-1" : "text-black"
                )}>
                  {item.name}
                </span>
              )}
            </Link>
          </div>
        ))}

        {/* Global Action Button */}
        <div className="px-1 my-8">
             <button 
                className={cn(
                  "w-full h-18 bg-primary text-white rounded-[26px] flex items-center shadow-2xl shadow-primary/40 transition-all duration-700 hover:scale-[1.03] hover:shadow-primary/60 active:scale-95 group/create relative overflow-hidden italic uppercase font-black",
                  isHovered ? "px-6 justify-start gap-6" : "justify-center"
                )}
                onClick={() => setActiveModal('creation_hub')}
            >
                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 translate-x-[-100%] group-hover/create:translate-x-[100%] transition-transform duration-1000" />
                <PlusCircle size={28} strokeWidth={4} className="group-hover/create:rotate-90 transition-transform duration-500 shrink-0" />
                {isHovered && <span className="text-sm tracking-[0.2em] whitespace-nowrap">Sync Signal</span>}
            </button>
        </div>

        {/* System Monitoring / Activity Hints */}
        {isHovered && (
          <div className="mt-4 px-6 border-l-4 border-black/5 flex flex-col gap-4 animate-fade-in">
             <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-black/20 italic leading-none">Council Health</span>
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-2xl shadow-emerald-500"></div>
             </div>
             <div className="h-1 bg-black/5 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 w-[94%] shadow-2xl shadow-emerald-500/50"></div>
             </div>
          </div>
        )}

        {/* Secondary Hub */}
        <div className="mt-auto flex flex-col relative py-4">
          <div 
            className={cn(
              "flex items-center gap-5 p-4.5 rounded-[24px] transition-all duration-700 whitespace-nowrap cursor-pointer group/item mx-1 relative",
              activeHub === 'more' ? "bg-white shadow-2xl text-primary border border-black/5 scale-[1.05]" : "text-black/40 hover:bg-white hover:text-black"
            )}
            onClick={() => toggleHub('more')}
          >
            <div className="shrink-0 w-8 h-8 flex items-center justify-center transition-transform group-hover/item:scale-125">
              <Menu size={28} strokeWidth={activeHub === 'more' ? 4 : 3} />
            </div>
            {isHovered && <span className="font-black text-[13px] uppercase tracking-[0.1em] italic">Protocols</span>}
          </div>
          
          <AnimatePresence>
            {activeHub === 'more' && isHovered && (
                <motion.div 
                    initial={{ opacity: 0, x: 20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 10, scale: 0.95 }}
                    className="absolute bottom-20 left-2 w-72 bg-white/95 backdrop-blur-3xl border border-white rounded-[40px] p-4 shadow-2xl shadow-black/10 flex flex-col gap-1 z-[1001]"
                >
                <div className="px-5 pt-3 pb-5 mb-3 border-b border-black/5">
                   <span className="text-[10px] font-black text-black/20 uppercase tracking-[0.5em] italic">Satellite Nodes</span>
                </div>
                {[
                    { name: 'Collective Groups', icon: Users, path: '/groups' },
                    { name: 'Campus Consensus', icon: BarChart3, path: '/polls' },
                    { name: 'Village Events', icon: Calendar, path: '/events' },
                    { name: 'System Override', icon: Settings, path: '/settings' },
                    { name: 'Professional Hub', icon: Zap, path: '/professional-dashboard' },
                    ...(user?.role?.includes('admin') ? [{ name: 'Council Central', icon: ShieldCheck, path: '/admin' }] : []),
                ].map(item => (
                    <Link key={item.name} to={item.path} className="flex items-center gap-4 p-4 rounded-[22px] text-[13px] font-black text-black opacity-40 hover:opacity-100 hover:text-primary hover:bg-primary/5 transition-all italic uppercase tracking-tighter">
                        <item.icon size={22} strokeWidth={3} />
                        <span>{item.name}</span>
                    </Link>
                ))}
                <div className="h-2 bg-black/5 my-4 mx-6 rounded-full" />
                <button 
                    onClick={() => { logout(); navigate('/login'); }} 
                    className="flex items-center gap-4 p-5 rounded-[22px] text-[13px] font-black text-red-500 hover:bg-red-500 hover:text-white transition-all text-left italic uppercase tracking-widest shadow-sm hover:shadow-red-500/20"
                >
                    <LogOut size={22} strokeWidth={4} />
                    <span>Terminate</span>
                </button>
                </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* User Info Bar at bottom - only visible if hovered */}
      <AnimatePresence>
        {isHovered && (
          <motion.div 
             initial={{ opacity: 0, y: 10 }}
             animate={{ opacity: 1, y: 0 }}
             exit={{ opacity: 0, y: 10 }}
             className="px-8 mt-4 pt-8 border-t border-black/5 overflow-hidden"
          >
             <div className="flex items-center gap-5">
                <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center font-black italic shadow-2xl relative group/avatar">
                   {user?.username?.charAt(0).toUpperCase()}
                   <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-4 border-white"></div>
                </div>
                <div className="flex flex-col min-w-0">
                   <span className="font-black text-black text-sm uppercase tracking-tighter truncate italic">@{user?.username}</span>
                   <span className="text-[10px] font-black text-black/20 uppercase tracking-widest mt-1 italic">Authenticated</span>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .animate-spin-slow { animation: spin 40s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.8s ease-out forwards; }
      `}</style>
    </motion.div>
  );
}
