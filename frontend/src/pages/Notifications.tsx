import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { User, Zap, MessageSquare, Users, ShoppingBag, Bell, Hand, ArrowLeft, CheckCircle2, Search, MoreHorizontal, X, BellOff, AlertOctagon } from 'lucide-react';

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
  message?: string;
  id?: string;
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
          setNotifications(fetchedNotifs);
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
      case 'group': return '#8b5cf6';
      case 'marketplace': return '#14b8a6';
      case 'poke': return '#6366f1';
      default: return '#1877f2';
    }
  };

  const getFacebookIcon = (type: string) => {
    switch(type) {
      case 'follow': return <User size={12} className="text-white" strokeWidth={3} />;
      case 'spark': return <Zap size={12} className="text-white fill-white" />;
      case 'comment': return <MessageSquare size={12} className="text-white fill-white" />;
      case 'group': return <Users size={12} className="text-white" strokeWidth={3} />;
      case 'marketplace': return <ShoppingBag size={12} className="text-white" strokeWidth={3} />;
      case 'poke': return <Hand size={12} className="text-white fill-white" />;
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

  const renderNotification = (notif: Notification) => (
    <div 
      key={notif.notification_id || notif.id}
      onClick={() => markAsRead(notif.notification_id || notif.id)}
      className={`flex items-start gap-3 p-3 transition-colors cursor-pointer border-b border-gray-100 last:border-0 hover:bg-gray-50
        ${!notif.is_read ? 'bg-[#ebf5ff]' : 'bg-white'}`}
    >
      <div className="relative shrink-0 mt-1">
        <img src={notif.actor_avatar || '/uploads/avatars/default.png'} className="w-[56px] h-[56px] rounded-full object-cover border border-black/5" alt="" />
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm"
             style={{ backgroundColor: getBadgeColor(notif.type) }}>
          {getFacebookIcon(notif.type)}
        </div>
      </div>
      
      <div className="flex-1 pt-1.5 min-w-0 pr-2">
         <div className="text-[15px] leading-tight text-gray-900 break-words">
            {notif.actor_name ? (
              <>
                <span className="font-semibold">{notif.actor_name}</span>{' '}
                <span>{notif.content || notif.message}</span>
              </>
            ) : (
              <>
                <span className="font-semibold">{notif.title}</span>{' '}
                <span>{notif.content || notif.message}</span>
              </>
            )}
         </div>
         
         <span className={`text-[13px] font-medium mt-1 block ${!notif.is_read ? 'text-[#1877f2]' : 'text-gray-500'}`}>
           {new Date(notif.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
         </span>
         
         {notif.type === 'poke' && (
           <button 
             onClick={(e) => { e.stopPropagation(); handlePokeBack(notif.actor_id, notif.actor_name); }}
             className="mt-2 bg-gray-200 text-black px-4 py-1.5 rounded-md text-[14px] font-semibold hover:bg-gray-300 transition-colors"
           >
             Poke Back
           </button>
         )}

         {notif.type === 'system_welcome' && (
           <div className="flex items-center gap-2 mt-2">
             <button onClick={(e) => { e.stopPropagation(); navigate('/explore'); }} className="bg-blue-100 text-blue-600 px-4 py-1.5 rounded-md text-[14px] font-semibold hover:bg-blue-200">Explore</button>
             <button onClick={(e) => { e.stopPropagation(); navigate('/settings'); }} className="bg-gray-200 text-black px-4 py-1.5 rounded-md text-[14px] font-semibold hover:bg-gray-300">Settings</button>
           </div>
         )}
      </div>

      <div className="shrink-0 flex items-center gap-2 mt-2">
        {!notif.is_read && (
          <div className="w-3 h-3 bg-[#1877f2] rounded-full mr-1"></div>
        )}
        <button 
          onClick={(e) => { e.stopPropagation(); setSelectedNotif(notif); }}
          className="p-2 rounded-full hover:bg-gray-200 transition-colors text-gray-500"
        >
          <MoreHorizontal size={20} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex bg-[#f0f2f5] min-h-screen text-black font-sans">
      <Navbar />
      
      <main className="flex-1 lg:ml-72 pt-20 pb-20 max-w-2xl mx-auto w-full">
        {/* Sticky Header Card */}
        <header className="sticky top-[70px] z-30 bg-white shadow-sm border-b border-gray-200/60 px-4 py-3">
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
        <div className="bg-white min-h-[500px]">
          <div className="flex flex-col">
            {loading ? (
               <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
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
              <div className="py-20 flex flex-col items-center justify-center text-center text-gray-500">
                 <Bell size={48} className="text-gray-300 mb-4" />
                 <h3 className="text-xl font-bold text-gray-900">No notifications</h3>
                 <p className="text-[15px] mt-1">We'll let you know when something happens.</p>
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
                <img src={selectedNotif.actor_avatar || '/uploads/avatars/default.png'} className="w-16 h-16 rounded-full object-cover border border-gray-200 shadow-sm" alt="" />
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
