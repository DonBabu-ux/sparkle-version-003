import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Users,
  BarChart3,
  MessageSquare,
  PlayCircle,
  UserPlus,
  History,
  Briefcase,
  LifeBuoy,
  HelpCircle,
  X,
  LogOut,
  Pen,
  Hammer,
  Calendar,
  Sparkles,
  Store,
  Vote,
  Ghost,
  PackageSearch,
  Tag,
  Receipt,
  ListChecks,
  Wallet,
  Megaphone,
  PenTool,
  Radio,
  Images,
  Star,
  Bot,
  BadgeCheck,
  Shield,
  Settings,
  Terminal
} from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useChatStore } from '../store/chatStore';
import { useModalStore } from '../store/modalStore';
import { getRoleFromToken } from '../utils/tokenUtils';
import { isAdminRole } from '../utils/adminRoute';
import api from '../api/api';

interface SparkleHubProps {
  onClose?: () => void;
  embedded?: boolean;
}

// Sparkle Spy icon for Anonymous confessions (crisp stroke and clear geometry)
const SpyIcon = ({ size = 24, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.3"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M17 10c.5-1.5 0-3-1-4l-1-1h-6l-1 1c-1 1-1.5 2.5-1 4" />
    <path d="M3 10h18l-1.5 3H4.5L3 10z" />
    <circle cx="8.5" cy="17" r="2.5" />
    <circle cx="15.5" cy="17" r="2.5" />
    <path d="M11 17h2" />
  </svg>
);

// Bespoke aesthetic Sparkle-branded insignia (sleek luxury tech, no generic stars)
const SparkleBrandMark = ({ size = 20, className = "" }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="spkHubHeaderGlintV3" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ff006e" />
        <stop offset="100%" stopColor="#ff1493" />
      </linearGradient>
    </defs>
    <rect x="2.5" y="2.5" width="19" height="19" rx="6" stroke="url(#spkHubHeaderGlintV3)" strokeWidth="1.8" />
    <path
      d="M15.5 7.5C14.3 6.4 12.8 5.8 11.2 5.8C8.5 5.8 6.5 7.8 6.5 10.2C6.5 13.5 13.5 12.6 13.5 15.6C13.5 17.2 12.2 18.2 10.5 18.2C8.8 18.2 7.4 17.2 6.8 16"
      stroke="url(#spkHubHeaderGlintV3)"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="16.5" cy="7" r="1.5" fill="#ff006e" />
  </svg>
);

// Subtle ambient glow & aurora waves for greeting card (no stars)
const SparkleCardAura = ({ className = "" }: { className?: string }) => (
  <svg
    width="92"
    height="92"
    viewBox="0 0 92 92"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <radialGradient id="spkHubCardGradV3" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#ff006e" stopOpacity="0.25" />
        <stop offset="60%" stopColor="#ff1493" stopOpacity="0.06" />
        <stop offset="100%" stopColor="#ff1493" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="spkHubCardRingsV3" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ff006e" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#ff477e" stopOpacity="0.2" />
      </linearGradient>
    </defs>
    <circle cx="46" cy="46" r="42" fill="url(#spkHubCardGradV3)" />
    <circle cx="46" cy="46" r="26" stroke="url(#spkHubCardRingsV3)" strokeWidth="1.5" strokeDasharray="3 3" />
    <circle cx="46" cy="46" r="12" fill="#ff006e" fillOpacity="0.12" stroke="#ff006e" strokeWidth="1" strokeOpacity="0.35" />
    <circle cx="68" cy="24" r="3" fill="#ff006e" fillOpacity="0.4" />
    <circle cx="24" cy="68" r="2.5" fill="#ff477e" fillOpacity="0.35" />
  </svg>
);

export default function SparkleHub({ onClose, embedded = false }: SparkleHubProps) {
  const navigate = useNavigate();
  const { user, token, logout } = useUserStore();
  const storeConversations = useChatStore((s) => s.conversations);
  const storeUnreadCounts = useChatStore((s) => s.unreadCounts);
  const { setActiveModal } = useModalStore();

  // 1. Dynamic Greeting based on time of day (morning, afternoon, evening, night)
  const [greetingState, setGreetingState] = useState<{
    prefix: string;
    subtitle: string;
  }>({
    prefix: 'Hey',
    subtitle: 'Good vibes, great people, and endless possibilities.'
  });

  useEffect(() => {
    const computeGreeting = () => {
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 12) {
        return {
          prefix: 'Greetings at dawn',
          subtitle: "Start your morning inspired. Catch what's fresh across campus & community."
        };
      } else if (hour >= 12 && hour < 17) {
        return {
          prefix: 'Good afternoon',
          subtitle: "Midday momentum. Check out new relevant drops, moments & discussions."
        };
      } else if (hour >= 17 && hour < 22) {
        return {
          prefix: 'Good evening',
          subtitle: "Time to unwind. Catch up on active polls, confessions & messages."
        };
      } else {
        return {
          prefix: 'Late night vibes',
          subtitle: "Night owl hours. Explore anonymous campus stories & late chats."
        };
      }
    };

    setGreetingState(computeGreeting());
    const timer = setInterval(() => {
      setGreetingState(computeGreeting());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // First name extraction from real authenticated user data
  const firstName = useMemo(() => {
    if (user?.name && user.name.trim()) {
      return user.name.trim().split(/\s+/)[0];
    }
    if (user?.username && user.username.trim()) {
      return user.username.trim();
    }
    return '';
  }, [user]);

  const greetingTitle = useMemo(() => {
    if (firstName) {
      return `${greetingState.prefix}, ${firstName}`;
    }
    return greetingState.prefix;
  }, [greetingState.prefix, firstName]);

  // 2. Unread messages count
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);

  useEffect(() => {
    // Check local store first
    const fromCounts = Object.values(storeUnreadCounts || {}).reduce((acc, c) => acc + (Number(c) || 0), 0);
    const fromConvs = (storeConversations || []).reduce((acc, c) => acc + (Number(c.unread_count) || 0), 0);
    const initialCount = Math.max(fromCounts, fromConvs);
    setUnreadMessagesCount(initialCount);

    // Refresh from official inbox endpoint
    let isMounted = true;
    api.get('/messages/inbox')
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data) ? res.data : [];
        const total = list.reduce((acc: number, c: { unread_count?: number }) => acc + (Number(c.unread_count) || 0), 0);
        setUnreadMessagesCount(total);
      })
      .catch((err) => {
        console.warn('[SparkleHub] Could not refresh inbox unread count', err);
      });

    return () => {
      isMounted = false;
    };
  }, [storeConversations, storeUnreadCounts]);

  // 3. User interest pool relevance badges (Marketplace, Groups, Polls, Shorts, etc.)
  const [relevanceCounts, setRelevanceCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let isMounted = true;
    api.get('/users/hub-relevance-badges')
      .then((res) => {
        if (!isMounted) return;
        if (res.data?.success && res.data?.relevance) {
          setRelevanceCounts(res.data.relevance);
        }
      })
      .catch((err) => {
        console.warn('[SparkleHub] Could not refresh relevance badges', err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleNavigate = (path: string) => {
    if (onClose) onClose();
    navigate(path);
  };

  const handleLogout = () => {
    if (onClose) onClose();
    logout();
    navigate('/login');
  };

  const runCreate = (fn: () => void) => {
    if (onClose) onClose();
    fn();
  };

  // Creation shortcuts — everything a member can start from the hub.
  const CREATE_ITEMS = [
    { name: 'Post', icon: Pen, action: () => setActiveModal('post') },
    { name: 'Story', icon: History, action: () => navigate('/afterglow/create') },
    { name: 'Moment', icon: PlayCircle, action: () => navigate('/moments/create') },
    { name: 'Listing', icon: Store, action: () => setActiveModal('listing') },
    { name: 'Skill Offer', icon: Hammer, action: () => setActiveModal('skill_offer') },
    { name: 'Poll', icon: BarChart3, action: () => setActiveModal('poll') },
    { name: 'Event', icon: Calendar, action: () => setActiveModal('event') },
    { name: 'Confession', icon: SpyIcon, action: () => setActiveModal('confession') },
    { name: 'Highlight', icon: Sparkles, action: () => setActiveModal('highlight') },
  ];

  // Grouped menu — every destination in the app, grouped by relevance.
  const ROLE = getRoleFromToken(token);
  const HUB_SECTIONS: { title: string; items: { name: string; icon: typeof Home; path: string }[] }[] = [
    {
      title: 'Community',
      items: [
        { name: 'Messages', icon: MessageSquare, path: '/messages' },
        { name: 'Campus Groups', icon: Users, path: '/groups' },
        { name: 'Campus Polls', icon: Vote, path: '/polls' },
        { name: 'Upcoming Events', icon: Calendar, path: '/events' },
        { name: 'Campus Clubs', icon: Sparkles, path: '/clubs' },
        { name: 'Confessions', icon: Ghost, path: '/confessions' },
        { name: 'Lost & Found', icon: PackageSearch, path: '/lost-found' },
      ],
    },
    {
      title: 'Sell & earn',
      items: [
        { name: 'Marketplace', icon: ShoppingBag, path: '/marketplace' },
        { name: 'Skill Market', icon: Briefcase, path: '/skill-market' },
        { name: 'Skill Hub', icon: Briefcase, path: '/skill-market/hub' },
        { name: 'Sell an item', icon: Tag, path: '/marketplace/sell' },
        { name: 'My orders', icon: Receipt, path: '/marketplace/orders' },
        { name: 'My listings', icon: ListChecks, path: '/marketplace/my-listings' },
        { name: 'My shop', icon: Store, path: '/marketplace/my-shop' },
        { name: 'Wallet', icon: Wallet, path: '/wallet/history' },
        { name: 'Ads manager', icon: Megaphone, path: '/ads' },
        { name: 'Creator Studio', icon: PenTool, path: '/studio' },
        { name: 'Analytics', icon: BarChart3, path: '/analytics' },
        { name: 'Professional dashboard', icon: Briefcase, path: '/professional-dashboard' },
      ],
    },
    {
      title: 'Watch & explore',
      items: [
        { name: 'Live streams', icon: Radio, path: '/streams' },
        { name: 'Moments', icon: PlayCircle, path: '/moments' },
        { name: 'Memories', icon: Images, path: '/memories' },
        { name: 'Gallery', icon: Images, path: '/gallery' },
        { name: 'Wishlist', icon: Star, path: '/wishlist' },
        { name: 'Sparkly AI', icon: Bot, path: '/sparkly' },
      ],
    },
    {
      title: 'Account',
      items: [
        { name: 'Verified account', icon: BadgeCheck, path: '/verified' },
        { name: 'Invite friends', icon: UserPlus, path: '/invite' },
        { name: 'Search history', icon: History, path: '/search/history' },
        ...(isAdminRole(ROLE) ? [{ name: 'Admin panel', icon: Shield, path: '/admin' }] : []),
        { name: 'App Settings', icon: Settings, path: '/settings' },
        { name: 'Account Center', icon: Users, path: '/settings/accounts' },
        { name: 'Help center', icon: HelpCircle, path: '/help' },
        { name: 'Support', icon: LifeBuoy, path: '/support' },
        { name: 'Developer Hub', icon: Terminal, path: '/developer' },
      ],
    },
  ];

  return (
    <div
      className={embedded
        ? "w-full h-full flex flex-col overflow-y-auto no-scrollbar text-slate-900 dark:text-zinc-100"
        : "fixed inset-0 z-[2000] bg-slate-50/98 dark:bg-[#0a0a0c]/98 backdrop-blur-2xl flex flex-col overflow-y-auto no-scrollbar animate-fade-in text-slate-900 dark:text-zinc-100"}
      onClick={embedded ? undefined : onClose}
    >
      <div
        className={`${embedded ? 'w-full px-4 py-4' : 'w-full max-w-xl md:max-w-2xl mx-auto px-4 py-5 sm:px-6 sm:py-8'} flex flex-col gap-4 sm:gap-5`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <header className="flex items-center justify-between pt-1 pb-1">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center">
                <span>Sparkle</span>
                <span className="text-[#ff006e] dark:text-[#ff2d87] ml-1.5 font-black">Hub</span>
              </h1>
              <SparkleBrandMark size={20} className="shrink-0 mt-0.5" />
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 font-semibold tracking-wide mt-0.5">
              Everything in one place ♡
            </p>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close Sparkle Hub"
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-800 dark:text-zinc-100 shadow-sm border border-slate-200/90 dark:border-zinc-700/80 flex items-center justify-center transition-all active:scale-95"
            >
              <X size={20} strokeWidth={2.5} />
            </button>
          )}
        </header>

        {/* DYNAMIC GREETING CARD */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl p-4 sm:p-5 bg-gradient-to-r from-pink-50 via-white to-pink-50/70 dark:from-zinc-900 dark:via-zinc-900 dark:to-pink-950/25 border border-pink-200/90 dark:border-pink-900/50 shadow-sm flex items-center justify-between">
          <div className="relative z-10 flex flex-col pr-4">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {greetingTitle}
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-slate-700 dark:text-zinc-300 mt-1 leading-snug">
              {greetingState.subtitle}
            </p>
          </div>

          <div className="shrink-0 pointer-events-none relative -mr-2">
            <SparkleCardAura />
          </div>
        </div>

        {/* CREATE SHORTCUTS */}
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-pink-100 dark:bg-pink-900/40 flex items-center justify-center text-[#ff006e] dark:text-[#ff2d87]">
              <Pen size={15} strokeWidth={2.5} />
            </div>
            <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Create
            </span>
          </div>
          <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-zinc-300 select-none">
            Start something new
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
          {CREATE_ITEMS.map((item) => (
            <button
              key={item.name}
              onClick={() => runCreate(item.action)}
              className="group flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 hover:border-pink-500/50 dark:hover:border-pink-500/60 shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98] text-center min-h-[84px]"
            >
              <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800/90 border border-slate-100 dark:border-zinc-700/60 text-slate-700 dark:text-zinc-200 group-hover:text-[#ff006e] group-hover:border-pink-300 dark:group-hover:border-pink-800 flex items-center justify-center transition-colors">
                <item.icon size={19} strokeWidth={2.4} />
              </div>
              <span className="text-[11px] font-bold text-slate-900 dark:text-zinc-100 tracking-tight leading-snug">
                {item.name}
              </span>
            </button>
          ))}
        </div>

        {/* GROUPED MENU */}
        {HUB_SECTIONS.map((section) => (
          <div key={section.title} className="pt-1">
            <div className="flex items-center gap-2 px-1 mb-2.5">
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-300">
                {section.title}
              </span>
              <div className="h-px flex-1 bg-slate-200/80 dark:bg-zinc-800" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {section.items.map((item) => {
                const isMessages = item.name === 'Messages';
                const badgeCount = isMessages
                  ? Math.max(unreadMessagesCount, relevanceCounts['Messages'] || 0)
                  : (relevanceCounts[item.name] || 0);

                return (
                  <button
                    key={item.name}
                    onClick={() => handleNavigate(item.path)}
                    className="group w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 hover:border-pink-500/50 dark:hover:border-pink-500/60 shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98] text-left min-w-0"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-zinc-800/90 border border-slate-100 dark:border-zinc-700/60 text-slate-700 dark:text-zinc-200 group-hover:text-[#ff006e] flex items-center justify-center transition-colors shrink-0">
                      <item.icon size={16} strokeWidth={2.3} />
                    </div>
                    <span className="text-[11px] font-bold text-slate-900 dark:text-zinc-100 tracking-tight leading-snug truncate flex-1">
                      {item.name}
                    </span>
                    {badgeCount > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[#ff006e] text-white text-[10px] font-black flex items-center justify-center shadow-sm">
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* LOGOUT */}
        <div className="pt-2 pb-6">
          <button
            onClick={handleLogout}
            className="w-full py-4 px-5 bg-pink-50 hover:bg-pink-100/90 dark:bg-pink-950/40 dark:hover:bg-pink-900/60 text-[#ff006e] dark:text-[#ff2d87] font-bold text-sm sm:text-base rounded-2xl border border-pink-200 dark:border-pink-800/60 flex items-center justify-center gap-3 transition-all duration-200 active:scale-[0.99] shadow-sm hover:shadow"
          >
            <LogOut size={20} strokeWidth={2.5} className="text-[#ff006e] dark:text-[#ff2d87]" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
}
