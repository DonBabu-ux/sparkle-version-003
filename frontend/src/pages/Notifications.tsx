import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { User, Zap, MessageSquare, Users, ShoppingBag, Bell, Bird, Hand } from 'lucide-react';

interface Notification {
  notification_id: string;
  type: string;
  title: string;
  content: string;
  created_at: string;
  is_read: number | boolean;
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
      setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, is_read: 1 } : n));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'follow': return <User size={20} className="text-blue-500" />;
      case 'spark': return <Zap size={20} className="text-yellow-500 fill-yellow-500" />;
      case 'comment': return <MessageSquare size={20} className="text-emerald-500" />;
      case 'group': return <Users size={20} className="text-purple-500" />;
      case 'marketplace': return <ShoppingBag size={20} className="text-rose-500" />;
      case 'poke': return <Hand size={20} className="text-indigo-500" />;
      default: return <Bell size={20} className="text-slate-400" />;
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
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="max-w-3xl mx-auto px-4 pt-32 md:pt-40 pb-32">
        <div className="flex justify-between items-center mb-12">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-100 flex items-center justify-center text-white">
               <Bell size={24} />
             </div>
             <div>
               <h1 className="text-2xl font-black text-slate-800 tracking-tight">Timeline Pulses</h1>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Your cosmic footprint</p>
             </div>
           </div>
           
           <button onClick={() => {}} className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-all">Mark all read</button>
        </div>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          {loading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="animate-pulse p-4 border-b border-slate-100 flex gap-4 last:border-0">
                <div className="w-10 h-10 bg-slate-100 rounded-full"></div>
                <div className="flex-1 space-y-2 mt-1">
                   <div className="h-3 bg-slate-100 rounded w-1/3"></div>
                   <div className="h-2 bg-slate-100 rounded w-full"></div>
                </div>
              </div>
            ))
          ) : notifications.length > 0 ? (
            notifications.map((notif: any) => {
              if (notif.type === 'system_welcome') {
                return (
                  <div 
                    key={notif.notification_id || notif.id}
                    onClick={() => markAsRead(notif.notification_id || notif.id)}
                    className={`flex gap-4 p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer ${notif.is_read ? 'opacity-70' : 'bg-[#F5F9FF]'}`}
                  >
                    <div className="flex-shrink-0 bg-gradient-to-br from-[#FF3D6D] to-[#FF7B00] w-10 h-10 rounded-xl flex items-center justify-center mt-1 shadow-md shadow-pink-200">
                      <span className="text-white text-[22px] leading-none">✨</span>
                    </div>
                    
                    <div className="flex-1">
                       <div className="flex justify-between items-start mb-1">
                          <h4 className="font-semibold text-slate-900 text-[15px] tracking-tight">{notif.title}</h4>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{new Date(notif.created_at).toLocaleDateString()}</span>
                       </div>
                       <p className="text-[#6e6e6e] text-[13px] font-medium leading-relaxed">{notif.content}</p>
                       
                       <div className="mt-3 flex items-center gap-3">
                           <button onClick={(e) => { e.stopPropagation(); markAsRead(notif.notification_id || notif.id); navigate('/search'); }} className="text-[#0095f6] text-[13px] font-bold hover:underline focus:outline-none">Explore</button>
                           <span className="text-slate-300 font-bold">•</span>
                           <button onClick={(e) => { e.stopPropagation(); markAsRead(notif.notification_id || notif.id); navigate('/connect'); }} className="text-[#0095f6] text-[13px] font-bold hover:underline focus:outline-none">Follow creators</button>
                           <span className="text-slate-300 font-bold">•</span>
                           <button onClick={(e) => { e.stopPropagation(); markAsRead(notif.notification_id || notif.id); navigate('/onboarding/about'); }} className="text-[#0095f6] text-[13px] font-bold hover:underline focus:outline-none">Learn more</button>
                       </div>
                    </div>
                  </div>
                );
              }

              return (
              <div 
                key={notif.notification_id || notif.id} 
                onClick={() => markAsRead(notif.notification_id || notif.id)}
                className={`flex gap-4 p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors cursor-pointer ${notif.is_read ? 'opacity-70' : 'bg-indigo-50/20'}`}
              >
                <div className="flex-shrink-0 bg-slate-100 w-12 h-12 rounded-full flex items-center justify-center mt-1">
                  {getIcon(notif.type)}
                </div>
                
                <div className="flex-1">
                   <div className="flex justify-between items-start mb-1">
                      <h4 className="font-black text-slate-800 text-sm tracking-tight">{notif.title || (notif.type === 'poke' ? 'You were poked!' : 'Notification')}</h4>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{new Date(notif.created_at).toLocaleDateString()}</span>
                   </div>
                   <p className="text-slate-500 text-xs font-semibold leading-relaxed">{notif.content || notif.message}</p>
                   
                   {notif.type === 'poke' && (
                       <div className="mt-3">
                           <button 
                               onClick={(e) => { e.stopPropagation(); handlePokeBack(notif.actor_id || notif.related_user?.id, notif.actor_name || notif.related_user?.name); }}
                               className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black hover:bg-slate-800 transition-colors shadow-md"
                           >
                               <span>Poke Back</span>
                               <span className="text-lg leading-none transform -scale-x-100 grayscale contrast-125 brightness-0 inline-block">👉</span>
                           </button>
                       </div>
                   )}
                </div>

                {!notif.is_read && (
                  <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full my-auto shadow-lg shadow-indigo-200 flex-shrink-0"></div>
                )}
              </div>
            )})
          ) : (
            <div className="py-24 flex flex-col items-center justify-center">
               <Bird size={48} className="text-slate-200 mb-4" />
               <h3 className="text-xl font-bold text-slate-600">The sector is quiet</h3>
               <p className="text-xs text-slate-400 mt-2 font-black uppercase tracking-widest">No pulses detected in this sweep</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
