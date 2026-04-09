import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import { Calendar, Users, QrCode, Power, Settings, Plus, Camera, Check, X, Bell, Trash2, Edit } from 'lucide-react';

export default function EventsAdmin() {
  const { user } = useUserStore();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetEventId = searchParams.get('id');

  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    location: '',
    event_date: '',
    capacity: '',
    requirements: '',
    campus: user?.campus || 'Main Campus'
  });

  // Attendee state
  const [activeEventAttendees, setActiveEventAttendees] = useState<string | null>(null);
  const [attendeesList, setAttendeesList] = useState<any[]>([]);

  useEffect(() => { fetchManagedEvents(); }, []);

  const fetchManagedEvents = async () => {
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
  };

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
      fetchManagedEvents();
    } catch (err) {
      console.error(err);
      alert('Failed to broadcast event.');
    }
  };

  const toggleEventStatus = async (id: string, is_public: boolean) => {
    try {
      await api.patch(`/events/${id}/status`, { is_public: !is_public });
      fetchManagedEvents();
    } catch (err) {
      alert('Failed to update event status');
    }
  };

  const deleteEvent = async (id: string) => {
    if (!confirm('This will permanently remove the event and all RSVPs. Proceed?')) return;
    try {
      await api.delete(`/events/${id}`);
      fetchManagedEvents();
    } catch (err) {
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
    } catch (err) {
      alert('Failed to load attendees');
    }
  };

  const processRSVP = async (eventId: string, userId: string, status: string) => {
    try {
      await api.patch(`/events/${eventId}/rsvp/${userId}`, { status });
      loadAttendees(eventId); 
    } catch (err) {
      alert('Failed to process RSVP');
    }
  };

  const sendAnnouncement = async (eventId: string) => {
    const msg = prompt('What would you like to broadcast to attendees via Sparkle Socket?');
    if (!msg) return;
    try {
      // Assuming a generic broadcast endpoint exists
      await api.post(`/events/${eventId}/announce`, { message: msg });
      alert('Broadcast Sent!');
    } catch (err) {
      alert('Failed to send announcement');
    }
  };

  return (
    <div className="admin-page bg-slate-50 min-h-screen">
      <Navbar />
      
      <div className="max-w-[1200px] mx-auto px-4 py-8 pb-32">
        {/* Header */}
        <div className="bg-white rounded-3xl p-6 mb-8 shadow-sm border border-slate-100 flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-[#111] bg-gradient-to-r from-[#FF3D6D] to-[#FF7B42] bg-clip-text text-transparent inline-block m-0">Event Control Center</h1>
            <p className="text-sm font-semibold text-slate-500 mt-1">Manage campus life & attendance</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/events')} className="px-5 py-2.5 bg-slate-100 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors flex items-center gap-2">
              <Calendar size={16} /> Public View
            </button>
            <button onClick={() => setShowScanner(!showScanner)} className="px-5 py-2.5 bg-emerald-500 rounded-xl text-sm font-bold text-white hover:bg-emerald-600 transition-colors flex items-center gap-2 shadow-lg shadow-emerald-500/20">
              <QrCode size={16} /> Entry Check-In
            </button>
          </div>
        </div>

        {/* Scanner Section */}
        {showScanner && (
          <div className="bg-white rounded-3xl p-6 mb-8 border-2 border-emerald-500 shadow-xl text-center">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold flex items-center gap-2"><Camera size={18} /> Live Entrance Scanner</h3>
                <button onClick={() => setShowScanner(false)} className="text-rose-500 hover:opacity-80"><X size={20} /></button>
             </div>
             <div className="w-full max-w-[500px] aspect-square bg-black mx-auto rounded-xl flex items-center justify-center relative overflow-hidden">
                {/* Mocked Scanner UI since html5-qrcode requires DOM mounting in a specific way not suitable for direct raw React pasting without wrapper */}
                <div className="absolute inset-0 bg-emerald-500/10 z-10" style={{ background: 'linear-gradient(to bottom, transparent 50%, rgba(16, 185, 129, 0.4) 51%, transparent 51%)', backgroundSize: '100% 4px', animation: 'scanLine 2s linear infinite' }}></div>
                <p className="text-white z-20 font-mono text-sm opacity-50 block text-center p-4">
                    Camera access required. In production, connect `html5-qrcode` or `react-qr-reader` here.
                </p>
             </div>
             <p className="mt-4 text-slate-500 text-sm font-semibold">Point camera at student's Entry Pass QR</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
          {/* Left Column - Active Management */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-extrabold flex items-center gap-3">
                <Settings className="text-[#FF3D6D]" size={22} /> Active Management
              </h3>
              <div className="bg-white px-4 py-2 rounded-xl text-xs font-bold text-slate-500 border border-slate-100 shadow-sm flex items-center gap-2">
                <Calendar size={14} className="text-[#FF3D6D]" /> {events.length} EVENTS
              </div>
            </div>

            {loading ? (
              <div className="text-center p-12 text-slate-400 font-bold animate-pulse">Loading Events...</div>
            ) : events.length > 0 ? (
              <div className="flex flex-col gap-6">
                {events.map((e) => (
                  <div key={e.event_id} id={`mgmt-card-${e.event_id}`} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 relative overflow-hidden group">
                    {/* Top Info */}
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white rounded-lg ${e.is_public ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-slate-500'}`}>
                            {e.is_public ? 'LIVE' : 'PAUSED'}
                          </span>
                          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{e.campus || 'Main Campus'}</span>
                        </div>
                        <h4 className="text-xl font-extrabold text-[#111] leading-tight m-0">{e.title}</h4>
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => toggleEventStatus(e.event_id, e.is_public)} className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${e.is_public ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
                           <Power size={18} />
                         </button>
                         <button onClick={() => deleteEvent(e.event_id)} className="w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 transition-all">
                           <Trash2 size={18} />
                         </button>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div onClick={() => loadAttendees(e.event_id)} className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors border border-slate-100">
                       <div className="text-center border-r border-slate-200">
                          <div className="text-3xl font-black text-[#111]">{e.total_rsvps || e.total_reservations || 0}</div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Total RSVPs</div>
                       </div>
                       <div className="text-center">
                          <div className="text-3xl font-black text-emerald-500">{e.total_attended || 0}</div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Present Now</div>
                       </div>
                    </div>

                    {/* Capacity Progress */}
                    {e.max_attendees > 0 && (
                      <div className="mb-6">
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                          <div 
                            className="h-full rounded-full transition-all duration-1000 bg-gradient-to-r from-[#FF3D6D] to-[#FF7B42]" 
                            style={{ width: `${Math.min(((e.total_rsvps || 0) / e.max_attendees) * 100, 100)}%` }} 
                          />
                        </div>
                        <div className="flex justify-between text-[11px] font-extrabold text-slate-400">
                           <span>CAPACITY: {e.max_attendees}</span>
                           <span className={((e.total_rsvps||0) / e.max_attendees > 0.9) ? 'text-rose-500' : ''}>
                             {Math.max(0, e.max_attendees - (e.total_rsvps||0))} SPOTS LEFT
                           </span>
                        </div>
                      </div>
                    )}

                    {/* Management Controls */}
                    <div className="space-y-6">
                      {/* Approval Queue */}
                      <div className="pt-6 border-t border-slate-100">
                        <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3">Approval Queue</label>
                        <button onClick={() => loadAttendees(e.event_id)} className="w-full p-3.5 bg-slate-50 border border-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors">
                          <Users size={16} /> Review Requests
                        </button>
                        
                        {activeEventAttendees === e.event_id && (
                          <div className="mt-4 bg-slate-50 border border-slate-200 rounded-2xl p-2 max-h-[300px] overflow-y-auto">
                            {attendeesList.length === 0 ? (
                               <p className="text-xs text-center text-slate-400 py-4 font-semibold">No RSVP requests yet.</p>
                            ) : (
                               attendeesList.map(a => (
                                 <div key={a.user_id} className="bg-white p-3 rounded-xl mb-2 border border-slate-100 flex justify-between items-center shadow-sm">
                                    <div className="flex items-center gap-3">
                                       <img src={a.avatar_url || '/uploads/avatars/default.png'} className="w-8 h-8 rounded-full border border-slate-200" alt="" />
                                       <div className="text-sm font-bold text-[#111]">{a.username}</div>
                                    </div>
                                    {a.status === 'pending' ? (
                                       <div className="flex gap-2">
                                          <button onClick={() => processRSVP(e.event_id, a.user_id, 'accepted')} className="bg-emerald-100 text-emerald-600 p-1.5 rounded-lg hover:bg-emerald-200 transition-colors"><Check size={16}/></button>
                                          <button onClick={() => processRSVP(e.event_id, a.user_id, 'rejected')} className="bg-rose-100 text-rose-600 p-1.5 rounded-lg hover:bg-rose-200 transition-colors"><X size={16}/></button>
                                       </div>
                                    ) : (
                                       <span className={`text-[11px] font-black uppercase px-2 py-1 rounded-md ${a.status==='accepted'?'bg-emerald-50 text-emerald-600':'bg-rose-50 text-rose-500'}`}>
                                          {a.status}
                                       </span>
                                    )}
                                 </div>
                               ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* Event Modifiers */}
                      <div className="pt-6 border-t border-slate-100">
                         <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3">Event Modifiers</label>
                         <div className="grid grid-cols-2 gap-3">
                            <button className="p-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:border-[#FF3D6D] hover:text-[#FF3D6D] transition-colors"><Edit size={14}/> Edit</button>
                            <button onClick={async () => {
                              const v = prompt("Enter new capacity:");
                              if(v) {
                                await api.put(`/events/${e.event_id}`, { max_attendees: parseInt(v) });
                                fetchManagedEvents();
                              }
                            }} className="p-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:border-[#FF3D6D] hover:text-[#FF3D6D] transition-colors"><Users size={14}/> Capacity</button>
                            <button onClick={async () => {
                              const r = prompt("Requirements:", e.requirements);
                              if(r !== null) {
                                await api.put(`/events/${e.event_id}`, { requirements: r });
                                fetchManagedEvents();
                              }
                            }} className="p-3 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:border-[#FF3D6D] hover:text-[#FF3D6D] transition-colors"><Settings size={14}/> Requirements</button>
                            <button className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors"><X size={14}/> Close</button>
                         </div>
                      </div>

                      {/* Broadcasting */}
                      <div className="pt-6 border-t border-slate-100">
                         <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3">Broadcasting</label>
                         <button onClick={() => sendAnnouncement(e.event_id)} className="w-full p-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-black text-[13px] flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20 hover:opacity-90 transition-opacity">
                            <Bell size={16} /> Send Live Announcement
                         </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-16 text-center border border-slate-100 shadow-sm flex flex-col items-center">
                 <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5 text-slate-300">
                    <Calendar size={32} />
                 </div>
                 <h4 className="text-xl font-extrabold text-[#111] mb-2">No Managed Events</h4>
                 <p className="text-sm font-semibold text-slate-500">Use the form to host your first campus event.</p>
              </div>
            )}
          </div>

          {/* Right Column - Create Event Form */}
          <div className="relative">
            <div className="bg-white rounded-3xl p-7 border border-slate-200 shadow-xl lg:sticky lg:top-6">
              <h3 className="text-lg font-extrabold flex items-center gap-3 text-[#111] mb-6">
                <Plus className="text-[#FF3D6D]" size={20} /> Host New Event
              </h3>
              
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Event Title</label>
                  <input required type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Event Name" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-[#FF3D6D] focus:ring-2 focus:ring-[#FF3D6D]/20 outline-none transition-all" />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Location / Venue</label>
                  <input required type="text" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="Where is it?" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-[#FF3D6D] focus:ring-2 focus:ring-[#FF3D6D]/20 outline-none transition-all" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Date & Time</label>
                    <input required type="datetime-local" value={formData.event_date} onChange={e => setFormData({...formData, event_date: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white outline-none w-full appearance-none m-0" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Capacity</label>
                    <input type="number" value={formData.capacity} onChange={e => setFormData({...formData, capacity: e.target.value})} placeholder="Infinite" className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white outline-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Requirements</label>
                  <textarea value={formData.requirements} onChange={e => setFormData({...formData, requirements: e.target.value})} placeholder="- Bring a laptop..." className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white outline-none min-h-[90px] resize-none"></textarea>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Campus Scope</label>
                  <select value={formData.campus} onChange={e => setFormData({...formData, campus: e.target.value})} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white outline-none appearance-none">
                    <option value="Main Campus">Main Campus</option>
                    <option value="Virtual">Virtual / Remote</option>
                    <option value="North Campus">North Campus</option>
                    <option value={user?.campus as string}>{user?.campus || 'My Campus'}</option>
                  </select>
                </div>

                <button type="submit" className="w-full py-4 mt-2 rounded-2xl bg-gradient-to-r from-[#FF3D6D] to-[#FF7B42] text-white font-black text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-[#FF3D6D]/30 hover:shadow-xl hover:translate-y-[-2px] transition-all">
                  <span>Push Live</span>
                  <Plus size={18} strokeWidth={3} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes scanLine {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(200%); }
        }
      `}</style>
    </div>
  );
}
