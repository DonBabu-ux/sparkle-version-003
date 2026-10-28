import { useState, useEffect } from 'react';
import { scrollTopTo } from './AppScreen';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Search,
  Compass,
  PlayCircle,
  Heart,
  Send,
  Plus,
  LayoutGrid,
  Users,
  Shield
} from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { getRoleFromToken } from '../utils/tokenUtils';
import { isAdminRole } from '../utils/adminRoute';
import Avatar from './Avatar';
import api from '../api/api';
import NotificationsPanel from './notifications/NotificationsPanel';
import SparkleHubPanel from './SparkleHubPanel';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Sidebar() {
  const { user, logout, token } = useUserStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [bellAnchor, setBellAnchor] = useState<DOMRect | null>(null);
  const [hubOpen, setHubOpen] = useState(false);
  const [hubAnchor, setHubAnchor] = useState<DOMRect | null>(null);

  const toggleHub = (e?: React.MouseEvent) => {
    const rect = (e?.currentTarget as HTMLElement | undefined)?.getBoundingClientRect() ?? null;
    setHubAnchor(rect);
    setHubOpen(v => !v);
  };

  // Instagram-style unread dot: pink only when there are unread
  // notifications; cleared instantly when the user reads them.
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await api.get('/notifications');
        const list = res.data.notifications || res.data || [];
        setUnreadCount(list.filter((n: any) => !n.is_read && !n.isRead).length);
      } catch {
        /* silent — dot just stays off */
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    const onAllRead = () => setUnreadCount(0);
    window.addEventListener('notifications_all_read', onAllRead);
    return () => {
      clearInterval(interval);
      window.removeEventListener('notifications_all_read', onAllRead);
    };
  }, []);

  const isActive = (path: string) => location.pathname === path;
  const role = getRoleFromToken(token);

  // The floating notifications menu closes whenever the route changes.
  useEffect(() => { setBellOpen(false); setHubOpen(false); }, [location.pathname]);


  const NAV_ITEMS = [
    { name: 'Home', icon: Home, path: '/dashboard' },
    { name: 'Search', icon: Search, path: '/search', action: () => navigate('/search') },
    { name: 'Explore', icon: Compass, path: '/explore' },
    { name: 'Connect', icon: Users, path: '/connect' },
    { name: 'Reels', icon: PlayCircle, path: '/moments' },
    { name: 'Messages', icon: Send, path: '/messages' },
    { name: 'Notifications', icon: Heart, path: '/notifications', badge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : undefined, action: (e?: React.MouseEvent) => {
        const rect = (e?.currentTarget as HTMLElement | undefined)?.getBoundingClientRect() ?? null;
        setBellAnchor(rect);
        setBellOpen(v => !v);
      } },
    { name: 'Create', icon: Plus, path: '#', action: (e?: React.MouseEvent) => toggleHub(e) },
    ...(isAdminRole(role) ? [{ name: 'Admin', icon: Shield, path: '/admin' }] : []),
    { name: 'Profile', icon: null, path: `/profile/${user?.username}`, isProfile: true },
  ];

  return (
    <motion.div 
      initial={false}
      animate={{ width: isHovered ? 240 : 72 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="fixed left-0 top-0 h-dvh bg-[#f6eef3] dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 border-r border-slate-200 dark:border-zinc-800 flex flex-col py-6 z-(--z-chrome) overflow-hidden transition-all duration-300 shadow-[2px_0_12px_rgba(0,0,0,0.03)]"
    >
      {/* Logo Section */}
      <div 
        className="flex items-center px-6 mb-8 cursor-pointer h-12"
        onClick={() => navigate('/dashboard')}
      >
        <div className="shrink-0 flex items-center justify-center transition-transform hover:scale-105 w-12 h-12 overflow-hidden bg-white dark:bg-zinc-800 rounded-full shadow-md border border-slate-200/60 p-1">
          <img src="/logo.png" alt="Sparkle" className="w-full h-full object-contain" />
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
              aria-label={item.name === 'Create' ? 'Create content' : undefined}
              title={item.name === 'Create' ? 'Create content' : undefined}
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
                  item.action(e);
                  return;
                }
                if (item.path === '/dashboard' && isActive('/dashboard')) {
                  e.preventDefault();
                  scrollTopTo(0, 'smooth');
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
                  <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] px-1 bg-[#ff1493] text-white text-[10px] font-black tabular-nums text-center leading-none flex items-center justify-center rounded-full border border-white dark:border-zinc-950 scale-90 origin-center">
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
        
        <div
          onClick={(e) => toggleHub(e)}
          className={cn(
            "flex items-center gap-4 p-3 rounded-lg transition-all duration-200 group cursor-pointer",
            hubOpen
              ? "bg-slate-200/70 dark:bg-white/10 text-[#ff1493] dark:text-white font-bold"
              : "hover:bg-slate-200/40 dark:hover:bg-white/5 text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white"
          )}
        >
          <div className="shrink-0 w-6 h-6 flex items-center justify-center transition-transform group-hover:scale-105">
            <LayoutGrid
              size={24}
              strokeWidth={hubOpen ? 2.5 : 2}
              className={cn(
                hubOpen
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
                Sparkle Menu
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <NotificationsPanel
        open={bellOpen}
        anchorRect={bellAnchor}
        onClose={() => setBellOpen(false)}
      />

      <SparkleHubPanel
        open={hubOpen}
        anchorRect={hubAnchor}
        onClose={() => setHubOpen(false)}
      />
    </motion.div>
  );
}
