import React, { useMemo } from 'react';
import { List } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { isToday, isYesterday, subDays, isAfter } from 'date-fns';
import type { SparkleNotification } from '../../types/notification';
import { NotificationCard } from './NotificationCard';
import { BellOff } from 'lucide-react';

interface NotificationRendererProps {
  notifications: SparkleNotification[];
}

type FlatItem =
  | { type: 'header'; key: string; label: string }
  | { type: 'card'; key: string; notification: SparkleNotification };

export const NotificationRenderer: React.FC<NotificationRendererProps> = ({ notifications }) => {
  
  // Transform and group notifications into a flat list of headers and cards
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
      todayList.forEach(n => items.push({ type: 'card', key: `card-${n.id}`, notification: n }));
    }

    if (yesterdayList.length > 0) {
      items.push({ type: 'header', key: 'hdr-yesterday', label: 'Yesterday' });
      yesterdayList.forEach(n => items.push({ type: 'card', key: `card-${n.id}`, notification: n }));
    }

    if (thisWeekList.length > 0) {
      items.push({ type: 'header', key: 'hdr-this-week', label: 'This Week' });
      thisWeekList.forEach(n => items.push({ type: 'card', key: `card-${n.id}`, notification: n }));
    }

    if (olderList.length > 0) {
      items.push({ type: 'header', key: 'hdr-older', label: 'Older' });
      olderList.forEach(n => items.push({ type: 'card', key: `card-${n.id}`, notification: n }));
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
    
    // Add extra padding if there are CTA buttons present
    const hasActions = item.notification.actions && item.notification.actions.length > 0;
    return hasActions ? 172 : 124;
  };

  return (
    <div className="w-full h-full" role="feed" aria-label="Notifications feed">
      <AutoSizer>
        {({ height, width }) => (
          <List
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
