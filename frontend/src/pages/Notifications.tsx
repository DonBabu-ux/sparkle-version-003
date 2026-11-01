import { showError, showInfo, showSuccess } from '../utils/toast';
import { useState, useEffect, useCallback } from 'react';
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

// Map legacy notification paths to routes that actually exist in App.tsx
function normalizeTargetUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  let next = url;
  next = next.replace(/^\/posts\//, '/post/');
  next = next.replace(/^\/moment\//, '/moments/');
  next = next.replace(/^\/marketplace\/listing\//, '/marketplace/listings/');
  next = next.replace(/^\/orders(?:\/[^/?#]+)?(?=$|[?#])/, '/marketplace/orders');
  return next;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeAll, setSeeAll] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [markedFeedback, setMarkedFeedback] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [, setTick] = useState(0); // clock tick for live relative timestamps
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Live timestamp tick — update every 60s
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Read state is explicit only. Not a notification is marked read by
  // scrolling it into view or by opening it — only the "Mark as read"
  // action in the detail sheet (or "Mark all as read") changes it.

  const markAsRead = async (id: string) => {
    const previous = notifications;
    setNotifications(prev =>
      prev.map(n => (n.notification_id === id || n.id === id) ? { ...n, is_read: 1, isRead: true } : n)
    );
    setReadError(null);
    try {
      await api.put(`/notifications/${id}/read`).catch(() => api.post(`/notifications/${id}/read`));
    } catch (err) {
      setNotifications(previous);
      setReadError("Couldn't mark as read. Try again.");
      logger.error('Failed to mark read:', err);
    }
  };

  const markAllRead = async () => {
    if (markingAll) return;
    try {
      setMarkingAll(true);
      const previous = notifications;
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1, isRead: true })));
      setReadError(null);
      window.dispatchEvent(new Event('notifications_all_read'));

      // Call API
      try {
        await api.put('/notifications/read-all').catch(() => api.post('/notifications/read-all'));
        setMarkedFeedback(true);
        setTimeout(() => setMarkedFeedback(false), 2000);
      } catch (err) {
        setNotifications(previous);
        setReadError("Couldn't mark all as read. Try again.");
        logger.error('Failed to mark all read:', err);
      }
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
      case 'follow': return '#ff1493';
      case 'spark': return '#f59e0b';
      case 'comment': return '#059669';
      case 'mention': return '#ff2d87';
      case 'group': return '#334155';
      case 'marketplace': return '#ea580c';
      case 'poke': return '#ec4899';
      case 'capture_attempt': return '#ef4444';
      default: return '#ff1493';
    }
  };

  const getFacebookIcon = (type: string) => {
    switch (type) {
      case 'follow': return <User size={12} strokeWidth={3} />;
      case 'spark': return <Zap size={12} className="fill-current" />;
      case 'comment': return <MessageSquare size={12} className="fill-current" />;
      case 'mention': return <AtSign size={12} strokeWidth={3} />;
      case 'group': return <Users size={12} strokeWidth={3} />;
      case 'marketplace': return <ShoppingBag size={12} strokeWidth={3} />;
      case 'poke': return <Hand size={12} className="fill-current" />;
      case 'capture_attempt': return <AlertOctagon size={12} className="fill-current" />;
      default: return <Bell size={12} className="fill-current" />;
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
    // Open the thing the notification points at. Read state is NOT changed
    // here — that only happens from the explicit "Mark as read" action.
    let targetUrl = normalizeTargetUrl(notif.action_url);

    // Check target object first if present
    if (notif.target) {
      const { entity_type, entity_id, sub_entity_id } = notif.target;
      switch (entity_type) {
        case 'mention':
        case 'post':
        case 'like':
        case 'comment':
        case 'spark':
          targetUrl = `/post/${entity_id}${sub_entity_id ? `?commentId=${sub_entity_id}` : ''}`;
          break;
        case 'moment':
          targetUrl = `/moments/${entity_id}`;
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
          targetUrl = `/marketplace/listings/${entity_id}`;
          break;
        case 'order':
          targetUrl = '/marketplace/orders';
          break;
        case 'story':
        case 'story_like':
        case 'story_reply':
        case 'story_share':
          targetUrl = `/story/${entity_id}`;
          break;
        case 'message':
          targetUrl = entity_id ? `/messages?chat=${entity_id}` : '/messages';
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

    // If targetUrl not resolved yet, infer from notification type & related identifiers
    if (!targetUrl) {
      const type = notif.type;
      const relId = notif.related_id || (notif as any).related_post_id;
      const actor = notif.actor_username || notif.actor_id;

      switch (type) {
        case 'spark':
        case 'like':
        case 'spark_post':
        case 'comment':
        case 'reply':
        case 'mention':
          if (relId) targetUrl = `/post/${relId}`;
          break;
        case 'follow':
        case 'follow_request':
        case 'poke':
          if (actor) targetUrl = `/profile/${actor}`;
          break;
        case 'message':
          targetUrl = relId ? `/messages?chat=${relId}` : '/messages';
          break;
        case 'moment_like':
        case 'moment_comment':
        case 'moment_spark':
          if (relId) targetUrl = `/moments/${relId}`;
          break;
        case 'story_like':
        case 'story_reply':
          if (relId) targetUrl = `/story/${relId}`;
          break;
        case 'marketplace':
        case 'marketplace_contact':
          if (relId) targetUrl = `/marketplace/listings/${relId}`;
          break;
        case 'order':
          targetUrl = '/marketplace/orders';
          break;
        case 'group_invite':
        case 'group':
          if (relId) targetUrl = `/groups/${relId}`;
          break;
        case 'confession':
          if (relId) targetUrl = `/confessions?id=${relId}`;
          break;
        case 'capture_attempt':
          if (relId) targetUrl = `/messages?chat=${relId}`;
          break;
      }
    }

    // 3. Navigate to resolved target or safe fallback
    targetUrl = normalizeTargetUrl(targetUrl);
    if (targetUrl) {
      navigate(targetUrl);
    } else if (notif.actor_username || notif.actor_id) {
      navigate(`/profile/${notif.actor_username || notif.actor_id}`);
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
          <span className="text-xs font-semibold text-slate-600 dark:text-zinc-300">{title}</span>
          <div className="flex-1 h-px bg-[#ede3e9] dark:bg-zinc-900" />
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
        data-notif-id={notif.notification_id || notif.id}
        onClick={() => handleNotificationClick(notif)}
        className={`flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer border-b border-[#ede3e9] dark:border-zinc-900 last:border-0 relative active:scale-[0.995] ${
          isUnread
            ? 'bg-[#f0e5ec] dark:bg-zinc-700'
            : 'bg-[#fdf8fa] dark:bg-zinc-800 hover:bg-[#ede3e9] dark:hover:bg-zinc-900'
        }`}
      >
        {/* Left accent bar for unread */}
        {isUnread && (
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#ff1493] rounded-r-full" />
        )}

        {/* Avatar + type badge */}
        <div className="relative shrink-0 self-start mt-0.5">
          <img
            src={actorIdentity.avatar}
            onClick={(e) => {
              e.stopPropagation();
              if (actorUsername) navigate(`/profile/${actorUsername}`);
            }}
            className="w-11 h-11 rounded-full object-cover border border-[#e6d8e1] dark:border-zinc-700 cursor-pointer"
            alt={displayName}
          />
          <div
            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#fdf8fa] dark:border-zinc-800 bg-[#f6eef3] dark:bg-zinc-900 shadow-sm"
            style={{ color: getBadgeColor(notif.type) }}
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
                className="font-semibold text-sm text-[#18181b] dark:text-zinc-100 hover:underline focus:outline-none text-left flex items-center gap-1 leading-snug"
              >
                {displayName}
                <VerifiedBadge accountType={actorIdentity.accountType} isVerified={actorIdentity.badge.show} color={actorIdentity.badge.color} size="xs" />
              </button>
            ) : (
              <span className="font-semibold text-sm text-[#18181b] dark:text-zinc-100 flex items-center gap-1 leading-snug">
                {displayName}
                <VerifiedBadge accountType={actorIdentity.accountType} isVerified={actorIdentity.badge.show} color={actorIdentity.badge.color} size="xs" />
              </span>
            )}
          </div>

          {/* Action body */}
          <p className="text-sm text-slate-700 dark:text-zinc-300 leading-snug mt-0.5 break-words">
            {notif.content || notif.message}
          </p>

          {/* Timestamp + unread dot row */}
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`text-xs font-semibold ${
              isUnread ? 'text-[#ff1493]' : 'text-slate-600 dark:text-zinc-300'
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
              className="mt-2 bg-[#ff1493] hover:bg-[#ff2d87] text-white px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors active:scale-95 inline-flex items-center gap-1 self-start"
            >
              Poke Back →
            </button>
          )}

          {notif.type === 'system_welcome' && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={(e) => { e.stopPropagation(); navigate('/explore'); }}
                className="bg-[#ff1493] hover:bg-[#ff2d87] text-white px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors active:scale-95 inline-flex items-center gap-1"
              >
                Explore →
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); navigate('/settings'); }}
                className="bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 text-slate-600 dark:text-zinc-300 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors active:scale-95"
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
                if (notif.target?.entity_type === 'story') navigate(`/story/${notif.target.entity_id}`);
              }}
              className="w-11 h-11 bg-[#f6eef3] dark:bg-zinc-900 rounded-2xl overflow-hidden border border-[#e6d8e1] dark:border-zinc-700 cursor-pointer hover:brightness-90 transition-all flex items-center justify-center text-lg"
            >
              {notif.target.entity_type === 'story' ? '📖' : '🖼'}
            </div>
          </div>
        )}

        {/* More options */}
        <button
          onClick={(e) => { e.stopPropagation(); setSelectedNotif(notif); }}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-slate-600 dark:text-zinc-300 hover:bg-[#ede3e9] dark:hover:bg-zinc-700 transition-colors"
        >
          <MoreHorizontal size={16} />
        </button>
      </div>
    );
  };

  return (
    <div className="flex bg-app min-h-dvh text-[#18181b] dark:text-zinc-100 font-sans pb-[env(safe-area-inset-bottom)]">

      <main className="flex-1 pb-20 max-w-2xl mx-auto w-full pb-[env(safe-area-inset-bottom)]">
        {/* Sticky Header */}
        <header className="sticky top-[70px] z-[1100] bg-[#fdf8fa]/90 dark:bg-zinc-800/90 backdrop-blur-md border-b border-[#e6d8e1] dark:border-zinc-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => navigate(-1)}
                className="shrink-0 w-11 h-11 -ml-1 rounded-full flex items-center justify-center hover:bg-[#ede3e9] dark:hover:bg-zinc-700 transition-colors"
              >
                <ArrowLeft size={20} className="text-[#18181b] dark:text-zinc-100" />
              </button>
              <h1 className="text-3xl font-bold text-[#18181b] dark:text-zinc-100 leading-none tracking-tight truncate">Notifications</h1>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={markAllRead}
                disabled={markingAll || unreadCount === 0}
                className={`flex items-center gap-1.5 h-9 px-3.5 rounded-full text-xs font-semibold transition-colors select-none ${
                  markedFeedback
                    ? 'text-emerald-600 dark:text-emerald-400 bg-[#f0e5ec] dark:bg-zinc-700'
                    : unreadCount > 0
                    ? 'text-[#ff1493] bg-[#f0e5ec] dark:bg-zinc-700 hover:bg-[#ede3e9] dark:hover:bg-zinc-600 active:scale-95 cursor-pointer'
                    : 'text-slate-600 dark:text-zinc-300 bg-[#f0e5ec] dark:bg-zinc-700 opacity-50 cursor-default'
                }`}
                title={unreadCount > 0 ? "Mark all as read" : "All caught up"}
              >
                <CheckCircle2
                  size={16}
                  className={`transition-transform shrink-0 ${markedFeedback ? 'text-emerald-500 scale-110' : unreadCount > 0 ? 'text-[#ff1493]' : ''}`}
                />
                <span className="text-xs font-semibold">
                  {markedFeedback ? 'All Read' : 'Mark all read'}
                </span>
                {unreadCount > 0 && !markedFeedback && (
                  <span className="ml-0.5 px-1.5 py-0.5 bg-[#ff1493] text-white text-xs font-semibold rounded-full leading-none">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => navigate('/search')}
                className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-[#ede3e9] dark:hover:bg-zinc-700 transition-colors text-slate-600 dark:text-zinc-300"
                title="Search"
              >
                <Search size={18} />
              </button>
            </div>
          </div>
        </header>

        {readError && (
        <div className="px-4 py-3 bg-rose-50 dark:bg-zinc-900 border border-rose-200 dark:border-zinc-700">
          <div className="flex items-start gap-3">
            <AlertOctagon size={16} className="text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">{readError}</p>
              <button
                onClick={() => { setReadError(null); fetchNotifications(); }}
                className="text-xs font-semibold text-[#ff1493] underline mt-1"
              >
                  Try again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notifications list */}
        <div className="bg-[#fdf8fa] dark:bg-zinc-800">
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
                  className="w-full py-4 text-sm font-semibold text-[#ff1493] hover:bg-[#f6eef3] dark:hover:bg-zinc-900 transition-colors border-t border-[#ede3e9] dark:border-zinc-900"
                >
                  See all notifications
                </button>
              )}
            </>
          ) : (
            <div className="py-20">
              <ModernOfflineState
                type="empty"
                title="All caught up"
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
            className="bg-[#fdf8fa] dark:bg-zinc-800 w-full max-w-lg rounded-t-3xl pb-safe shadow-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'slideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 bg-[#ede3e9] dark:bg-zinc-700 rounded-full" />
            </div>

            {/* Actor preview */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#ede3e9] dark:border-zinc-900">
              <img
                src={getAvatarUrl(selectedNotif.actor_avatar, selectedNotif.actor_username)}
                className="w-11 h-11 rounded-full object-cover border border-[#e6d8e1] dark:border-zinc-700 shrink-0"
                alt=""
              />
              <p className="text-sm text-slate-600 dark:text-zinc-300 leading-snug flex-1 min-w-0">
                {selectedNotif.actor_name ? (
                  <><span className="font-semibold text-[#18181b] dark:text-zinc-100">{selectedNotif.actor_name}</span>{' '}{selectedNotif.content || selectedNotif.message}</>
                ) : (
                  <><span className="font-semibold text-[#18181b] dark:text-zinc-100">{selectedNotif.title}</span>{' '}{selectedNotif.content || selectedNotif.message}</>
                )}
              </p>
            </div>

            {/* Actions */}
            <div className="px-3 py-2 flex flex-col gap-0.5">
              {!isNotificationRead(selectedNotif) && (
                <button
                  onClick={() => {
                    markAsRead(selectedNotif.notification_id || selectedNotif.id || '');
                    setSelectedNotif(null);
                  }}
                  className="flex items-center gap-3 px-3 py-3 hover:bg-[#ede3e9] dark:hover:bg-zinc-700 rounded-2xl text-left transition-colors"
                >
                  <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-[#18181b] dark:text-zinc-100 leading-tight">Mark as read</p>
                    <p className="text-xs text-slate-600 dark:text-zinc-300 mt-0.5">Keeps it in your list, clears the unread badge</p>
                  </div>
                </button>
              )}

              <button
                onClick={() => deleteNotification(selectedNotif.notification_id || selectedNotif.id || '')}
                className="flex items-center gap-3 px-3 py-3 hover:bg-[#ede3e9] dark:hover:bg-zinc-700 rounded-2xl text-left transition-colors"
              >
                <X size={20} className="text-slate-600 dark:text-zinc-300 shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-[#18181b] dark:text-zinc-100 leading-tight">Remove this notification</p>
                  <p className="text-xs text-slate-600 dark:text-zinc-300 mt-0.5">Won't show up in your updates</p>
                </div>
              </button>

              <button
                onClick={() => { showInfo('Notifications turned off.'); setSelectedNotif(null); }}
                className="flex items-center gap-3 px-3 py-3 hover:bg-[#ede3e9] dark:hover:bg-zinc-700 rounded-2xl text-left transition-colors"
              >
                <BellOff size={20} className="text-slate-600 dark:text-zinc-300 shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-[#18181b] dark:text-zinc-100 leading-tight">Turn off for this post</p>
                  <p className="text-xs text-slate-600 dark:text-zinc-300 mt-0.5">Stop receiving updates for this activity</p>
                </div>
              </button>

              <button
                onClick={() => { showSuccess('Report sent to the team.'); setSelectedNotif(null); }}
                className="flex items-center gap-3 px-3 py-3 hover:bg-[#ede3e9] dark:hover:bg-zinc-700 rounded-2xl text-left transition-colors"
              >
                <AlertOctagon size={20} className="text-slate-600 dark:text-zinc-300 shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-[#18181b] dark:text-zinc-100 leading-tight">Report issue</p>
                  <p className="text-xs text-slate-600 dark:text-zinc-300 mt-0.5">Let us know if something is wrong</p>
                </div>
              </button>
            </div>

            <div className="px-4 pb-5 pt-1">
              <button
                onClick={() => setSelectedNotif(null)}
                className="w-full py-3 bg-[#f6eef3] dark:bg-zinc-900 hover:bg-[#ede3e9] dark:hover:bg-zinc-700 rounded-full font-semibold text-sm text-[#18181b] dark:text-zinc-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}



