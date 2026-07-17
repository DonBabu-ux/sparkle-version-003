import React, { useMemo, useState, useRef, useEffect } from 'react';
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { isToday, isYesterday, subDays, isAfter } from 'date-fns';
import type { SparkleNotification } from '../../types/notification';
import { NotificationCard, GroupedNotificationCard } from './NotificationCard';
import { BellOff } from 'lucide-react';

interface NotificationRendererProps {
  notifications: SparkleNotification[];
}

type FlatItem =
  | { type: 'header'; key: string; label: string }
  | { type: 'card'; key: string; notification: SparkleNotification }
  | { type: 'grouped-card'; key: string; notifications: SparkleNotification[] };

export const NotificationRenderer: React.FC<NotificationRendererProps> = ({ notifications }) => {
  const listRef = useRef<List>(null);
  
  // Track keys of expanded grouped notification cards
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  // Reset list layout cache whenever expanded keys change
  useEffect(() => {
    if (listRef.current) {
      listRef.current.resetAfterIndex(0);
    }
  }, [expandedKeys]);

  const toggleGroupExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Group notifications within the same time bucket
  const groupBucket = (list: SparkleNotification[]): FlatItem[] => {
    const groups: Record<string, SparkleNotification[]> = {};
    const orderedKeys: string[] = [];

    list.forEach((n) => {
      const postId = n.related_post?.id || '';
      // Group by notification type + target post/object
      const groupKey = `${n.type}_${postId}`;
      if (!groups[groupKey]) {
        groups[groupKey] = [];
        orderedKeys.push(groupKey);
      }
      groups[groupKey].push(n);
    });

    const result: FlatItem[] = [];
    orderedKeys.forEach((key) => {
      const group = groups[key];
      const groupableTypes = ['like', 'follow', 'comment', 'mention', 'story'];
      
      if (group.length > 1 && groupableTypes.includes(group[0].type.toLowerCase())) {
        result.push({
          type: 'grouped-card',
          key: `grouped-${key}-${group[0].id}`,
          notifications: group,
        });
      } else {
        group.forEach((n) => {
          result.push({
            type: 'card',
            key: `card-${n.id}`,
            notification: n,
          });
        });
      }
    });

    return result;
  };

  // Transform and group notifications into a flat list of headers, cards, and grouped-cards
  const flatItems = useMemo(() => {
    if (notifications.length === 0) return [];

    const todayList: SparkleNotification[] = [];
    const yesterdayList: SparkleNotification[] = [];
    const thisWeekList: SparkleNotification[] = [];
    const olderList: SparkleNotification[] = [];

    const oneWeekAgo = subDays(new Date(), 7);

    notifications.forEach((n) => {
      const date = new Date(n.createdAt);
      if (isToday(date)) {
        todayList.push(n);
      } else if (isYesterday(date)) {
        yesterdayList.push(n);
      } else if (isAfter(date, oneWeekAgo)) {
        thisWeekList.push(n);
      } else {
        olderList.push(n);
      }
    });

    const items: FlatItem[] = [];

    if (todayList.length > 0) {
      items.push({ type: 'header', key: 'hdr-today', label: 'Today' });
      items.push(...groupBucket(todayList));
    }

    if (yesterdayList.length > 0) {
      items.push({ type: 'header', key: 'hdr-yesterday', label: 'Yesterday' });
      items.push(...groupBucket(yesterdayList));
    }

    if (thisWeekList.length > 0) {
      items.push({ type: 'header', key: 'hdr-this-week', label: 'This Week' });
      items.push(...groupBucket(thisWeekList));
    }

    if (olderList.length > 0) {
      items.push({ type: 'header', key: 'hdr-older', label: 'Older' });
      items.push(...groupBucket(olderList));
    }

    return items;
  }, [notifications]);

  if (notifications.length === 0) {
    return (
      <div 
        className="flex flex-col items-center justify-center py-20 px-4 text-center select-none animate-fade-in"
        role="region"
        aria-label="Empty notifications"
      >
        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-pink-500/10 to-purple-500/10 flex items-center justify-center text-pink-500 mb-6 shadow-inner animate-pulse-subtle">
          <BellOff size={36} />
        </div>
        <h2 role="heading" aria-level={2} className="text-xl font-bold text-zinc-900 dark:text-white mb-2">
          All quiet for now
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-sm text-sm sm:text-base leading-relaxed">
          When people like your posts, spark moments, or Sparkle sends official updates, they'll show up here.
        </p>
      </div>
    );
  }

  // Row Renderer for virtualization
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = flatItems[index];

    if (item.type === 'header') {
      return (
        <div 
          style={{ ...style, display: 'flex', alignItems: 'center' }} 
          className="px-2"
          role="presentation"
        >
          <h4 
            role="heading" 
            aria-level={4} 
            className="text-xs font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-500 select-none"
          >
            {item.label}
          </h4>
          <div className="flex-1 h-[1px] bg-zinc-100 dark:bg-zinc-800/80 ml-3" />
        </div>
      );
    }

    if (item.type === 'grouped-card') {
      const isExpanded = expandedKeys.has(item.key);
      return (
        <div style={{ ...style, paddingBottom: '12px' }} className="px-1">
          {/* We wrap GroupedNotificationCard with our toggle logic */}
          <div onClick={() => toggleGroupExpanded(item.key)}>
            <GroupedNotificationCard notifications={item.notifications} />
          </div>
        </div>
      );
    }

    return (
      <div style={{ ...style, paddingBottom: '12px' }} className="px-1">
        <NotificationCard notification={item.notification} />
      </div>
    );
  };

  // Dynamically estimate row height based on component sizes: headers are small, cards are larger
  const getItemSize = (index: number) => {
    const item = flatItems[index];
    if (item.type === 'header') return 40;
    
    if (item.type === 'grouped-card') {
      const isExpanded = expandedKeys.has(item.key);
      if (isExpanded) {
        // Collapsed height (~96px) + each sub-actor item (~44px) + "Hide" padding/row (~40px)
        return 96 + (item.notifications.length * 44) + 40;
      }
      return 96;
    }

    // Add extra padding if there are CTA buttons present
    const hasActions = item.notification.actions && item.notification.actions.length > 0;
    return hasActions ? 172 : 124;
  };

  return (
    <div className="w-full h-full" role="feed" aria-label="Notifications feed">
      <AutoSizer>
        {({ height, width }) => (
          <List
            ref={listRef}
            height={height}
            itemCount={flatItems.length}
            itemSize={getItemSize}
            width={width}
            className="scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800"
          >
            {Row}
          </List>
        )}
      </AutoSizer>
    </div>
  );
};

