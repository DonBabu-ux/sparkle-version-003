import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import type { SparkleNotification } from '../../types/notification';
import { useNotificationActions } from '../../hooks/useNotificationActions';
import {
  ShieldAlert, AlertTriangle, Heart, MessageCircle, AtSign,
  UserPlus, BookOpen, DollarSign, BadgeCheck, Bell, ChevronDown, ChevronUp
} from 'lucide-react';

// ─── Colored icon map ─────────────────────────────────────────────────────
const TYPE_ICON_MAP: Record<string, { Icon: React.ElementType; color: string }> = {
  like:     { Icon: Heart,         color: 'text-red-500' },
  comment:  { Icon: MessageCircle, color: 'text-blue-500' },
  mention:  { Icon: AtSign,        color: 'text-purple-500' },
  follow:   { Icon: UserPlus,      color: 'text-emerald-500' },
  story:    { Icon: BookOpen,      color: 'text-orange-500' },
  payment:  { Icon: DollarSign,    color: 'text-amber-500' },
  verified: { Icon: BadgeCheck,    color: 'text-blue-400' },
  default:  { Icon: Bell,          color: 'text-zinc-400' },
};

function getTypeIcon(type: string) {
  return TYPE_ICON_MAP[type?.toLowerCase()] || TYPE_ICON_MAP.default;
}

function formattedTime(createdAt: string): string {
  try { return formatDistanceToNow(new Date(createdAt), { addSuffix: true }); }
  catch { return ''; }
}

function getPriorityClasses(priority: string, isRead: boolean): string {
  if (priority === 'critical') return 'border-l-4 border-red-500 bg-red-50/70 dark:bg-red-950/20';
  if (priority === 'high')     return 'border-l-4 border-amber-500 bg-amber-50/70 dark:bg-amber-950/10';
  if (priority === 'low')      return 'opacity-85 hover:opacity-100 bg-gray-50/50 dark:bg-zinc-900/30';
  return isRead
    ? 'bg-white dark:bg-zinc-900/40'
    : 'bg-gradient-to-r from-pink-50/30 to-purple-50/30 dark:from-pink-950/5 dark:to-purple-950/5';
}

function PriorityBadge({ priority }: { priority: string }) {
  if (priority === 'critical') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
      <ShieldAlert size={12} /> Critical Alert
    </span>
  );
  if (priority === 'high') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
      <AlertTriangle size={12} /> High Priority
    </span>
  );
  return null;
}

// bg utility helper — derive a bg class from the text color class
function iconBgClass(color: string): string {
  return color.replace('text-', 'bg-');
}

// ─── Main NotificationCard ────────────────────────────────────────────────
interface NotificationCardProps {
  notification: SparkleNotification;
}

