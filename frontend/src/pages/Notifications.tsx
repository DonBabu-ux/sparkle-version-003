import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { getAvatarUrl } from '../utils/imageUtils';
import Navbar from '../components/Navbar';
import { User, Zap, MessageSquare, Users, ShoppingBag, Bell, Hand, ArrowLeft, CheckCircle2, Search, MoreHorizontal, X, BellOff, AlertOctagon, AtSign } from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import ModernOfflineState from '../components/ui/ModernOfflineState';

interface Notification {
  notification_id: string;
  type: string;
  title: string;
  content: string;
  created_at: string;
  is_read: number | boolean;
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

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeAll, setSeeAll] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<Notification | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await api.get('/notifications');
        if (response.data.success || response.data) {
          const fetchedNotifs = response.data.notifications || response.data || [];
          
          // Inject Mock Notifications for Preview (Council Signal Matrix)
          const mockNotifs: Notification[] = [
            {
              notification_id: 'mock-1',
              type: 'spark',
              title: 'New Spark',
              content: 'sparked your post!',
              actor_name: 'Sarah Chen',
              actor_username: 'sarah_node',
              actor_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
              created_at: new Date().toISOString(),
              is_read: false,
              target: { entity_type: 'post', entity_id: '1' }
            },
            {
              notification_id: 'mock-2',
              type: 'mention',
              title: 'Mention',
              content: 'mentioned you in a comment!',
              actor_name: 'David Matrix',
              actor_username: 'd_matrix',
              actor_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David',
              created_at: new Date(Date.now() - 3600000).toISOString(),
              is_read: false,
              target: { entity_type: 'mention', entity_id: '2' }
            },
            {
              notification_id: 'mock-3',
              type: 'marketplace',
              title: 'Marketplace',
              content: 'sent a trade offer!',
              actor_name: 'Bazaar Bot',
              actor_username: 'bazaar',
              actor_avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bazaar',
              created_at: new Date(Date.now() - 7200000).toISOString(),
              is_read: true,
              target: { entity_type: 'marketplace', entity_id: '3' }
            }
          ];

          setNotifications([...mockNotifs, ...fetchedNotifs]);
        }
      } catch (err) {
        console.error('Failed to fetch notifications:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => (n.notification_id === id || n.id === id) ? { ...n, is_read: 1 } : n));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      // Assuming a delete endpoint exists. If not, this simply removes it from UI for now.
      await api.delete(`/notifications/${id}`).catch(() => {});
      setNotifications(prev => prev.filter(n => (n.notification_id !== id && n.id !== id)));
      setSelectedNotif(null);
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const getBadgeColor = (type: string) => {
    switch(type) {
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
    switch(type) {
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
        alert(`You poked ${name || 'them'} back! 👋`);
    } catch (err) {
        console.error('Poke back failed:', err);
        alert('Failed to send poke. Try again later.');
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

  const newNotifs = notifications.filter(n => !n.is_read);
  const todayNotifs = notifications.filter(n => n.is_read && new Date(n.created_at).getTime() >= todayStart);
  const earlierNotifs = notifications.filter(n => n.is_read && new Date(n.created_at).getTime() < todayStart);

  const displayedNotifs = seeAll ? notifications : notifications.slice(0, 20);

  const renderSection = (title: string, list: Notification[]) => {
    // Only filter the 'displayedNotifs' so pagination applies globally across categories
    const items = list.filter(n => displayedNotifs.includes(n));
    if (items.length === 0) return null;

    return (
      <div className="mb-2">
        <h2 className="px-4 py-2 text-[17px] font-bold text-gray-900">{title}</h2>
        <div className="flex flex-col">
          {items.map(notif => renderNotification(notif))}
        </div>
      </div>
    );
  };

  const renderNotification = (notif: Notification) => {
    const isUnread = !notif.is_read;
    const actorUsername = notif.actor_username;
    const actorName = notif.actor_name;
    const displayName = actorName || actorUsername || notif.title || '';
    
    // Format timestamp nicely
    let formattedTimeStr = '';
    try {
      formattedTimeStr = new Date(notif.created_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      formattedTimeStr = '';
    }

    return (
      <div 
        key={notif.notification_id || notif.id}
        onClick={() => handleNotificationClick(notif)}
        className={`flex items-start gap-4 p-5 transition-colors cursor-pointer border-b border-black/5 dark:border-white/5 last:border-0 hover:bg-gray-50 dark:hover:bg-white/5 relative
          ${isUnread ? 'bg-[#ebf5ff] dark:bg-white/5' : 'bg-white dark:bg-[#101217]'}`}
      >
        {/* Left accent bar for unread item */}
        {isUnread && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-pink-500 to-purple-600" />
        )}

        {/* Actor Avatar or System icon wrapper */}
        <div className="relative shrink-0 mt-0.5">
          <img 
            src={notif.actor_avatar || '/uploads/avatars/default.png'} 
            onClick={(e) => {
              e.stopPropagation();
              if (actorUsername) navigate(`/profile/${actorUsername}`);
            }}
            className="w-14 h-14 rounded-full object-cover border border-black/5 dark:border-white/10 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all" 
            alt={displayName} 
          />
          <div className="absolute -bottom-1 -right-1 w-6.5 h-6.5 rounded-full flex items-center justify-center border-2 border-white dark:border-[#101217] shadow-sm text-white"
               style={{ backgroundColor: getBadgeColor(notif.type) }}>
            {getFacebookIcon(notif.type)}
          </div>
        </div>
        
        {/* Middle Area */}
        <div className="flex-1 min-w-0 pr-2 flex flex-col gap-0.5">
           <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              {/* Unread indicator dot */}
              {isUnread && (
                <span className="w-2.5 h-2.5 rounded-full bg-pink-500 shadow-md shadow-pink-500/50 flex-shrink-0" aria-label="Unread" />
              )}

              {/* Clickable username (700 weight, bold black, text-17px) */}
              {actorUsername || actorName ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (actorUsername) navigate(`/profile/${actorUsername}`);
                  }}
                  className="font-bold text-black dark:text-white hover:underline focus:outline-none text-left text-[17px] leading-tight"
                  style={{ fontWeight: 700 }}
                >
                  {displayName}
                </button>
              ) : (
                <span className="font-bold text-[17px] text-black dark:text-white" style={{ fontWeight: 700 }}>
                  {displayName}
                </span>
              )}
           </div>

           {/* Main action body / message (Bold, 13px, clickable, custom gray color) */}
           <button
             type="button"
             onClick={() => handleNotificationClick(notif)}
             className="text-left font-bold text-[13px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 mt-0.5 leading-normal focus:outline-none w-full"
           >
             {notif.content || notif.message}
           </button>
           
           {/* Action Buttons (Filled CTAs) */}
           {notif.type === 'poke' && (
             <button 
               onClick={(e) => { e.stopPropagation(); handlePokeBack(notif.actor_id, notif.actor_name); }}
               className="mt-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all active:scale-95 duration-150 inline-flex items-center gap-1 self-start"
             >
               Poke Back <span aria-hidden="true">→</span>
             </button>
           )}

           {notif.type === 'system_welcome' && (
             <div className="flex items-center gap-2 mt-2">
               <button 
                 onClick={(e) => { e.stopPropagation(); navigate('/explore'); }} 
                 className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-md transition-all active:scale-95 inline-flex items-center gap-1"
               >
                 Explore <span aria-hidden="true">→</span>
               </button>
               <button 
                 onClick={(e) => { e.stopPropagation(); navigate('/settings'); }} 
                 className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 px-4 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95"
               >
                 Settings
               </button>
             </div>
           )}

           {/* Timestamp (400 weight, xs) */}
           <span className="text-xs text-zinc-400 dark:text-zinc-500 mt-1.5 block" style={{ fontWeight: 400 }}>
             {formattedTimeStr}
           </span>
        </div>

        {/* Right thumbnail preview if related to story or post */}
        {notif.target && (notif.target.entity_type === 'post' || notif.target.entity_type === 'story') && (
          <div className="flex-shrink-0 self-start ml-1">
            <div 
              onClick={(e) => {
                e.stopPropagation();
                if (notif.target?.entity_type === 'post') navigate(`/post/${notif.target.entity_id}`);
                if (notif.target?.entity_type === 'story') navigate(`/stories/${notif.target.entity_id}`);
              }}
              className="w-14 h-14 bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden border border-black/5 dark:border-white/10 shadow-sm cursor-pointer hover:brightness-90 transition-all flex items-center justify-center text-zinc-400"
            >
              {notif.target.entity_type === 'story' ? '📖' : '🖼'}
            </div>
          </div>
        )}

        {/* More Actions Options Trigger */}
        <div className="shrink-0 flex items-center gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); setSelectedNotif(notif); }}
            className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors text-gray-500 dark:text-zinc-400"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex bg-app min-h-screen text-black font-sans">
      <Navbar />
      
      <main className="flex-1 lg:ml-72 pt-20 pb-20 max-w-2xl mx-auto w-full">
        {/* Sticky Header Card */}
        <header className="sticky top-[70px] z-30 bg-white dark:bg-[#101217] shadow-sm border-b border-black/5 dark:border-white/5 px-4 py-3">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                <ArrowLeft size={24} className="text-gray-900" />
              </button>
              <h1 className="text-[24px] font-bold text-gray-900 m-0 leading-none">Notifications</h1>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={markAllRead} 
                className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600"
                title="Mark all as read"
              >
                <CheckCircle2 size={24} />
              </button>
              <button 
                onClick={() => navigate('/search')} 
                className="p-2 -mr-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600"
                title="Search notifications"
              >
                <Search size={24} />
              </button>
            </div>
          </div>
        </header>

        {/* Notifications List Card */}
        <div className="bg-white dark:bg-[#101217] min-h-[500px]">
          <div className="flex flex-col">
            {loading ? (
               <div className="flex justify-center py-10">
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
                    className="w-full py-4 text-[#1877f2] font-semibold hover:bg-gray-50 transition-colors border-t border-gray-200/60"
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
        </div>
      </main>

      {/* Bottom Sheet Modal for Notification Options */}
      {selectedNotif && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedNotif(null)}>
          <div 
            className="bg-white w-full max-w-lg rounded-t-2xl p-4 transform transition-transform shadow-2xl" 
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
             <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-4"></div>
             
             <div className="flex flex-col items-center mb-6">
                <img src={getAvatarUrl(selectedNotif.actor_avatar, selectedNotif.actor_username)} className="w-16 h-16 rounded-full object-cover border border-gray-200 shadow-sm" alt="" />
                <p className="text-gray-900 text-[15px] mt-3 text-center px-4 leading-tight">
                   {selectedNotif.actor_name ? (
                      <><span className="font-semibold">{selectedNotif.actor_name}</span> {selectedNotif.content || selectedNotif.message}</>
                   ) : (
                      <><span className="font-semibold">{selectedNotif.title}</span> {selectedNotif.content || selectedNotif.message}</>
                   )}
                </p>
             </div>
             
             <div className="flex flex-col gap-1">
                <button 
                  onClick={() => deleteNotification(selectedNotif.notification_id || selectedNotif.id || '')} 
                  className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg text-left transition-colors"
                >
                   <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                     <X size={22} className="text-gray-700" />
                   </div>
                   <div className="flex flex-col">
                     <span className="font-semibold text-[16px] text-gray-900">Remove this notification</span>
                     <span className="text-[13px] text-gray-500">Won't show up in your updates anymore</span>
                   </div>
                </button>
                
                <button 
                  onClick={() => { alert('Notifications turned off.'); setSelectedNotif(null); }}
                  className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg text-left transition-colors"
                >
                   <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                     <BellOff size={20} className="text-gray-700" />
                   </div>
                   <div className="flex flex-col">
                     <span className="font-semibold text-[16px] text-gray-900">Turn off notifications about this post</span>
                     <span className="text-[13px] text-gray-500">Stop receiving updates for this activity</span>
                   </div>
                </button>

                <button 
                  onClick={() => { alert('Report sent to the team.'); setSelectedNotif(null); }}
                  className="flex items-center gap-3 p-3 hover:bg-gray-100 rounded-lg text-left transition-colors"
                >
                   <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                     <AlertOctagon size={20} className="text-gray-700" />
                   </div>
                   <div className="flex flex-col">
                     <span className="font-semibold text-[16px] text-gray-900">Report issue to Notifications Team</span>
                     <span className="text-[13px] text-gray-500">Let us know if something is wrong</span>
                   </div>
                </button>
             </div>
             
             <button 
               onClick={() => setSelectedNotif(null)} 
               className="mt-4 w-full py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-bold text-[15px] transition-colors"
             >
                Cancel
             </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.2s ease forwards; }
      `}</style>
    </div>
  );
}
