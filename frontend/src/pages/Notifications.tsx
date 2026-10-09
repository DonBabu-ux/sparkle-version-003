import { showError, showInfo, showSuccess } from '../utils/toast';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { getAvatarUrl } from '../utils/imageUtils';
import { User, Zap, MessageSquare, Users, ShoppingBag, Bell, Hand, ArrowLeft, CheckCircle2, Search, MoreHorizontal, X, BellOff, AlertOctagon, AtSign } from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import ModernOfflineState from '../components/ui/ModernOfflineState';
import { IdentityManager } from '../utils/identityManager';
import { VerifiedBadge } from '../components/common/VerifiedBadge';
import { logger } from '../utils/logger';

interface Notification {
  notification_id: string;
  type: string;
  title: string;
  content: string;
  created_at: string;
  is_read: number | boolean;
  isRead?: boolean;
  actor_avatar?: string;
  actor_id?: string;
  actor_name?: string;
  actor_username?: string;
  message?: string;
  id?: string;
  action_url?: string;
  related_id?: string;
  related_type?: string;
  target?: {
    entity_type: string;
    entity_id: string;
    sub_entity_id?: string;
  };
}

export const isNotificationRead = (n: Notification): boolean =>
  n.is_read === 1 || n.is_read === true || (n as any).isRead === true;

