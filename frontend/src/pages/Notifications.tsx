import { useState, useEffect } from 'react';
import api from '../api/api';
import Navbar from '../components/Navbar';

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

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const response = await api.get('/notifications');
        if (response.data.success) {
          setNotifications(response.data.notifications);
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
      await api.post(`/notifications/read/${id}`);
      setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, is_read: 1 } : n));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'follow': return '👤';
      case 'spark': return '✨';
      case 'comment': return '💬';
      case 'group': return '🤝';
      case 'marketplace': return '🛍️';
      default: return '🔔';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="max-w-3xl mx-auto px-4 pb-20">
        <div className="flex justify-between items-center mb-8">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-100 flex items-center justify-center text-white text-xl">🔔</div>
             <div>
               <h1 className="text-2xl font-black text-slate-800 tracking-tight">Timeline Pulses</h1>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Your cosmic footprint</p>
             </div>
           </div>
           
           <button className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100 transition-all">Mark all read</button>
        </div>

        <div className="space-y-4">
          {loading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="animate-pulse bg-white p-6 rounded-3xl border border-slate-100 flex gap-4">
                <div className="w-10 h-10 bg-slate-100 rounded-xl"></div>
                <div className="flex-1 space-y-2">
                   <div className="h-3 bg-slate-100 rounded w-1/3"></div>
                   <div className="h-2 bg-slate-100 rounded w-full"></div>
                </div>
              </div>
            ))
          ) : notifications.length > 0 ? (
            notifications.map(notif => (
              <div 
                key={notif.notification_id} 
                onClick={() => markAsRead(notif.notification_id)}
                className={`premium-card p-6 border-white bg-white/80 transition-all cursor-pointer group flex gap-5 ${notif.is_read ? 'opacity-70' : 'shadow-xl shadow-indigo-50/50 scale-[1.01] border-indigo-100'}`}
              >
                <div className="text-2xl flex-shrink-0 bg-slate-50 w-12 h-12 rounded-2xl flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                  {getIcon(notif.type)}
                </div>
                
                <div className="flex-1">
                   <div className="flex justify-between items-start mb-1">
                      <h4 className="font-black text-slate-800 text-sm tracking-tight">{notif.title}</h4>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{new Date(notif.created_at).toLocaleDateString()}</span>
                   </div>
                   <p className="text-slate-500 text-xs font-semibold leading-relaxed">{notif.content}</p>
                </div>

                {!notif.is_read && (
                  <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full my-auto shadow-lg shadow-indigo-200"></div>
                )}
              </div>
            ))
          ) : (
            <div className="py-20 flex flex-col items-center justify-center bg-white/40 rounded-[40px] border-2 border-dashed border-slate-200">
               <div className="text-5xl mb-4 grayscale opacity-20">🕊️</div>
               <h3 className="text-xl font-bold text-slate-600">The sector is quiet</h3>
               <p className="text-xs text-slate-400 mt-2 font-black uppercase tracking-widest">No pulses detected in this sweep</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
