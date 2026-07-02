import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useNotificationStore } from '../store/notificationStore';
import { NotificationRenderer } from '../components/notifications/NotificationRenderer';
import { useNotificationActions } from '../hooks/useNotificationActions';
import { ArrowLeft, CheckCircle2, RefreshCw, Shield, Zap, Bell, Info } from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import type { NotificationCategory } from '../types/notification';

type TabType = 'all' | 'social' | 'security' | 'announcements';

export default function Notifications() {
  const navigate = useNavigate();
  const { notifications, loading, hasMore, fetchNotifications, fetchDelta } = useNotificationStore();
  const { markAllRead } = useNotificationActions();
  const [activeTab, setActiveTab] = useState<TabType>('all');

  useEffect(() => {
    // Initial fetch from store cache, and poll for deltas
    fetchNotifications(true, getCategoryFilter(activeTab));

    const interval = setInterval(() => {
      fetchDelta();
    }, 15000); // delta check every 15s

    return () => clearInterval(interval);
  }, [activeTab]);

  const getCategoryFilter = (tab: TabType): NotificationCategory | undefined => {
    if (tab === 'social') return 'social';
    if (tab === 'security') return 'security';
    if (tab === 'announcements') return 'announcement';
    return undefined;
  };

  const handleRefresh = () => {
    fetchNotifications(true, getCategoryFilter(activeTab));
  };

  const loadMore = () => {
    if (hasMore && !loading) {
      fetchNotifications(false, getCategoryFilter(activeTab));
    }
  };

  return (
    <div className="flex bg-zinc-50 dark:bg-zinc-950 min-h-screen text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-300">
      <Navbar />

      <main className="flex-1 lg:ml-72 pt-24 pb-24 max-w-3xl mx-auto w-full px-4 flex flex-col gap-6">
        {/* Header Section */}
        <header 
          className="flex flex-col gap-4 p-5 rounded-3xl bg-white/70 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800/80 backdrop-blur-xl shadow-sm"
          role="region"
          aria-label="Notification Header Controls"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate(-1)} 
                className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800/50 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors duration-150 active:scale-95"
                aria-label="Go back to previous screen"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white leading-none m-0">
                Notifications
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-850 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-650 dark:text-zinc-350 transition-all duration-150 active:scale-95 flex items-center justify-center"
                title="Refresh notifications"
                aria-label="Refresh updates list"
              >
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
              </button>
              
              <button 
                onClick={markAllRead} 
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black bg-pink-500 hover:bg-pink-600 text-white transition-all duration-150 shadow-md shadow-pink-500/20 active:scale-95"
                title="Mark all notifications as read"
                aria-label="Mark all items as read"
              >
                <CheckCircle2 size={15} />
                <span>Mark All Read</span>
              </button>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1.5 p-1 bg-zinc-100/80 dark:bg-zinc-950/60 rounded-2xl border border-zinc-200/40 dark:border-zinc-800/40">
            {(['all', 'social', 'security', 'announcements'] as TabType[]).map((tab) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`
                    flex-1 py-2 text-xs font-bold rounded-xl transition-all duration-200 capitalize select-none active:scale-[0.98]
                    ${active 
                      ? 'bg-white dark:bg-zinc-900 text-pink-500 shadow-sm border border-zinc-200/50 dark:border-zinc-850' 
                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200'}
                  `}
                >
                  {tab}
                </button>
              );
            })}
          </div>
        </header>

        {/* Unified Notifications list container */}
        <section 
          className="flex-1 min-h-[500px] bg-white/50 dark:bg-zinc-900/30 border border-zinc-200/60 dark:border-zinc-800/50 rounded-3xl p-4 flex flex-col backdrop-blur-xl shadow-inner relative overflow-hidden"
          role="feed"
          aria-label="Notifications list"
        >
          {loading && notifications.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-20">
              <Spinner size="medium" color="text-pink-500" />
            </div>
          ) : (
            <div className="flex-1 flex flex-col h-[600px]">
              <NotificationRenderer notifications={notifications} />
              
              {/* Pagination triggers */}
              {hasMore && !loading && (
                <button
                  onClick={loadMore}
                  className="w-full mt-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-850 border border-zinc-200 dark:border-zinc-800 text-xs font-black text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors select-none active:scale-98"
                >
                  Load More Notifications
                </button>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