export const NotificationCard: React.FC<NotificationCardProps> = ({ notification }) => {
  const { handleNotificationClick, handleActionClick } = useNotificationActions();
  const navigate = useNavigate();
  const { Icon: TypeIcon, color: iconColor } = getTypeIcon(notification.type);

  const avatarUrl     = notification.related_user?.avatar || notification.actor_avatar || '/uploads/avatars/default.png';
  const actorUsername = notification.related_user?.username || notification.actor_username;
  const actorName     = notification.related_user?.name     || notification.actor_name;
  const displayName   = actorName || actorUsername || '';
  const thumbnailUrl  = notification.thumbnail_url || notification.related_post?.thumbnail_url;
  const isSystem      = !notification.senderId || notification.senderId === 'd75fe3b5-7a45-4581-ab13-91934d8b54de';

  return (
    <div
      role="article"
      aria-label={`${notification.priority} notification: ${notification.title}. ${notification.body}`}
      onClick={() => handleNotificationClick(notification)}
      className={`
        notification-card relative flex gap-4 p-5 rounded-xl transition-all duration-200 cursor-pointer overflow-hidden select-none
        border border-zinc-100 dark:border-zinc-800/80 backdrop-blur-md shadow-sm hover:shadow-md
        ${getPriorityClasses(notification.priority, notification.isRead)}
      `}
    >
      {/* Ripple overlay */}
      <div className="absolute inset-0 bg-zinc-600/5 opacity-0 active:opacity-100 transition-opacity pointer-events-none" />

      {/* Unread accent bar */}
      {!notification.isRead && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-pink-500 to-purple-600" />
      )}

      {/* ── Left: Avatar or system icon ── */}
      <div className="flex-shrink-0 relative">
        {!isSystem ? (
          <img
            src={avatarUrl}
            alt={displayName || 'Sparkle Creator'}
            onClick={(e) => { e.stopPropagation(); if (actorUsername) navigate(`/profile/${actorUsername}`); }}
            className="w-14 h-14 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shadow-sm cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all"
          />
        ) : (
          <div className={`w-14 h-14 rounded-full flex items-center justify-center shadow-inner ${
            notification.isOfficial
              ? 'bg-gradient-to-tr from-pink-500 to-purple-600 text-white'
              : 'bg-zinc-100 dark:bg-zinc-800'
          }`}>
            <TypeIcon size={24} className={notification.isOfficial ? 'text-white' : iconColor} />
          </div>
        )}

        {/* Colored type badge */}
        {!isSystem && (
          <span className={`absolute -bottom-1 -right-1 w-5.5 h-5.5 ${iconBgClass(iconColor)} rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center shadow`}>
            <TypeIcon size={11} className="text-white" />
          </span>
        )}

        {notification.isOfficial && (
          <span className="absolute -bottom-1 -right-1 w-5.5 h-5.5 bg-purple-600 text-white rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-black shadow">
            ✨
          </span>
        )}
      </div>

      {/* ── Middle: Content ── */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">

        {/* Header: unread dot + name + badges */}
        <div className="flex flex-wrap items-center gap-1.5 justify-between">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {/* Unread dot — inline before username */}
            {!notification.isRead && (
              <span className="w-2.5 h-2.5 rounded-full bg-pink-500 shadow shadow-pink-500/50 flex-shrink-0" aria-label="Unread" />
            )}

            {displayName ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); if (actorUsername) navigate(`/profile/${actorUsername}`); }}
                className="font-bold text-black dark:text-white text-[17px] hover:underline focus:outline-none leading-tight truncate max-w-[200px]"
                style={{ fontWeight: 700 }}
              >
                {displayName}
              </button>
            ) : (
              <h3 role="heading" aria-level={4} className="text-[17px] text-zinc-900 dark:text-white truncate max-w-[200px]" style={{ fontWeight: 700 }}>
                {notification.title}
              </h3>
            )}

            {notification.isOfficial && (
              <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                Official
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
            <PriorityBadge priority={notification.priority} />
            <span className="text-[10px] capitalize px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {notification.category}
            </span>
          </div>
        </div>

        {/* Body — 13px, bold, clickable action message */}
        <button
          type="button"
          onClick={() => handleNotificationClick(notification)}
          className="text-left font-bold text-[13px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 leading-normal focus:outline-none w-full"
        >
          {notification.body}
        </button>

        {/* CTA Buttons */}
        {notification.actions && notification.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
            {notification.actions.map((act, index) => (
              <button
                key={index}
                onClick={(e) => handleActionClick(e, notification, act)}
                className={`
                  inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg transition-all active:scale-95 duration-150 shadow-sm
                  ${act.style === 'primary'
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white shadow-md'
                    : act.style === 'secondary'
                    ? 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700'
                    : 'bg-transparent text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/30'}
                `}
                aria-label={`Action: ${act.label}`}
              >
                {act.label}
                {act.style === 'primary' && <span aria-hidden="true">→</span>}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp — 400 weight, xs */}
        <span className="text-xs text-zinc-400 dark:text-zinc-500 mt-1.5 self-end" style={{ fontWeight: 400 }}>
          {formattedTime(notification.createdAt)}
        </span>
      </div>

      {/* ── Right: Thumbnail ── */}
      {thumbnailUrl && (
        <div className="flex-shrink-0 self-start ml-1">
          <img
            src={thumbnailUrl}
            alt="Content preview"
            onClick={(e) => { e.stopPropagation(); if (notification.action_url) navigate(notification.action_url); }}
            className="w-14 h-14 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 shadow-sm cursor-pointer hover:brightness-90 transition-all"
          />
        </div>
      )}
    </div>
  );
};

// ─── Grouped Card ─────────────────────────────────────────────────────────
interface GroupedNotificationCardProps {
  notifications: SparkleNotification[];
}

export const GroupedNotificationCard: React.FC<GroupedNotificationCardProps> = ({ notifications }) => {
  const [expanded, setExpanded] = useState(false);
  const { handleNotificationClick } = useNotificationActions();
  const navigate = useNavigate();

  if (notifications.length === 0) return null;
  if (notifications.length === 1) return <NotificationCard notification={notifications[0]} />;

  const first  = notifications[0];
  const second = notifications[1];
  const { Icon: TypeIcon, color: iconColor } = getTypeIcon(first.type);
  const isUnread = notifications.some(n => !n.isRead);

  const firstName  = first.related_user?.name  || first.actor_name  || first.related_user?.username || first.actor_username || 'Someone';
  const secondName = second ? (second.related_user?.name || second.actor_name || second.related_user?.username || second.actor_username || null) : null;
  const othersCount = notifications.length - (secondName ? 2 : 1);

  const summaryText = [
    firstName,
    secondName,
    othersCount > 0 ? `and ${othersCount} other${othersCount > 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(', ');

  const thumbnailUrl = first.thumbnail_url || first.related_post?.thumbnail_url;

  return (
    <div className={`
      notification-card relative rounded-xl border border-zinc-100 dark:border-zinc-800/80 backdrop-blur-md shadow-sm hover:shadow-md
      transition-all duration-200 overflow-hidden select-none
      ${isUnread
        ? 'bg-gradient-to-r from-pink-50/30 to-purple-50/30 dark:from-pink-950/5 dark:to-purple-950/5'
        : 'bg-white dark:bg-zinc-900/40'}
    `}>
      {isUnread && <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-pink-500 to-purple-600" />}

      {/* Summary row */}
      <div className="flex gap-3 p-4 cursor-pointer" onClick={() => handleNotificationClick(first)}>
        <div className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 shadow-inner">
          <TypeIcon size={22} className={iconColor} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {isUnread && <span className="w-2 h-2 rounded-full bg-pink-500 shadow shadow-pink-500/50 flex-shrink-0" />}
            <p className="text-sm text-zinc-900 dark:text-white leading-snug break-words" style={{ fontWeight: 500 }}>
              <span style={{ fontWeight: 700 }} className="text-black dark:text-white">{summaryText}</span>
              {' '}
              {first.body}
            </p>
          </div>
          <span className="text-[11px] text-zinc-400 dark:text-zinc-500" style={{ fontWeight: 400 }}>
            {formattedTime(first.createdAt)}
          </span>
        </div>

        {thumbnailUrl && (
          <img src={thumbnailUrl} alt="Content preview"
            className="flex-shrink-0 w-14 h-14 rounded-lg object-cover border border-zinc-200 dark:border-zinc-700 shadow-sm self-start"
          />
        )}

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
          className="flex-shrink-0 self-start p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {/* Expanded actor list */}
      {expanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-50 dark:divide-zinc-800/60">
          {notifications.map((n) => {
            const username = n.related_user?.username || n.actor_username;
            const name     = n.related_user?.name     || n.actor_name     || username;
            const avatar   = n.related_user?.avatar   || n.actor_avatar   || '/uploads/avatars/default.png';
            return (
              <div
                key={n.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer"
                onClick={() => { if (username) navigate(`/profile/${username}`); }}
              >
                <img src={avatar} alt={name || ''} className="w-8 h-8 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 flex-shrink-0" />
                <span className="text-sm text-black dark:text-white truncate" style={{ fontWeight: 700 }}>{name}</span>
                {username && (
                  <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate ml-1" style={{ fontWeight: 400 }}>@{username}</span>
                )}
              </div>
            );
          })}
          <div className="px-4 py-2 flex justify-end">
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-semibold transition-colors"
            >
              Hide
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
