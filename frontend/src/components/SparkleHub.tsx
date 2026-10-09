import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, 
  Users, 
  BarChart3, 
  MessageSquare, 
  PlayCircle, 
  Zap, 
  Activity, 
  Search as SearchIcon, 
  UserPlus, 
  History, 
  Image as ImageIcon, 
  Send, 
  CheckCircle2, 
  Briefcase, 
  Settings, 
  LifeBuoy, 
  HelpCircle, 
  User, 
  X, 
  ChevronRight, 
  LayoutGrid, 
  LogOut 
} from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useChatStore } from '../store/chatStore';
import api from '../api/api';

interface SparkleHubProps {
  onClose?: () => void;
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

export default function SparkleHub({ onClose }: SparkleHubProps) {
  const navigate = useNavigate();
  const { user, logout } = useUserStore();
  const storeConversations = useChatStore((s) => s.conversations);
  const storeUnreadCounts = useChatStore((s) => s.unreadCounts);

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
        const total = list.reduce((acc: number, c: any) => acc + (Number(c.unread_count) || 0), 0);
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

  // Sparkle features with clear, vibrant, modern icons and high-contrast styling
  const FEATURE_ITEMS = [
    { name: 'Marketplace', icon: ShoppingBag, color: 'text-amber-500 dark:text-amber-400', path: '/marketplace' },
    { name: 'Groups', icon: Users, color: 'text-blue-500 dark:text-blue-400', path: '/groups' },
    { name: 'Polls', icon: BarChart3, color: 'text-emerald-500 dark:text-emerald-400', path: '/polls' },
    { name: 'Messages', icon: MessageSquare, color: 'text-[#ff006e] dark:text-[#ff2d87]', path: '/messages' },
    { name: 'Shorts', icon: PlayCircle, color: 'text-cyan-500 dark:text-cyan-400', path: '/moments' },
    { name: 'Anonymous', icon: SpyIcon, color: 'text-slate-700 dark:text-zinc-200', path: '/confessions' },
    { name: 'Services', icon: Zap, color: 'text-yellow-500 dark:text-yellow-400', path: '/skill-market' },
    { name: 'Live Video', icon: Activity, color: 'text-rose-500 dark:text-rose-400', path: '/streams' },
    { name: 'Search', icon: SearchIcon, color: 'text-slate-600 dark:text-zinc-300', path: '/search' },
    { name: 'Find Friends', icon: UserPlus, color: 'text-pink-500 dark:text-pink-400', path: '/connect' },
    { name: 'Archive', icon: History, color: 'text-indigo-500 dark:text-indigo-400', path: '/memories' },
    { name: 'Photos', icon: ImageIcon, color: 'text-fuchsia-500 dark:text-fuchsia-400', path: '/gallery' },
    { name: 'Share App', icon: Send, color: 'text-teal-500 dark:text-teal-400', path: '/invite' },
    { name: 'Get Verified', icon: CheckCircle2, color: 'text-sky-500 dark:text-sky-400', path: '/verified' },
    { name: 'Professional Dashboard', icon: Briefcase, color: 'text-orange-500 dark:text-orange-400', path: '/professional-dashboard' },
    { name: 'Chat Settings', icon: Settings, color: 'text-slate-600 dark:text-zinc-300', path: '/messages/settings' },
    { name: 'Support', icon: LifeBuoy, color: 'text-pink-500 dark:text-pink-400', path: '/help' },
  ];

  const ACCOUNT_ITEMS = [
    { name: 'Account Settings', icon: User, path: '/settings' },
    { name: 'Help Center', icon: HelpCircle, path: '/help' },
    { name: 'Contact Support', icon: LifeBuoy, path: '/support' },
  ];

  return (
    <div 
      className="fixed inset-0 z-[2000] bg-slate-50/98 dark:bg-[#0a0a0c]/98 backdrop-blur-2xl flex flex-col overflow-y-auto no-scrollbar animate-fade-in text-slate-900 dark:text-zinc-100"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-xl md:max-w-2xl mx-auto px-4 py-5 sm:px-6 sm:py-8 flex flex-col gap-5 sm:gap-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ==================================================
            2. HEADER
            ================================================== */}
        <header className="flex items-center justify-between pt-1 pb-1">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white flex items-center">
                <span>Sparkle</span>
                <span className="text-[#ff006e] dark:text-[#ff2d87] ml-1.5 font-black">Hub</span>
              </h1>
              <SparkleBrandMark size={20} className="shrink-0 mt-0.5" />
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 font-semibold tracking-wide mt-0.5">
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

        {/* ==================================================
            3. DYNAMIC GREETING CARD
            ================================================== */}
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

        {/* ==================================================
            4. FEATURES SECTION HEADER
            ================================================== */}
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-pink-100 dark:bg-pink-900/40 flex items-center justify-center text-[#ff006e] dark:text-[#ff2d87]">
              <LayoutGrid size={15} strokeWidth={2.5} />
            </div>
            <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              Features
            </span>
          </div>
          <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 flex items-center gap-1 cursor-default select-none transition-colors">
            Explore &amp; do more <ChevronRight size={14} className="stroke-[2.5]" />
          </span>
        </div>

        {/* ==================================================
            5 & 6. FEATURE GRID (With interest-filtered relevance badges)
            ================================================== */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
          {FEATURE_ITEMS.map((item) => {
            const isMessages = item.name === 'Messages';
            const badgeCount = isMessages 
              ? Math.max(unreadMessagesCount, relevanceCounts['Messages'] || 0)
              : (relevanceCounts[item.name] || 0);
            const hasBadge = badgeCount > 0;

            return (
              <button 
                key={item.name}
                onClick={() => handleNavigate(item.path)}
                className="group relative flex flex-col items-center justify-between p-3 sm:p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 hover:border-pink-500/50 dark:hover:border-pink-500/60 shadow-sm hover:shadow-md transition-all duration-200 active:scale-[0.98] text-center min-h-[112px] sm:min-h-[122px]"
              >
                {/* Top Row: Spacer, Category Icon, Subtle Chevron */}
                <div className="w-full flex items-start justify-between">
                  <div className="w-3.5" />
                  <div className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-50 dark:bg-zinc-800/90 border border-slate-100 dark:border-zinc-700/60 ${item.color} group-hover:scale-105 transition-transform duration-200 flex items-center justify-center shadow-xs`}>
                    <item.icon size={24} strokeWidth={2.3} />
                  </div>
                  <ChevronRight 
                    size={14} 
                    strokeWidth={2.5}
                    className="text-slate-300 dark:text-zinc-600 group-hover:text-[#ff006e] group-hover:translate-x-0.5 transition-all duration-200 shrink-0 mt-1" 
                  />
                </div>

                {/* Bottom Row: Feature Name + Relevance Badge */}
                <div className="w-full mt-2.5 flex items-center justify-center gap-1.5 flex-wrap">
                  <span className="text-xs sm:text-[13px] font-bold text-slate-900 dark:text-zinc-100 tracking-tight leading-snug line-clamp-2">
                    {item.name}
                  </span>
                  {hasBadge && (
                    <span 
                      aria-label={`${badgeCount} relevant updates`}
                      className="shrink-0 min-w-[20px] h-[20px] px-1.5 rounded-full bg-[#ff006e] text-white text-[11px] font-black flex items-center justify-center shadow-sm"
                    >
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* ==================================================
            9. ACCOUNT SECTION
            ================================================== */}
        <div className="pt-2">
          <div className="h-px w-full bg-slate-200/80 dark:bg-zinc-800 mb-5 sm:mb-6" />

          <div className="flex items-center gap-2 mb-3.5 px-1">
            <div className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-zinc-800 flex items-center justify-center text-slate-800 dark:text-zinc-200">
              <User size={15} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                Account
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium mt-0.5">
                Manage your profile &amp; settings
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 shadow-sm overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800/80">
            {ACCOUNT_ITEMS.map((item) => (
              <button
                key={item.name}
                onClick={() => handleNavigate(item.path)}
                className="group w-full px-4 py-3.5 sm:py-4 flex items-center gap-3.5 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 flex items-center justify-center border border-slate-200/60 dark:border-zinc-700/60 group-hover:text-[#ff006e] group-hover:border-pink-300 dark:group-hover:border-pink-800 transition-colors shrink-0 shadow-xs">
                  <item.icon size={20} strokeWidth={2.2} />
                </div>
                <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 group-hover:text-black dark:group-hover:text-white transition-colors">
                  {item.name}
                </span>
                <ChevronRight 
                  size={18} 
                  strokeWidth={2.5}
                  className="text-slate-400 dark:text-zinc-500 ml-auto group-hover:text-[#ff006e] group-hover:translate-x-0.5 transition-all shrink-0" 
                />
              </button>
            ))}
          </div>
        </div>

        {/* ==================================================
            10. LOGOUT BUTTON (Crisp, High Visibility, Solid Contrast)
            ================================================== */}
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
