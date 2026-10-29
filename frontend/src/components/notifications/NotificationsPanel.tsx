import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { BellOff, CheckCheck } from 'lucide-react';
import api from '../../api/api';
import { getAvatarUrl } from '../../utils/imageUtils';
import { logger } from '../../utils/logger';

interface BellNotification {
  notification_id: string;
  type?: string;
  title?: string;
  body?: string;
  content?: string;
  message?: string;
  created_at?: string;
  is_read?: number | boolean;
  isRead?: boolean;
  actor_avatar?: string;
  actor_username?: string;
  actor_name?: string;
  thumbnail_url?: string;
  action_url?: string;
}

interface NotificationsPanelProps {
  open: boolean;
  onClose: () => void;
  anchorRect: DOMRect | null;
}

// Same legacy-path remaps the notifications page uses (/posts/ → /post/ etc.)
function normalizeTargetUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  let next = url;
  next = next.replace(/^\/posts\//, '/post/');
  next = next.replace(/^\/moment\//, '/moments/');
  next = next.replace(/^\/marketplace\/listing\//, '/marketplace/listings/');
  next = next.replace(/^\/orders(?:\/[^/?#]+)?(?=$|[?#])/, '/marketplace/orders');
  return next;
}

function relativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 45) return 'just now';
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.round(diff / 86400)}d ago`;
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

const isRead = (n: BellNotification) =>
  n.is_read === 1 || n.is_read === true || n.isRead === true;

/**
 * Instagram/Facebook-style floating notifications menu: a popover panel
 * anchored to the bell trigger instead of navigating away to a full page.
 * The full page stays reachable via "See all".
 */
export default function NotificationsPanel({ open, onClose, anchorRect }: NotificationsPanelProps) {
  const [items, setItems] = useState<BellNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/notifications');
      const raw = res.data.notifications || res.data || [];
      const list: BellNotification[] = (Array.isArray(raw) ? raw : []).slice(0, 20).map((n: any) => ({
        ...n,
        notification_id: n.notification_id || n.id,
        isRead: !!(n.is_read === 1 || n.is_read === true || n.isRead === true),
      }));
      setItems(list);
    } catch (err) {
      logger.error('Failed to fetch notifications panel:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) fetchItems();
  }, [open, fetchItems]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !anchorRect) return null;

  const unread = items.filter(n => !isRead(n)).length;

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setItems(prev => prev.map(n => ({ ...n, is_read: 1, isRead: true })));
      window.dispatchEvent(new CustomEvent('notifications_all_read'));
    } catch (err) {
      logger.error('Failed to mark all read:', err);
    }
  };

  const handleRowClick = async (n: BellNotification) => {
    if (!isRead(n)) {
      try { await api.put(`/notifications/${n.notification_id}/read`); } catch { /* non-blocking */ }
      setItems(prev => prev.map(x => x.notification_id === n.notification_id ? { ...x, is_read: 1, isRead: true } : x));
      window.dispatchEvent(new CustomEvent('notifications_updated'));
    }
    const target = normalizeTargetUrl(n.action_url);
    onClose();
    if (target) navigate(target);
  };

  // Anchor the panel beside the bell; flip to the left edge if it would overflow.
  const PANEL_W = 360;
  const PANEL_H = Math.min(520, window.innerHeight - 96);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = anchorRect.right + 12;
  if (vw < 640) {
    left = 12;
  } else if (left + PANEL_W > vw - 12) {
    left = Math.max(12, anchorRect.left - PANEL_W - 12);
  }
  const top = vw < 640 ? 64 : Math.max(12, Math.min(anchorRect.top - 8, vh - 12 - PANEL_H));
  const width = vw < 640 ? vw - 24 : PANEL_W;

  return createPortal(
    <>
      <div className="fixed inset-0 z-(--z-sheet)" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Notifications"
        className="fixed z-(--z-modal) bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ left, top, width, maxHeight: PANEL_H }}
      >
        <div className="flex items-center justify-between px-4 h-12 border-b border-[#ede3e9] dark:border-zinc-900 shrink-0">
          <h2 className="text-sm font-bold text-[#18181b] dark:text-zinc-100">Notifications</h2>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-[#ff2d87] transition-colors"
            >
              <CheckCheck size={14} />
              Mark all as read
            </button>
          )}
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            [1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                <div className="w-9 h-9 rounded-full bg-[#f0e5ec] dark:bg-zinc-700 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-2/3 bg-[#f0e5ec] dark:bg-zinc-700 rounded" />
                  <div className="h-2.5 w-1/3 bg-[#f0e5ec] dark:bg-zinc-700 rounded" />
                </div>
              </div>
            ))
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <BellOff size={28} className="text-slate-600 dark:text-zinc-300 mb-2" />
              <p className="text-sm font-semibold text-[#18181b] dark:text-zinc-100">No notifications yet</p>
              <p className="text-xs text-slate-600 dark:text-zinc-300 mt-0.5">Likes, comments and follows will show up here.</p>
            </div>
          ) : (
            items.map(n => {
              const title = n.title || n.type || 'Notification';
              const body = n.body || n.content || n.message || '';
              return (
                <button
                  key={n.notification_id}
                  onClick={() => handleRowClick(n)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f6eef3] dark:hover:bg-zinc-700/50 transition-colors text-left border-b border-[#ede3e9] dark:border-zinc-900 last:border-0"
                >
                  <img
                    src={getAvatarUrl(n.actor_avatar) || '/uploads/avatars/no-profile.png'}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover shrink-0 border border-[#e6d8e1] dark:border-zinc-700"
                  />
                  <div className="min-w-0 flex-1">
                    <p className={`text-[13px] leading-snug truncate ${isRead(n) ? 'text-slate-600 dark:text-zinc-300' : 'font-semibold text-[#18181b] dark:text-zinc-100'}`}>
                      {title}
                    </p>
                    {body && <p className="text-xs text-slate-600 dark:text-zinc-300 truncate mt-0.5">{body}</p>}
                    <p className="text-[11px] text-slate-600 dark:text-zinc-300 mt-0.5">{relativeTime(n.created_at)}</p>
                  </div>
                  {n.thumbnail_url ? (
                    <img src={n.thumbnail_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 border border-[#e6d8e1] dark:border-zinc-700" />
                  ) : (
                    !isRead(n) && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>

        <button
          onClick={() => { onClose(); navigate('/notifications'); }}
          className="h-10 w-full text-xs font-bold text-slate-600 dark:text-zinc-300 hover:text-[#18181b] dark:hover:text-zinc-100 border-t border-[#ede3e9] dark:border-zinc-900 transition-colors shrink-0"
        >
          See all
        </button>
      </div>
    </>,
    document.body
  );
}
