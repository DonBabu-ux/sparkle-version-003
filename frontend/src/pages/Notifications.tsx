import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { User, Zap, MessageSquare, Users, ShoppingBag, Bell, Hand, Orbit, ArrowLeft } from 'lucide-react';

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
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

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
      await api.post(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => (n.notification_id === id || n.id === id) ? { ...n, is_read: 1 } : n));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'follow': return <User size={18} className="text-blue-500" strokeWidth={3} />;
      case 'spark': return <Zap size={18} className="text-amber-500 fill-amber-500" strokeWidth={3} />;
      case 'comment': return <MessageSquare size={18} className="text-emerald-500" strokeWidth={3} />;
      case 'group': return <Users size={18} className="text-purple-500" strokeWidth={3} />;
      case 'marketplace': return <ShoppingBag size={18} className="text-primary" strokeWidth={3} />;
      case 'poke': return <Hand size={18} className="text-indigo-500" strokeWidth={3} />;
      default: return <Bell size={18} className="text-black/20" strokeWidth={3} />;
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

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black font-sans overflow-x-hidden">
      <Navbar />
      
      <div className="fixed top-[-10%] right-[-5%] w-[600px] h-[600px] bg-red-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-4xl mx-auto w-full">
        <header className="flex flex-col md:flex-row items-center justify-between gap-10 mb-16 animate-fade-in">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-white/60 backdrop-blur-xl border border-white rounded-[20px] shadow-sm flex items-center justify-center">
              <Bell size={24} className="text-primary" strokeWidth={3} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-black tracking-tight italic">Activity</h1>
              <p className="text-[11px] font-bold text-black/20 uppercase tracking-widest mt-1">Village Updates</p>
            </div>
          </div>
          
          <button 
            onClick={markAllRead} 
            className="px-8 py-3.5 rounded-2xl bg-white/60 border border-white font-bold text-[11px] uppercase tracking-wider text-black/40 hover:text-black hover:bg-white transition-all active:scale-95 shadow-sm"
          >
            Clear Channel
          </button>
        </header>

        <div className="flex flex-col gap-5 relative z-10 pb-40 animate-fade-in">
          {loading ? (
             <div className="flex justify-center py-20">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
             </div>
          ) : notifications.length > 0 ? (
            notifications.map((notif: Notification) => (
              <div 
                key={notif.notification_id || notif.id}
                onClick={() => markAsRead(notif.notification_id || notif.id)}
                className={`group transition-all duration-500 cursor-pointer p-6 rounded-[32px] border flex items-start gap-5 backdrop-blur-3xl
                  ${!notif.is_read 
                    ? 'border-primary/20 bg-white shadow-xl shadow-primary/5' 
                    : 'border-white bg-white/60 opacity-80 hover:bg-white hover:opacity-100 shadow-sm'}`}
              >
                <div className="relative shrink-0 mt-0.5">
                  <img src={notif.actor_avatar || '/uploads/avatars/default.png'} className="w-14 h-14 rounded-[20px] object-cover border border-white shadow-sm" alt="" />
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-full shadow-lg flex items-center justify-center border border-black/5 group-hover:scale-110 transition-transform">
                    {getIcon(notif.type)}
                  </div>
                </div>
                
                <div className="flex-1 pt-1">
                   <div className="flex justify-between items-start mb-2">
                      <h4 className="font-black text-black text-base tracking-tight italic leading-none uppercase group-hover:text-primary transition-colors">
                        {notif.title || (notif.type === 'poke' ? 'Someone poked you' : 'New Update')}
                      </h4>
                      <span className="text-[9px] font-bold text-black/20 uppercase tracking-widest bg-black/5 px-3 py-1 rounded-full shrink-0">
                        {new Date(notif.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                   </div>
                   <p className="text-black font-medium text-sm leading-relaxed mb-4">
                     {notif.content || notif.message}
                   </p>
                   
                   {notif.type === 'poke' && (
                     <button 
                       onClick={(e) => { e.stopPropagation(); handlePokeBack(notif.actor_id, notif.actor_name); }}
                       className="flex items-center gap-2 bg-primary text-white px-8 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all active:scale-95"
                     >
                       Poke Back <Hand size={14} strokeWidth={3} />
                     </button>
                   )}

                   {notif.type === 'system_welcome' && (
                     <div className="flex items-center gap-4 mt-4">
                       <button onClick={(e) => { e.stopPropagation(); navigate('/explore'); }} className="text-primary font-bold text-[10px] uppercase tracking-widest hover:underline">Explore</button>
                       <div className="w-1 h-1 bg-black/5 rounded-full"></div>
                       <button onClick={(e) => { e.stopPropagation(); navigate('/settings'); }} className="text-primary font-bold text-[10px] uppercase tracking-widest hover:underline">Settings</button>
                     </div>
                   )}
                </div>

                {!notif.is_read && (
                  <div className="shrink-0 w-2.5 h-2.5 bg-primary rounded-full mt-2 animate-pulse shadow-sm shadow-primary/20"></div>
                )}
              </div>
            ))
          ) : (
            <div className="py-40 flex flex-col items-center justify-center text-center gap-10 animate-fade-in bg-white/40 border border-white rounded-[48px] shadow-inner">
               <Orbit size={100} strokeWidth={1} className="text-black/5" />
               <div className="space-y-4">
                 <h3 className="text-3xl font-black text-black/10 italic">Quiet Airwaves.</h3>
                 <p className="text-[11px] font-bold text-black/20 uppercase tracking-widest max-w-xs mx-auto">No signals detected at the moment.</p>
               </div>
               <button onClick={() => navigate('/dashboard')} className="flex items-center gap-3 px-10 py-4 bg-primary text-white shadow-xl shadow-primary/20 rounded-2xl font-bold text-sm hover:scale-105 transition-all active:scale-95">
                 <ArrowLeft size={18} /> Back to Pulse
               </button>
            </div>
          )}
        </div>
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
}
