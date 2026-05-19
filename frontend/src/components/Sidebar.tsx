import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home,
  Search,
  Compass,
  PlayCircle,
  Heart,
  Menu,
  Sparkles,
  Send,
  Plus,
  LayoutGrid,
  Users,
  Vote,
  Calendar,
  ShoppingBag,
  Briefcase,
  Settings,
  HelpCircle,
  LogOut
} from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useModalStore } from '../store/modalStore';
import Avatar from './Avatar';
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
  const [isHovered, setIsHovered] = useState(false);
  const [showMenuPopup, setShowMenuPopup] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const NAV_ITEMS = [
    { name: 'Home', icon: Home, path: '/dashboard' },
    { name: 'Search', icon: Search, path: '/search', action: () => navigate('/search') },
    { name: 'Explore', icon: Compass, path: '/explore' },
    { name: 'Reels', icon: PlayCircle, path: '/moments' },
    { name: 'Messages', icon: Send, path: '/messages', badge: '1' },
    { name: 'Notifications', icon: Heart, path: '/notifications', badge: 'dot' },
    { name: 'Create', icon: Plus, path: '#', action: () => setActiveModal('creation_hub') },
    { name: 'Profile', icon: null, path: `/profile/${user?.username}`, isProfile: true },
  ];

  return (
    <motion.div 
      initial={false}
      animate={{ width: isHovered ? 240 : 72 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed left-0 top-0 h-screen bg-[#f8fafc] dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 border-r border-slate-200 dark:border-zinc-800 flex flex-col py-6 z-[1000] overflow-hidden transition-all duration-300 shadow-[2px_0_12px_rgba(0,0,0,0.03)]"
    >
      {/* Logo Section */}
      <div 
        className="flex items-center px-6 mb-8 cursor-pointer h-12"
        onClick={() => navigate('/dashboard')}
      >
        <div className="shrink-0 flex items-center justify-center transition-transform hover:scale-105 text-[#ff1493]">
          <Sparkles size={28} strokeWidth={2.5} />
        </div>
        <AnimatePresence>
          {isHovered && (
            <motion.div 
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="ml-4 overflow-hidden whitespace-nowrap"
            >
              <span className="font-heading text-xl font-bold tracking-wide text-slate-900 dark:text-white">Sparkle</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Main Nav Items */}
      <nav className="flex flex-col flex-1 px-3 gap-1">
        {NAV_ITEMS.map((item) => (
          <div key={item.name} className="flex flex-col">
            <Link 
              to={item.path !== '#' ? item.path : location.pathname} 
              className={cn(
                "flex items-center gap-4 p-3 rounded-lg transition-all duration-200 whitespace-nowrap group relative",
                item.name === 'Create'
                  ? "bg-gradient-to-r from-[#ff1493]/5 to-[#fb7185]/5 border border-[#ff1493]/20 hover:bg-[#ff1493]/10 hover:border-[#ff1493]/45 dark:from-[#ff1493]/10 dark:to-[#fb7185]/10 dark:border-[#ff1493]/30 dark:hover:bg-[#ff1493]/20 text-[#ff1493] dark:text-pink-400 font-bold"
                  : isActive(item.path) 
                    ? "bg-slate-200/70 dark:bg-white/10 text-[#ff1493] dark:text-white font-bold" 
                    : "hover:bg-slate-200/40 dark:hover:bg-white/5 text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
              )}
              onClick={(e) => {
                if (item.action) {
                  e.preventDefault();
                  item.action();
                  return;
                }
                if (item.path === '/dashboard' && isActive('/dashboard')) {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  window.dispatchEvent(new CustomEvent('refreshFeed'));
                }
              }}
            >
              <div className="shrink-0 w-6 h-6 flex items-center justify-center relative transition-transform group-hover:scale-105">
                {item.isProfile ? (
                  <Avatar 
                    src={user?.avatar_url} 
                    name={user?.username} 
                    size="sm"
                    className={cn("w-6 h-6 border", isActive(item.path) ? "border-[#ff1493] dark:border-white" : "border-transparent group-hover:border-slate-400 dark:group-hover:border-white/50")}
                  />
                ) : (
                  <item.icon 
                    size={24} 
                    strokeWidth={item.name === 'Create' ? 2.5 : (isActive(item.path) ? 2.5 : 2)} 
                    className={cn(
                      item.name === 'Create'
                        ? "text-[#ff1493]"
                        : isActive(item.path) 
                          ? "text-[#ff1493] dark:text-white" 
                          : "text-slate-500 group-hover:text-slate-800 dark:text-zinc-400 dark:group-hover:text-white"
                    )}
                  />
                )}

                {/* Badges */}
                {item.badge === 'dot' && (
                  <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-[#ff1493] rounded-full border border-white dark:border-zinc-950" />
                )}
                {item.badge && item.badge !== 'dot' && (
                  <span className="absolute -top-1 -right-1.5 bg-[#ff1493] text-white text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-white dark:border-zinc-950 scale-90">
                    {item.badge}
                  </span>
                )}
              </div>

              <AnimatePresence>
                {isHovered && (
                  <motion.span 
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="text-base overflow-hidden whitespace-nowrap"
                  >
                    {item.name}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </div>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="px-3 mt-auto flex flex-col gap-1 relative">
        {showMenuPopup && (
          <div 
            className="fixed inset-0 z-[1050] cursor-default" 
            onClick={() => setShowMenuPopup(false)} 
          />
        )}

        <AnimatePresence>
          {showMenuPopup && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 15, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute bottom-20 left-4 w-60 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-white/10 backdrop-blur-2xl rounded-2xl p-2 shadow-xl z-[1100] flex flex-col gap-0.5 text-slate-800 dark:text-zinc-100"
            >
              <Link 
                to="/groups" 
                onClick={() => setShowMenuPopup(false)}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-sm font-semibold"
              >
                <Users size={18} className="text-slate-500 dark:text-zinc-400" />
                <span>Campus Groups</span>
              </Link>
              <Link 
                to="/polls" 
                onClick={() => setShowMenuPopup(false)}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-sm font-semibold"
              >
                <Vote size={18} className="text-slate-500 dark:text-zinc-400" />
                <span>Campus Polls</span>
              </Link>
              <Link 
                to="/events" 
                onClick={() => setShowMenuPopup(false)}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-sm font-semibold"
              >
                <Calendar size={18} className="text-slate-500 dark:text-zinc-400" />
                <span>Upcoming Events</span>
              </Link>
              <Link 
                to="/clubs" 
                onClick={() => setShowMenuPopup(false)}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-sm font-semibold"
              >
                <Sparkles size={18} className="text-[#ff1493]" />
                <span>Campus Clubs</span>
              </Link>
              <Link 
                to="/marketplace" 
                onClick={() => setShowMenuPopup(false)}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-sm font-semibold"
              >
                <ShoppingBag size={18} className="text-slate-500 dark:text-zinc-400" />
                <span>Marketplace</span>
              </Link>
              <Link 
                to="/skill-market" 
                onClick={() => setShowMenuPopup(false)}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-sm font-semibold"
              >
                <Briefcase size={18} className="text-slate-500 dark:text-zinc-400" />
                <span>Skill Market</span>
              </Link>

              <div className="h-px bg-slate-100 dark:bg-white/10 my-1.5" />

              <Link 
                to="/settings" 
                onClick={() => setShowMenuPopup(false)}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-sm font-semibold"
              >
                <Settings size={18} className="text-slate-500 dark:text-zinc-400" />
                <span>App Settings</span>
              </Link>
              <Link 
                to="/support" 
                onClick={() => setShowMenuPopup(false)}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-sm font-semibold"
              >
                <HelpCircle size={18} className="text-slate-500 dark:text-zinc-400" />
                <span>Support & Help</span>
              </Link>

              <div className="h-px bg-slate-100 dark:bg-white/10 my-1.5" />

              <div 
                onClick={() => { setShowMenuPopup(false); logout(); navigate('/login'); }}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-red-500/10 text-red-500 hover:text-red-400 transition-colors text-sm font-semibold cursor-pointer"
              >
                <LogOut size={18} />
                <span>Log Out</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Link 
          to="/ecosystem"
          className={cn(
            "flex items-center gap-4 p-3 rounded-lg transition-all duration-200 group cursor-pointer",
            isActive('/ecosystem') 
              ? "bg-slate-200/70 dark:bg-white/10 text-[#ff1493] dark:text-white font-bold" 
              : "hover:bg-slate-200/40 dark:hover:bg-white/5 text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
          )}
        >
          <div className="shrink-0 w-6 h-6 flex items-center justify-center transition-transform group-hover:scale-105">
            <LayoutGrid 
              size={24} 
              strokeWidth={isActive('/ecosystem') ? 2.5 : 2} 
              className={cn(
                isActive('/ecosystem') 
                  ? "text-[#ff1493] dark:text-white" 
                  : "text-slate-500 group-hover:text-slate-800 dark:text-zinc-400 dark:group-hover:text-white"
              )}
            />
          </div>
          <AnimatePresence>
            {isHovered && (
              <motion.span 
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="text-base overflow-hidden whitespace-nowrap"
              >
                More
              </motion.span>
            )}
          </AnimatePresence>
        </Link>
        
        <div 
          onClick={() => setShowMenuPopup(!showMenuPopup)}
          className={cn(
            "flex items-center gap-4 p-3 rounded-lg transition-all duration-200 group cursor-pointer",
            showMenuPopup 
              ? "bg-slate-200/70 dark:bg-white/10 text-[#ff1493] dark:text-white font-bold" 
              : "hover:bg-slate-200/40 dark:hover:bg-white/5 text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
          )}
        >
          <div className="shrink-0 w-6 h-6 flex items-center justify-center transition-transform group-hover:scale-105">
            <Menu 
              size={24} 
              strokeWidth={2} 
              className={cn(
                showMenuPopup 
                  ? "text-[#ff1493] dark:text-white" 
                  : "text-slate-500 group-hover:text-slate-800 dark:text-zinc-400 dark:group-hover:text-white"
              )}
            />
          </div>
          <AnimatePresence>
            {isHovered && (
              <motion.span 
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="text-base overflow-hidden whitespace-nowrap"
              >
                Menu
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
