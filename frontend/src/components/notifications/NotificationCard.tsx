import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import type { SparkleNotification } from '../../types/notification';
import { getNotificationIcon } from '../../utils/iconMapper';
import { renderRichText } from '../../utils/richTextRenderer';
import { useNotificationActions } from '../../hooks/useNotificationActions';
import { ShieldAlert, AlertTriangle, Info, Bell } from 'lucide-react';

interface NotificationCardProps {
  notification: SparkleNotification;
}

export const NotificationCard: React.FC<NotificationCardProps> = ({ notification }) => {
  const { handleNotificationClick, handleActionClick } = useNotificationActions();
  const IconComponent = getNotificationIcon(notification.icon || notification.type);

  const getPriorityClasses = () => {
    switch (notification.priority) {
      case 'critical':
        return 'border-l-4 border-red-500 bg-red-50/70 dark:bg-red-950/20';
      case 'high':
        return 'border-l-4 border-amber-500 bg-amber-50/70 dark:bg-amber-950/10';
      case 'low':
        return 'opacity-85 hover:opacity-100 bg-gray-50/50 dark:bg-zinc-900/30';
      case 'normal':
      default:
        return 'border-l-4 border-transparent hover:border-zinc-300 dark:hover:border-zinc-700';
    }
  };

  const getPriorityBadge = () => {
    if (notification.priority === 'critical') {
      return (
        <span 
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
          aria-label="Critical priority security alert"
        >
          <ShieldAlert size={12} />
          Critical Alert
        </span>
      );
    }
    if (notification.priority === 'high') {
      return (
        <span 
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          aria-label="High priority notice"
        >
          <AlertTriangle size={12} />
          High Priority
        </span>
      );
    }
    return null;
  };

  const formattedTime = () => {
    try {
      return formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true });
    } catch (e) {
      return '';
    }
  };

  // Safe avatar loader
  const avatarUrl = notification.related_user?.avatar || notification.actor_avatar || '/uploads/avatars/default.png';

  return (
    <div
      role="article"
      aria-label={`${notification.priority} notification: ${notification.title}. ${notification.body}`}
      onClick={() => handleNotificationClick(notification)}
      className={`
        notification-card relative flex gap-4 p-4 rounded-xl transition-all duration-200 cursor-pointer overflow-hidden select-none
        border border-zinc-100 dark:border-zinc-800/80 backdrop-blur-md shadow-sm hover:shadow-md
        ${getPriorityClasses()}
        ${!notification.isRead ? 'unread font-medium bg-gradient-to-r from-pink-50/30 to-purple-50/30 dark:from-pink-950/5 dark:to-purple-950/5' : 'bg-white dark:bg-zinc-900/40'}
      `}
    >
      {/* Visual Ripple Overlay Effect */}
      <div className="absolute inset-0 bg-zinc-600/5 opacity-0 active:opacity-100 transition-opacity pointer-events-none" />

      {/* Unread Accent Left Border Glow */}
      {!notification.isRead && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-pink-500 to-purple-600" />
      )}

      {/* Left Area: User Avatar or Icon */}
      <div className="flex-shrink-0 relative">
        {notification.senderId && notification.senderId !== 'd75fe3b5-7a45-4581-ab13-91934d8b54de' ? (
          <img
            src={avatarUrl}
            alt={notification.related_user?.name || 'Sparkle Creator'}
            className="w-12 h-12 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 shadow-sm"
          />
        ) : (
          <div className={`
            w-12 h-12 rounded-full flex items-center justify-center shadow-inner
            ${notification.isOfficial 
              ? 'bg-gradient-to-tr from-pink-500 to-purple-600 text-white' 
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'}
          `}>
            <IconComponent size={22} className="animate-pulse-subtle" />
          </div>
        )}

        {/* Brand System Tag/Badge Icon overlay */}
        {notification.isOfficial && (
          <span className="absolute -bottom-1 -right-1 w-5 h-5 bg-purple-600 text-white rounded-full border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-black shadow">
            ✨
          </span>
        )}
      </div>

      {/* Middle/Right Area: Notification Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {/* Top Header: Title, Category Badge, Priority Badge & Unread Indicator */}
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <h3 role="heading" aria-level={4} className="font-bold text-zinc-900 dark:text-white text-sm sm:text-base truncate max-w-[200px] sm:max-w-xs">
              {notification.title}
            </h3>

            {/* Official App Tag */}
            {notification.isOfficial && (
              <span className="text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                Official
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {getPriorityBadge()}
            
            {/* Category tag */}
            <span className="text-[10px] capitalize px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {notification.category}
            </span>

            {/* Unread indicator dot */}
            {!notification.isRead && (
              <span 
                className="w-2.5 h-2.5 rounded-full bg-pink-500 shadow-md shadow-pink-500/50" 
                aria-hidden="true" 
              />
            )}
          </div>
        </div>

        {/* Body Text (Rich Entity linked text) */}
        <p className="text-zinc-600 dark:text-zinc-300 text-sm leading-relaxed break-words">
          {renderRichText(notification.body, notification.entities)}
        </p>

        {/* CTAs/Action Buttons */}
        {notification.actions && notification.actions.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
            {notification.actions.map((act, index) => (
              <button
                key={index}
                onClick={(e) => handleActionClick(e, notification, act)}
                className={`
                  px-4 py-1.5 text-xs font-bold rounded-lg transition-all active:scale-95 duration-150 shadow-sm
                  ${act.style === 'primary' 
                    ? 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-extrabold shadow-md' 
                    : act.style === 'secondary'
                    ? 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                    : 'bg-transparent text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/30'}
                `}
                aria-label={`Action: ${act.label}`}
              >
                {act.label}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1.5 self-end">
          {formattedTime()}
        </span>
      </div>
    </div>
  );
};