// ── Live relative timestamp ────────────────────────────────────────
function relativeTime(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 45)   return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.round(diff / 86400)}d ago`;
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeAll, setSeeAll] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [markedFeedback, setMarkedFeedback] = useState(false);
  const [, setTick] = useState(0); // clock tick for live relative timestamps
  const navigate = useNavigate();
  const unreadRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await api.get('/notifications');
        if (response.data.success || response.data) {
          const raw = response.data.notifications || response.data || [];
          const fetchedNotifs: Notification[] = (Array.isArray(raw) ? raw : []).map((n: any) => ({
            ...n,
            notification_id: n.notification_id || n.id,
            id: n.id || n.notification_id,
            is_read: (n.is_read === 1 || n.is_read === true || n.isRead === true) ? 1 : 0,
            isRead: !!(n.is_read === 1 || n.is_read === true || n.isRead === true)
          }));
          setNotifications(fetchedNotifs);
        }
      } catch (err) {
        logger.error('Failed to fetch notifications:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  // Live timestamp tick — update every 60s
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Auto-mark-as-read on scroll into view (IntersectionObserver)
  const markAsReadCb = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.notification_id === id || n.id === id) ? { ...n, is_read: 1, isRead: true } : n)
    );
    api.put(`/notifications/${id}/read`).catch(() => {});
  }, []);

  useEffect(() => {
    if (loading) return;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const id = (entry.target as HTMLElement).dataset.notifId;
          if (!id) return;
          if (entry.isIntersecting) {
            // Mark read after 1.5s of being visible
            timers.set(id, setTimeout(() => markAsReadCb(id), 1500));
          } else {
            clearTimeout(timers.get(id));
            timers.delete(id);
          }
        });
      },
      { threshold: 0.6 }
    );

    // Observe all currently-mounted unread refs
    unreadRefs.current.forEach(el => observerRef.current!.observe(el));

    return () => {
      observerRef.current?.disconnect();
      timers.forEach(t => clearTimeout(t));
    };
  }, [loading, markAsReadCb]);

  // Helper to register/unregister an unread card ref
  const setUnreadRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      unreadRefs.current.set(id, el);
      observerRef.current?.observe(el);
    } else {
      const prev = unreadRefs.current.get(id);
      if (prev) observerRef.current?.unobserve(prev);
      unreadRefs.current.delete(id);
    }
  }, []);

  const markAsRead = async (id: string) => {
    try {
      setNotifications(prev =>
        prev.map(n => (n.notification_id === id || n.id === id) ? { ...n, is_read: 1, isRead: true } : n)
      );
      await api.put(`/notifications/${id}/read`).catch(() => api.post(`/notifications/${id}/read`));
    } catch (err) {
      logger.error('Failed to mark read:', err);
    }
  };

  const markAllRead = async () => {
    if (markingAll) return;
    try {
      setMarkingAll(true);
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1, isRead: true })));
      unreadRefs.current.clear();
      window.dispatchEvent(new Event('notifications_all_read'));

      // Call API
      await api.put('/notifications/read-all').catch(() => api.post('/notifications/read-all'));

      setMarkedFeedback(true);
      setTimeout(() => setMarkedFeedback(false), 2000);
    } catch (err) {
      logger.error('Failed to mark all read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      // Assuming a delete endpoint exists. If not, this simply removes it from UI for now.
      await api.delete(`/notifications/${id}`).catch(() => { });
      setNotifications(prev => prev.filter(n => (n.notification_id !== id && n.id !== id)));
      setSelectedNotif(null);
    } catch (err) {
      logger.error('Failed to delete notification:', err);
    }
  };

  const getBadgeColor = (type: string) => {
    switch (type) {
      case 'follow': return '#1877f2';
      case 'spark': return '#f59e0b';
      case 'comment': return '#31a24c';
      case 'mention': return '#ec4899';
      case 'group': return '#8b5cf6';
      case 'marketplace': return '#14b8a6';
      case 'poke': return '#6366f1';
      case 'capture_attempt': return '#ef4444';
      default: return '#1877f2';
    }
  };

  const getFacebookIcon = (type: string) => {
    switch (type) {
      case 'follow': return <User size={12} className="text-white" strokeWidth={3} />;
      case 'spark': return <Zap size={12} className="text-white fill-white" />;
      case 'comment': return <MessageSquare size={12} className="text-white fill-white" />;
      case 'mention': return <AtSign size={12} className="text-white" strokeWidth={3} />;
      case 'group': return <Users size={12} className="text-white" strokeWidth={3} />;
      case 'marketplace': return <ShoppingBag size={12} className="text-white" strokeWidth={3} />;
      case 'poke': return <Hand size={12} className="text-white fill-white" />;
      case 'capture_attempt': return <AlertOctagon size={12} className="text-white fill-white" />;
      default: return <Bell size={12} className="text-white fill-white" />;
    }
  };

  const handlePokeBack = async (userId?: string, name?: string) => {
    if (!userId) return;
    try {
      await api.post(`/users/${userId}/poke`);
      showInfo(`You poked ${name || 'them'} back! 👋`);
    } catch (err) {
      logger.error('Poke back failed:', err);
      showError('Failed to send poke. Try again later.');
    }
  };

  const handleNotificationClick = async (notif: Notification) => {
    // 1. Mark as read immediately in UI
    markAsRead(notif.notification_id || notif.id || '');

    // 2. Determine target URL
    let targetUrl = notif.action_url;

    if (notif.target) {
      const { entity_type, entity_id, sub_entity_id } = notif.target;

      switch (entity_type) {
        case 'mention':
          targetUrl = `/post/${entity_id}`;
          break;
        case 'post':
        case 'like':
        case 'comment':
        case 'spark':
          targetUrl = `/post/${entity_id}${sub_entity_id ? `?commentId=${sub_entity_id}` : ''}`;
          break;
        case 'moment':
          targetUrl = `/moment/${entity_id}`;
          break;
        case 'profile':
        case 'user':
        case 'follow':
          targetUrl = `/profile/${entity_id || notif.actor_id || notif.actor_username}`;
          break;
        case 'group':
        case 'group_invite':
          targetUrl = `/groups/${entity_id}`;
          break;
        case 'marketplace':
        case 'marketplace_contact':
        case 'order':
          targetUrl = entity_type === 'order' ? `/orders/${entity_id}` : `/marketplace/listing/${entity_id}`;
          break;
        case 'story':
        case 'story_like':
        case 'story_share':
          targetUrl = `/story/${entity_id}`;
          break;
        case 'message':
          targetUrl = `/messages/${entity_id || ''}`;
          break;
        case 'confession':
          targetUrl = `/confessions?id=${entity_id}`;
          break;
        case 'support':
        case 'support_update':
          targetUrl = `/support/ticket/${entity_id}`;
          break;
      }
    }

    // 3. Navigate
    if (targetUrl) {
      navigate(targetUrl);
    }
  };

  // Categorize notifications
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const newNotifs = notifications.filter(n => !isNotificationRead(n));
  const todayNotifs = notifications.filter(n => isNotificationRead(n) && new Date(n.created_at).getTime() >= todayStart);
  const earlierNotifs = notifications.filter(n => isNotificationRead(n) && new Date(n.created_at).getTime() < todayStart);
  const unreadCount = newNotifs.length;

  const displayedNotifs = seeAll ? notifications : notifications.slice(0, 20);

  const renderSection = (title: string, list: Notification[]) => {
    // Only filter the 'displayedNotifs' so pagination applies globally across categories
    const items = list.filter(n => displayedNotifs.includes(n));
    if (items.length === 0) return null;

    return (
      <div className="mb-1">
        <div className="px-4 py-2.5 flex items-center gap-2">
          <span className="text-[12px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">{title}</span>
          <div className="flex-1 h-px bg-black/5 dark:bg-white/5" />
        </div>
        <div className="flex flex-col">
          {items.map(notif => renderNotification(notif))}
        </div>
      </div>
    );
  };

  const renderNotification = (notif: Notification) => {
    const isUnread = !isNotificationRead(notif);
    const actorUsername = notif.actor_username;
    const actorIdentity = IdentityManager.resolveIdentity({
      user_id: notif.actor_id,
      username: notif.actor_username,
      displayName: notif.actor_name || notif.title,
      avatar_url: notif.actor_avatar,
      is_system_account: notif.actor_username === 'sparkleofficial' || notif.type === 'system'
    });
    const displayName = actorIdentity.displayName;

    return (
      <div
        key={notif.notification_id || notif.id}
        ref={isUnread ? (el) => setUnreadRef(notif.notification_id || notif.id || '', el) : undefined}
        data-notif-id={isUnread ? (notif.notification_id || notif.id) : undefined}
        onClick={() => handleNotificationClick(notif)}
        className={`flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer border-b border-black/[0.04] dark:border-white/[0.04] last:border-0 relative active:scale-[0.995] ${
          isUnread
            ? 'bg-[#fff0f7] dark:bg-[#ff149310]'
            : 'bg-white dark:bg-[#101217] hover:bg-black/[0.015] dark:hover:bg-white/[0.025]'
        }`}
      >
        {/* Left accent bar for unread */}
        {isUnread && (
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-[#ff1493] to-purple-500 rounded-r-full" />
        )}

        {/* Avatar + type badge */}
        <div className="relative shrink-0 self-start mt-0.5">
          <img
            src={actorIdentity.avatar}
            onClick={(e) => {
              e.stopPropagation();
              if (actorUsername) navigate(`/profile/${actorUsername}`);
            }}
            className="w-11 h-11 rounded-full object-cover border border-black/5 dark:border-white/10 cursor-pointer"
            alt={displayName}
          />
          <div
            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white dark:border-[#101217] shadow-sm"
            style={{ backgroundColor: getBadgeColor(notif.type) }}
          >
            {getFacebookIcon(notif.type)}
          </div>
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0 flex flex-col gap-0">
          {/* Name row */}
          <div className="flex items-baseline gap-1.5 flex-wrap leading-tight">
            {actorUsername || notif.actor_name ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (actorUsername) navigate(`/profile/${actorUsername}`);
                }}
                className="font-bold text-[15px] text-slate-900 dark:text-white hover:underline focus:outline-none text-left flex items-center gap-1 leading-snug"
              >
                {displayName}
                <VerifiedBadge accountType={actorIdentity.accountType} isVerified={actorIdentity.badge.show} color={actorIdentity.badge.color} size="xs" />
              </button>
            ) : (
              <span className="font-bold text-[15px] text-slate-900 dark:text-white flex items-center gap-1 leading-snug">
                {displayName}
                <VerifiedBadge accountType={actorIdentity.accountType} isVerified={actorIdentity.badge.show} color={actorIdentity.badge.color} size="xs" />
              </span>
            )}
          </div>

          {/* Action body */}
          <p className="text-[13px] font-medium text-slate-700 dark:text-zinc-200 leading-snug mt-0.5 break-words">
            {notif.content || notif.message}
          </p>

          {/* Timestamp + unread dot row */}
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`text-[11px] font-semibold ${
              isUnread ? 'text-[#ff1493]' : 'text-slate-400 dark:text-zinc-500'
            }`}>
              {relativeTime(notif.created_at)}
            </span>
            {isUnread && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff1493] shrink-0" aria-label="Unread" />
            )}
          </div>

          {/* Action Buttons (Filled CTAs) */}
          {notif.type === 'poke' && (
            <button
              onClick={(e) => { e.stopPropagation(); handlePokeBack(notif.actor_id, notif.actor_name); }}
              className="mt-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white px-3.5 py-1.5 rounded-xl text-[12px] font-semibold shadow-sm transition-all active:scale-95 inline-flex items-center gap-1 self-start"
            >
              Poke Back →
            </button>
          )}

          {notif.type === 'system_welcome' && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={(e) => { e.stopPropagation(); navigate('/explore'); }}
                className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white px-3.5 py-1.5 rounded-xl text-[12px] font-semibold shadow-sm transition-all active:scale-95 inline-flex items-center gap-1"
              >
                Explore →
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); navigate('/settings'); }}
                className="bg-black/5 dark:bg-white/8 hover:bg-black/10 dark:hover:bg-white/12 text-slate-700 dark:text-zinc-300 px-3.5 py-1.5 rounded-xl text-[12px] font-semibold transition-all active:scale-95"
              >
                Settings
              </button>
            </div>
          )}
        </div>

        {/* Right thumbnail — post or story */}
        {notif.target && (notif.target.entity_type === 'post' || notif.target.entity_type === 'story') && (
          <div className="shrink-0 self-start">
            <div
              onClick={(e) => {
                e.stopPropagation();
                if (notif.target?.entity_type === 'post') navigate(`/post/${notif.target.entity_id}`);
                if (notif.target?.entity_type === 'story') navigate(`/stories/${notif.target.entity_id}`);
              }}
              className="w-11 h-11 bg-slate-100 dark:bg-zinc-800 rounded-xl overflow-hidden border border-black/5 dark:border-white/8 cursor-pointer hover:brightness-90 transition-all flex items-center justify-center text-lg"
            >
              {notif.target.entity_type === 'story' ? '📖' : '🖼'}
            </div>
          </div>
        )}

        {/* More options */}
        <button
          onClick={(e) => { e.stopPropagation(); setSelectedNotif(notif); }}
          className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 dark:text-zinc-500 hover:bg-black/5 dark:hover:bg-white/8 transition-colors"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
    );
  };

  return (
    <div className="flex bg-app min-h-dvh text-black font-sans">

      <main className="flex-1 pb-24 max-w-2xl mx-auto w-full">
        {/* Sticky Header */}
        <header className="sticky top-[70px] z-30 bg-white/90 dark:bg-[#101217]/90 backdrop-blur-md border-b border-black/[0.06] dark:border-white/[0.06] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(-1)}
                className="w-9 h-9 -ml-1 rounded-xl flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/8 transition-colors"
              >
                <ArrowLeft size={20} className="text-slate-800 dark:text-white" />
              </button>
              <h1 className="text-[20px] font-bold text-slate-900 dark:text-white leading-none">Notifications</h1>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={markAllRead}
                disabled={markingAll || unreadCount === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all select-none ${
                  markedFeedback
                    ? 'text-emerald-500 bg-emerald-500/10'
                    : unreadCount > 0
                    ? 'text-[#ff1493] bg-[#ff1493]/10 hover:bg-[#ff1493]/20 active:scale-95 cursor-pointer'
                    : 'text-slate-400 dark:text-zinc-500 hover:bg-black/5 dark:hover:bg-white/5 opacity-50 cursor-default'
                }`}
                title={unreadCount > 0 ? "Mark all as read" : "All caught up"}
              >
                <CheckCircle2
                  size={16}
                  className={`transition-transform ${markedFeedback ? 'text-emerald-500 scale-110' : unreadCount > 0 ? 'text-[#ff1493]' : ''}`}
                />
                <span className="text-[13px] font-bold">
                  {markedFeedback ? 'All Read' : 'Mark all read'}
                </span>
                {unreadCount > 0 && !markedFeedback && (
                  <span className="ml-0.5 px-1.5 py-0.5 bg-[#ff1493] text-white text-[10px] font-extrabold rounded-full leading-none">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => navigate('/search')}
                className="w-9 h-9 rounded-xl flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/8 transition-colors text-slate-500 dark:text-zinc-400"
                title="Search"
              >
                <Search size={18} />
              </button>
            </div>
          </div>
        </header>

        {/* Notifications list */}
        <div className="bg-white dark:bg-[#101217]">
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner size="medium" color="text-primary" />
            </div>
          ) : notifications.length > 0 ? (
            <>
              {renderSection('New', newNotifs)}
              {renderSection('Today', todayNotifs)}
              {renderSection('Earlier', earlierNotifs)}

              {!seeAll && notifications.length > 20 && (
                <button
                  onClick={() => setSeeAll(true)}
                  className="w-full py-4 text-[13px] font-semibold text-[#ff1493] hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors border-t border-black/5 dark:border-white/5"
                >
                  See all notifications
                </button>
              )}
            </>
          ) : (
            <div className="py-20">
              <ModernOfflineState
                type="empty"
                title="All Caught Up"
                message="You've addressed all your alerts! We'll ping you as soon as something new sparks."
                onRetry={() => window.location.reload()}
              />
            </div>
          )}
        </div>
      </main>

      {/* Bottom Sheet — Notification Options */}
      {selectedNotif && (
        <div
          className="fixed inset-0 z-(--z-sheet) flex items-end justify-center bg-black/50 backdrop-blur-sm"
          style={{ animation: 'fadeIn 0.18s ease forwards' }}
          onClick={() => setSelectedNotif(null)}
        >
          <div
            className="bg-white dark:bg-[#1c1c1e] w-full max-w-lg rounded-t-3xl pb-safe shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 bg-black/10 dark:bg-white/20 rounded-full" />
            </div>

            {/* Actor preview */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-black/[0.05] dark:border-white/[0.06]">
              <img
                src={getAvatarUrl(selectedNotif.actor_avatar, selectedNotif.actor_username)}
                className="w-11 h-11 rounded-full object-cover border border-black/5 dark:border-white/10 shrink-0"
                alt=""
              />
              <p className="text-[13px] text-slate-600 dark:text-zinc-400 leading-snug flex-1 min-w-0">
                {selectedNotif.actor_name ? (
                  <><span className="font-semibold text-slate-900 dark:text-white">{selectedNotif.actor_name}</span>{' '}{selectedNotif.content || selectedNotif.message}</>
                ) : (
                  <><span className="font-semibold text-slate-900 dark:text-white">{selectedNotif.title}</span>{' '}{selectedNotif.content || selectedNotif.message}</>
                )}
              </p>
            </div>

            {/* Actions */}
            <div className="px-3 py-2 flex flex-col gap-0.5">
              <button
                onClick={() => deleteNotification(selectedNotif.notification_id || selectedNotif.id || '')}
                className="flex items-center gap-3 px-3 py-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] rounded-2xl text-left transition-colors"
              >
                <div className="w-9 h-9 rounded-2xl bg-black/5 dark:bg-white/8 flex items-center justify-center shrink-0">
                  <X size={17} className="text-slate-600 dark:text-zinc-300" />
                </div>
                <div>
                  <p className="font-semibold text-[14px] text-slate-900 dark:text-white leading-tight">Remove this notification</p>
                  <p className="text-[12px] text-slate-400 dark:text-zinc-500 mt-0.5">Won't show up in your updates</p>
                </div>
              </button>

              <button
                onClick={() => { showInfo('Notifications turned off.'); setSelectedNotif(null); }}
                className="flex items-center gap-3 px-3 py-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] rounded-2xl text-left transition-colors"
              >
                <div className="w-9 h-9 rounded-2xl bg-black/5 dark:bg-white/8 flex items-center justify-center shrink-0">
                  <BellOff size={17} className="text-slate-600 dark:text-zinc-300" />
                </div>
                <div>
                  <p className="font-semibold text-[14px] text-slate-900 dark:text-white leading-tight">Turn off for this post</p>
                  <p className="text-[12px] text-slate-400 dark:text-zinc-500 mt-0.5">Stop receiving updates for this activity</p>
                </div>
              </button>

              <button
                onClick={() => { showSuccess('Report sent to the team.'); setSelectedNotif(null); }}
                className="flex items-center gap-3 px-3 py-3 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] rounded-2xl text-left transition-colors"
              >
                <div className="w-9 h-9 rounded-2xl bg-black/5 dark:bg-white/8 flex items-center justify-center shrink-0">
                  <AlertOctagon size={17} className="text-slate-600 dark:text-zinc-300" />
                </div>
                <div>
                  <p className="font-semibold text-[14px] text-slate-900 dark:text-white leading-tight">Report issue</p>
                  <p className="text-[12px] text-slate-400 dark:text-zinc-500 mt-0.5">Let us know if something is wrong</p>
                </div>
              </button>
            </div>

            <div className="px-4 pb-5 pt-1">
              <button
                onClick={() => setSelectedNotif(null)}
                className="w-full py-3 bg-black/[0.05] dark:bg-white/[0.07] hover:bg-black/[0.08] dark:hover:bg-white/[0.1] rounded-2xl font-semibold text-[14px] text-slate-800 dark:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`

      `}</style>
    </div>
  );
}
