import { showError, showInfo, showSuccess } from '../utils/toast';
import { confirmDialog } from '../store/dialogStore';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import { Calendar, Users, QrCode, Power, Settings, Plus, Check, X, Trash2, ArrowLeft, Shield } from 'lucide-react';
import Spinner from '../components/ui/Spinner';
import { logger } from '../utils/logger';

interface Event {
  event_id: string;
  title: string;
  campus?: string;
  is_public: boolean;
  total_rsvps?: number;
  total_reservations?: number;
  total_attended?: number;
  max_attendees: number;
  requirements?: string;
}

interface Attendee {
  user_id: string;
  username: string;
  avatar_url?: string;
  status: string;
}

export default function EventsAdmin() {
  const { user } = useUserStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetEventId = searchParams.get('id');

  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    location: '',
    event_date: '',
    capacity: '',
    requirements: '',
    campus: user?.campus || 'Main Campus'
  });

  const [activeEventAttendees, setActiveEventAttendees] = useState<string | null>(null);
  const [attendeesList, setAttendeesList] = useState<Attendee[]>([]);

  const fetchManagedEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/events?filter=managed');
      setEvents(res.data.events || res.data || []);
      
      if (targetEventId) {
        setTimeout(() => {
          document.getElementById(`mgmt-card-${targetEventId}`)?.scrollIntoView({ behavior: 'smooth' });
        }, 500);
      }
    } catch (err) {
      logger.error('Failed to fetch admin events', err);
    } finally {
      setLoading(false);
    }
  }, [targetEventId]);

  useEffect(() => { fetchManagedEvents(); }, [fetchManagedEvents]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/events', {
        ...formData,
        start_time: formData.event_date,
        max_attendees: parseInt(formData.capacity) || 0,
        is_public: true,
        event_type: 'campus_event'
      });
      showInfo('Event is now Live!');
      setFormData({ title: '', location: '', event_date: '', capacity: '', requirements: '', campus: user?.campus || 'Main Campus' });
      setShowCreateForm(false);
      fetchManagedEvents();
    } catch {
      showError('Failed to broadcast event.');
    }
  };

  const toggleEventStatus = async (id: string, is_public: boolean) => {
    try {
      await api.patch(`/events/${id}/status`, { is_public: !is_public });
      fetchManagedEvents();
    } catch {
      showError('Failed to update event status');
    }
  };

  const deleteEvent = async (id: string) => {
    if (!await confirmDialog('Permanently remove this event?')) return;
    try {
      await api.delete(`/events/${id}`);
      fetchManagedEvents();
    } catch {
      showError('Failed to delete event');
    }
  };

  const loadAttendees = async (id: string) => {
    if (activeEventAttendees === id) {
      setActiveEventAttendees(null);
      return;
    }
    try {
      const res = await api.get(`/events/${id}/attendees`);
      setAttendeesList(res.data || []);
      setActiveEventAttendees(id);
    } catch {
      showError('Failed to load attendees');
    }
  };

  const processRSVP = async (eventId: string, userId: string, status: string) => {
    try {
      await api.patch(`/events/${eventId}/rsvp/${userId}`, { status });
      loadAttendees(eventId); 
    } catch {
      showError('Failed to process RSVP');
    }
  };

  const refreshAttendees = async (id: string) => {
    try {
      const res = await api.get(`/events/${id}/attendees`);
      setAttendeesList(res.data || []);
    } catch {
      /* keep the list already on screen */
    }
  };

  const checkInAttendee = async (eventId: string, userId: string) => {
    try {
      await api.post('/events/checkin', { userId, eventId });
      showSuccess('Attendee checked in');
      refreshAttendees(eventId);
      fetchManagedEvents();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Failed to check in attendee';
      showError(msg);
    }
  };

  return (
    <div className="flex bg-[#f8e7ed] dark:bg-zinc-900 min-h-dvh text-[#18181b] dark:text-zinc-100 overflow-x-hidden font-sans pb-20">

      <main className="flex-1 p-4 md:p-8 relative z-10 max-w-4xl mx-auto w-full">
        
        {/* Compact Header */}
        <header className="mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => navigate('/events')}
              className="w-8 h-8 flex items-center justify-center bg-[#fdf8fa] dark:bg-zinc-800 rounded-full shadow-sm border border-[#e6d8e1] dark:border-zinc-700 text-slate-600 dark:text-zinc-300 hover:text-[#18181b] dark:hover:text-zinc-100 active:scale-90 transition-all"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 shadow-sm">
              <Shield size={12} strokeWidth={3} className="text-primary" />
              <span className="text-xs font-semibold text-[#18181b] dark:text-zinc-100 tracking-tight">Event control</span>
            </div>
          </div>
          
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-[#18181b] dark:text-zinc-100 tracking-tight leading-none mb-1">
                Campus <span className="text-primary">Life.</span>
              </h1>
              <p className="text-xs text-slate-600 dark:text-zinc-400 font-medium">Manage campus events</p>
            </div>
            <div className="flex gap-2">
               <button 
                 onClick={() => setShowScanner(!showScanner)}
                 className="w-9 h-9 flex items-center justify-center bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 active:scale-90 transition-all"
               >
                 <QrCode size={16} />
               </button>
               <button 
                 onClick={() => setShowCreateForm(!showCreateForm)}
                 className="w-9 h-9 flex items-center justify-center bg-primary text-white rounded-xl shadow-lg shadow-primary/20 active:scale-90 transition-all"
               >
                 <Plus size={16} />
               </button>
            </div>
          </div>
        </header>

        {/* Check-In - Compact Overlay */}
        {showScanner && (
          <div className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-3xl p-4 mb-6 border border-emerald-500/30 shadow-sm animate-fade-in">
             <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-bold text-[#18181b] dark:text-zinc-100 flex items-center gap-2">
                  <QrCode size={16} className="text-emerald-500" /> Manual check-in
                </h3>
                <button onClick={() => setShowScanner(false)} className="text-slate-600 dark:text-zinc-300 hover:text-[#18181b] dark:hover:text-zinc-100 transition-colors"><X size={16} /></button>
             </div>
             <select
               value={activeEventAttendees ?? ''}
               onChange={(e) => { const id = e.target.value; if (id) loadAttendees(id); }}
               className="w-full h-11 bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-xl px-4 text-sm text-[#18181b] dark:text-zinc-100 outline-none focus:border-emerald-500 transition-colors mb-3"
             >
               <option value="">Select event…</option>
               {events.map((e) => (
                 <option key={e.event_id} value={e.event_id}>{e.title}</option>
               ))}
             </select>
             {activeEventAttendees ? (
               (() => {
                 const eligible = attendeesList.filter((a) => a.status === 'accepted' || a.status === 'attended');
                 return eligible.length === 0 ? (
                    <p className="text-[13px] text-slate-600 dark:text-zinc-400 font-medium text-center py-4">No accepted guests yet</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto no-scrollbar">
                      {eligible.map((a) => (
                        <div key={a.user_id} className="bg-[#f6eef3] dark:bg-zinc-900 p-2 rounded-xl flex justify-between items-center">
                          <span className="text-[13px] font-semibold text-[#18181b] dark:text-zinc-100">{a.username}</span>
                          {a.status === 'attended' ? (
                            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">Present</span>
                          ) : (
                            <button
                              onClick={() => checkInAttendee(activeEventAttendees, a.user_id)}
                              className="px-3 h-7 rounded-full bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 shadow-sm active:scale-95 transition-colors"
                            >
                              Check in
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()
              ) : (
                <p className="text-[13px] text-slate-600 dark:text-zinc-400 font-medium text-center py-4">Pick an event to load its guest list</p>
             )}
          </div>
        )}

        {/* Create Form - High Density */}
        {showCreateForm && (
          <div className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-3xl p-5 mb-6 border border-[#e6d8e1] dark:border-zinc-700 shadow-sm animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-bold text-[#18181b] dark:text-zinc-100 flex items-center gap-2">
                <Plus size={16} className="text-primary" /> Create event
              </h3>
              <button onClick={() => setShowCreateForm(false)} className="text-slate-600 dark:text-zinc-300 hover:text-[#18181b] dark:hover:text-zinc-100 transition-colors"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Event title" className="w-full h-11 bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-xl px-4 text-sm text-[#18181b] dark:text-zinc-100 placeholder:text-slate-600 dark:placeholder:text-zinc-300 outline-none focus:border-primary transition-colors" />
              <div className="grid grid-cols-2 gap-2">
                <input required type="datetime-local" value={formData.event_date} onChange={e => setFormData({...formData, event_date: e.target.value})} className="h-11 bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-xl px-4 text-sm text-[#18181b] dark:text-zinc-100 outline-none focus:border-primary transition-colors w-full" />
                <input type="number" value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})} placeholder="Capacity" className="h-11 bg-[#f6eef3] dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-700 rounded-xl px-4 text-sm text-[#18181b] dark:text-zinc-100 placeholder:text-slate-600 dark:placeholder:text-zinc-300 outline-none focus:border-primary transition-colors" />
              </div>
              <button type="submit" className="w-full h-11 bg-primary text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] shadow-lg shadow-primary/20 transition-colors active:scale-95">
                Publish event
              </button>
            </form>
          </div>
        )}

        {/* Managed Events List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2 mb-2">
            <h3 className="text-sm font-bold text-slate-600 dark:text-zinc-300 flex items-center gap-2">
              <Settings size={14} className="text-primary" /> Your events
            </h3>
            <span className="text-xs font-medium text-slate-600 dark:text-zinc-300">{events.length} active</span>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Spinner size="medium" color="text-primary" />
              <p className="text-[13px] text-slate-600 dark:text-zinc-400 font-medium">Loading events...</p>
            </div>
          ) : events.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((e) => (
                <div key={e.event_id} id={`mgmt-card-${e.event_id}`} className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-3xl p-4 border border-[#e6d8e1] dark:border-zinc-700 shadow-sm relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`px-2.5 py-0.5 text-[11px] font-semibold text-white rounded-full ${e.is_public ? 'bg-emerald-500' : 'bg-slate-500'}`}>
                          {e.is_public ? 'Live' : 'Paused'}
                        </span>
                        <span className="text-xs font-medium text-slate-600 dark:text-zinc-300 truncate">{e.campus || 'Main Campus'}</span>
                      </div>
                      <h4 className="text-base font-bold text-[#18181b] dark:text-zinc-100 leading-snug truncate">{e.title}</h4>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                       <button onClick={() => toggleEventStatus(e.event_id, e.is_public)} className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${e.is_public ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                         <Power size={12} />
                       </button>
                       <button onClick={() => deleteEvent(e.event_id)} className="w-8 h-8 rounded-xl flex items-center justify-center bg-[#f6eef3] dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 hover:text-primary transition-colors">
                         <Trash2 size={12} />
                       </button>
                    </div>
                  </div>

                  <div onClick={() => loadAttendees(e.event_id)} className="grid grid-cols-2 gap-2 mb-4 bg-[#f6eef3] dark:bg-zinc-900 p-2.5 rounded-2xl cursor-pointer hover:bg-primary/5 transition-all">
                     <div className="text-center border-r border-[#ede3e9] dark:border-zinc-700">
                        <div className="text-lg font-bold text-[#18181b] dark:text-zinc-100 leading-none">{e.total_rsvps || 0}</div>
                        <div className="text-xs font-medium text-slate-600 dark:text-zinc-400 mt-1">RSVPs</div>
                     </div>
                     <div className="text-center">
                        <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 leading-none">{e.total_attended || 0}</div>
                        <div className="text-xs font-medium text-slate-600 dark:text-zinc-400 mt-1">Present</div>
                     </div>
                  </div>

                  <div className="space-y-2">
                    <button 
                      onClick={() => loadAttendees(e.event_id)}
                      className="w-full h-10 bg-primary text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Users size={16} /> {activeEventAttendees === e.event_id ? 'Hide guests' : 'Manage guests'}
                    </button>

                    {activeEventAttendees === e.event_id && (
                      <div className="mt-2 bg-[#f6eef3] dark:bg-zinc-900 rounded-2xl p-1.5 max-h-[160px] overflow-y-auto no-scrollbar space-y-1">
                        {attendeesList.map(a => (
                          <div key={a.user_id} className="bg-[#fdf8fa] dark:bg-zinc-800 p-2 rounded-xl flex justify-between items-center shadow-sm">
                             <div className="flex items-center gap-2">
                                <img src={a.avatar_url || `https://ui-avatars.com/api/?name=${a.username}`} className="w-5 h-5 rounded-md border border-[#e6d8e1] dark:border-zinc-700" alt="" />
                                <span className="text-[13px] font-semibold text-[#18181b] dark:text-zinc-100">{a.username}</span>
                             </div>
                             {a.status === 'pending' ? (
                                <div className="flex gap-1">
                                   <button onClick={() => processRSVP(e.event_id, a.user_id, 'accepted')} className="text-emerald-600 dark:text-emerald-400 p-1 hover:bg-emerald-500/10 rounded-lg"><Check size={12}/></button>
                                   <button onClick={() => processRSVP(e.event_id, a.user_id, 'rejected')} className="text-primary p-1 hover:bg-primary/10 rounded-lg"><X size={12}/></button>
                                </div>
                             ) : (
                                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${a.status==='accepted'?'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400':'bg-primary/10 text-primary'}`}>
                                   {a.status}
                                </span>
                             )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#f6eef3] dark:bg-zinc-900 rounded-3xl p-12 text-center border-2 border-dashed border-[#e6d8e1] dark:border-zinc-700 shadow-sm">
               <div className="w-12 h-12 bg-[#f0e5ec] dark:bg-zinc-700 rounded-2xl flex items-center justify-center mb-4 text-slate-600 dark:text-zinc-300 mx-auto">
                 <Calendar size={24} />
               </div>
               <p className="text-[13px] text-slate-600 dark:text-zinc-400 font-medium">No events managed yet.</p>
            </div>
          )}
        </div>
      </main>

      <style>{`
        
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}



