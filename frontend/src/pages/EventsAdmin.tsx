import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import { 
  Calendar, Users, QrCode, Power, Settings, Plus, Camera, Check, X, 
  Bell, Trash2, Edit, ArrowLeft, Shield, AlertCircle 
} from 'lucide-react';
import Spinner from '../components/ui/Spinner';

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
      console.error('Failed to fetch admin events', err);
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
      alert('Event is now Live!');
      setFormData({ title: '', location: '', event_date: '', capacity: '', requirements: '', campus: user?.campus || 'Main Campus' });
      setShowCreateForm(false);
      fetchManagedEvents();
    } catch {
      alert('Failed to broadcast event.');
    }
  };

  const toggleEventStatus = async (id: string, is_public: boolean) => {
    try {
      await api.patch(`/events/${id}/status`, { is_public: !is_public });
      fetchManagedEvents();
    } catch {
      alert('Failed to update event status');
    }
  };

  const deleteEvent = async (id: string) => {
    if (!confirm('Permanently remove this event?')) return;
    try {
      await api.delete(`/events/${id}`);
      fetchManagedEvents();
    } catch {
      alert('Failed to delete event');
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
      alert('Failed to load attendees');
    }
  };

  const processRSVP = async (eventId: string, userId: string, status: string) => {
    try {
      await api.patch(`/events/${eventId}/rsvp/${userId}`, { status });
      loadAttendees(eventId); 
    } catch {
      alert('Failed to process RSVP');
    }
  };

  return (
    <div className="flex bg-[#fafafa] min-h-screen text-black overflow-x-hidden font-sans pb-20">
      <Navbar />

      <main className="flex-1 lg:ml-72 p-4 md:p-8 relative z-10 max-w-4xl mx-auto w-full pt-16 md:pt-24">
        
        {/* Compact Header */}
        <header className="mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <button 
              onClick={() => navigate('/events')}
              className="w-8 h-8 flex items-center justify-center bg-white rounded-full shadow-sm border border-gray-100 text-gray-400 active:scale-90 transition-all"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/80 border border-white backdrop-blur-xl shadow-sm">
              <Shield size={12} strokeWidth={3} className="text-primary" />
              <span className="text-[8px] font-black text-black uppercase tracking-widest italic">Event Control</span>
            </div>
          </div>
          
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tighter uppercase italic leading-none mb-1">
                Campus <span className="text-primary">Life.</span>
              </h1>
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">Manage village gatherings</p>
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

        {/* Scanner - Compact Overlay */}
        {showScanner && (
          <div className="bg-white rounded-[24px] p-4 mb-6 border-2 border-emerald-500/20 shadow-xl animate-fade-in">
             <div className="flex justify-between items-center mb-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest italic flex items-center gap-2">
                  <Camera size={14} className="text-emerald-500" /> Scanner Mode
                </h3>
                <button onClick={() => setShowScanner(false)} className="text-gray-400"><X size={16} /></button>
             </div>
             <div className="aspect-square max-w-[240px] bg-black mx-auto rounded-2xl flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-emerald-500/10 z-10" style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(16, 185, 129, 0.4) 51%, transparent 51%)', backgroundSize: '100% 4px', animation: 'scanLine 2s linear infinite' }}></div>
                <p className="text-[9px] text-white/40 font-black uppercase tracking-widest z-20 text-center px-4">Initializing Lens...</p>
             </div>
          </div>
        )}

        {/* Create Form - High Density */}
        {showCreateForm && (
          <div className="bg-white rounded-[24px] p-5 mb-6 border border-gray-100 shadow-sm animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[10px] font-black uppercase tracking-widest italic flex items-center gap-2">
                <Plus size={14} className="text-primary" /> New Gathering
              </h3>
              <button onClick={() => setShowCreateForm(false)} className="text-gray-400"><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Event Title" className="w-full p-3 bg-gray-50 border-none rounded-xl text-[11px] font-bold outline-none focus:bg-white focus:ring-1 focus:ring-primary/20 transition-all uppercase italic" />
              <div className="grid grid-cols-2 gap-2">
                <input required type="datetime-local" value={formData.event_date} onChange={e => setFormData({...formData, event_date: e.target.value})} className="p-3 bg-gray-50 border-none rounded-xl text-[10px] font-black outline-none w-full" />
                <input type="number" value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})} placeholder="Capacity" className="p-3 bg-gray-50 border-none rounded-xl text-[11px] font-bold outline-none uppercase" />
              </div>
              <button type="submit" className="w-full py-3 bg-primary text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-95 italic">
                Launch Event
              </button>
            </form>
          </div>
        )}

        {/* Managed Events List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2 mb-2">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic flex items-center gap-2">
              <Settings size={14} className="text-primary" /> Management Mode
            </h3>
            <span className="text-[9px] font-black text-gray-300 uppercase tracking-widest italic">{events.length} Active</span>
          </div>

          {loading ? (
            <div className="py-20 text-center">
              <Spinner size="medium" color="text-primary" />
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest italic">Syncing Gathering State...</p>
            </div>
          ) : events.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((e) => (
                <div key={e.event_id} id={`mgmt-card-${e.event_id}`} className="bg-white rounded-[24px] p-4 border border-gray-100 shadow-sm relative overflow-hidden group">
                  <div className="flex justify-between items-start mb-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider text-white rounded-md ${e.is_public ? 'bg-emerald-500' : 'bg-gray-400'}`}>
                          {e.is_public ? 'LIVE' : 'PAUSED'}
                        </span>
                        <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest truncate">{e.campus || 'Main Campus'}</span>
                      </div>
                      <h4 className="text-[13px] font-black text-gray-900 uppercase italic leading-none truncate">{e.title}</h4>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                       <button onClick={() => toggleEventStatus(e.event_id, e.is_public)} className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${e.is_public ? 'bg-amber-50 text-amber-500' : 'bg-emerald-50 text-emerald-500'}`}>
                         <Power size={12} />
                       </button>
                       <button onClick={() => deleteEvent(e.event_id)} className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-50 text-gray-400 hover:text-primary transition-all">
                         <Trash2 size={12} />
                       </button>
                    </div>
                  </div>

                  <div onClick={() => loadAttendees(e.event_id)} className="grid grid-cols-2 gap-2 mb-4 bg-gray-50/50 p-2.5 rounded-xl cursor-pointer hover:bg-primary/5 transition-all">
                     <div className="text-center border-r border-gray-100">
                        <div className="text-lg font-black text-gray-900 leading-none">{e.total_rsvps || 0}</div>
                        <div className="text-[7px] font-black text-gray-400 uppercase tracking-widest mt-1">RSVPs</div>
                     </div>
                     <div className="text-center">
                        <div className="text-lg font-black text-emerald-500 leading-none">{e.total_attended || 0}</div>
                        <div className="text-[7px] font-black text-gray-400 uppercase tracking-widest mt-1">Present</div>
                     </div>
                  </div>

                  <div className="space-y-2">
                    <button 
                      onClick={() => loadAttendees(e.event_id)}
                      className="w-full py-2 bg-gray-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest italic flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Users size={12} className="text-primary" /> {activeEventAttendees === e.event_id ? 'Hide Guests' : 'Manage Guests'}
                    </button>
                    
                    {activeEventAttendees === e.event_id && (
                      <div className="mt-2 bg-gray-50 rounded-xl p-1.5 max-h-[160px] overflow-y-auto no-scrollbar space-y-1">
                        {attendeesList.map(a => (
                          <div key={a.user_id} className="bg-white p-2 rounded-lg flex justify-between items-center shadow-sm">
                             <div className="flex items-center gap-2">
                                <img src={a.avatar_url || `https://ui-avatars.com/api/?name=${a.username}`} className="w-5 h-5 rounded-md border border-gray-100" alt="" />
                                <span className="text-[9px] font-black uppercase text-gray-900 italic">{a.username}</span>
                             </div>
                             {a.status === 'pending' ? (
                                <div className="flex gap-1">
                                   <button onClick={() => processRSVP(e.event_id, a.user_id, 'accepted')} className="text-emerald-500 p-1 hover:bg-emerald-50 rounded-md"><Check size={12}/></button>
                                   <button onClick={() => processRSVP(e.event_id, a.user_id, 'rejected')} className="text-primary p-1 hover:bg-primary/5 rounded-md"><X size={12}/></button>
                                </div>
                             ) : (
                                <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${a.status==='accepted'?'bg-emerald-50 text-emerald-500':'bg-primary/5 text-primary'}`}>
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
            <div className="bg-white rounded-[32px] p-12 text-center border border-gray-100 shadow-sm">
               <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center mb-4 text-gray-200 mx-auto">
                  <Calendar size={24} />
               </div>
               <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest italic">No events managed yet.</p>
            </div>
          )}
        </div>
      </main>

      <style>{`
        @keyframes scanLine { 0% { transform: translateY(-100%); } 100% { transform: translateY(200%); } }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
