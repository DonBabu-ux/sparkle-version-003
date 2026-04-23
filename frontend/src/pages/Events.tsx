import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Users, 
  UserCheck, 
  ChevronDown, 
  Plus, 
  Clock, 
  Search, 
  Ticket, 
  Sparkles, 
  X, 
  Orbit
} from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import { useModalStore } from '../store/modalStore';

const TABS = ['all', 'my campus', 'my events', 'trending'];

interface CampusEvent {
  event_id: string;
  title: string;
  campus?: string;
  username?: string;
  start_time: string;
  total_rsvps?: number;
  total_attended?: number;
  max_attendees?: number;
  user_status?: 'pending' | 'accepted' | 'rejected' | 'attended' | null;
  is_creator?: boolean;
  requirements?: string;
}

export default function Events() {
  const { user } = useUserStore();
  const { setActiveModal } = useModalStore();
  const navigate = useNavigate();
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [expandedReqs, setExpandedReqs] = useState<Set<string>>(new Set());

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (activeTab === 'my campus' && user?.campus) params.campus = user.campus;
      if (activeTab === 'my events') params.filter = 'managed';
      const res = await api.get('/events', { params });
      setEvents(res.data.events || res.data || []);
    } catch (err) {
      console.error('Events fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, user?.campus]);

  useEffect(() => { fetchEvents(); }, [activeTab, fetchEvents]);

  const handleRSVP = async (eventId: string, status: string) => {
    try {
      await api.post(`/events/${eventId}/rsvp`, { status });
      fetchEvents();
    } catch (err) {
      console.error('RSVP error:', err);
    }
  };

  const toggleReqs = (id: string) => {
    setExpandedReqs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const statusBadge = (status: string | null | undefined) => {
    if (!status) return null;
    const map: Record<string, { label: string; cls: string; icon: typeof Calendar }> = {
      pending: { label: 'PENDING SYNC', cls: 'bg-black/5 text-black/40 border-black/5', icon: Clock },
      accepted: { label: 'SYNCHRONIZED', cls: 'bg-primary text-white border-primary shadow-2xl shadow-primary/30', icon: Sparkles },
      rejected: { label: 'REJECTED', cls: 'bg-red-500 text-white border-red-500 shadow-xl shadow-red-500/20', icon: X },
      attended: { label: 'ATTENDED', cls: 'bg-emerald-500 text-white border-emerald-500 shadow-xl shadow-emerald-500/20', icon: UserCheck },
    };
    const s = map[status] || { label: status.toUpperCase(), cls: 'bg-black/5 text-black border-black/5', icon: Sparkles };
    return (
      <div className={`inline-flex items-center gap-3 px-8 py-3 rounded-2xl border text-[10px] font-black tracking-[0.2em] shadow-lg animate-fade-in italic ${s.cls}`}>
        <s.icon size={16} strokeWidth={4} />
        {s.label}
      </div>
    );
  };

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black font-sans overflow-x-hidden">
      <Navbar />
      
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-7xl mx-auto w-full pt-16 md:pt-12">
        {/* Header */}
        <header className="mb-24 animate-fade-in px-4">
           <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-12">
              <div className="max-w-4xl space-y-8">
                 <div className="inline-flex items-center gap-4 px-6 py-2.5 rounded-full bg-white/80 border border-white backdrop-blur-3xl shadow-xl shadow-primary/5">
                    <Calendar size={18} strokeWidth={3} className="text-primary" />
                    <span className="text-[10px] font-black text-black uppercase tracking-[0.4em] italic">The Village Gatherings</span>
                 </div>
                 <h1 className="text-5xl md:text-9xl font-black text-black tracking-tighter leading-none italic uppercase">
                    Village <span className="text-primary">Live</span>
                 </h1>
                  <p className="text-xl font-bold text-black opacity-60 leading-relaxed italic max-w-2xl">
                    Experience the village vibe. Upcoming workshops, social gathering harmonics, and memories at <span className="text-primary">{user?.campus || 'the village'}</span>.
                  </p>
              </div>
              
              <button 
                onClick={() => setActiveModal('event', fetchEvents)}
                className="flex items-center gap-4 px-12 py-6 bg-primary text-white rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 hover:scale-[1.05] transition-all active:scale-95 italic whitespace-nowrap"
              >
                <Plus size={24} strokeWidth={4} />
                Host Gathering
              </button>
           </div>
        </header>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-10 mb-20 px-4">
           <div className="flex items-center gap-4 overflow-x-auto pb-4 lg:pb-0 no-scrollbar w-full lg:w-auto">
              {TABS.map(tab => (
                 <button 
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-10 py-4.5 rounded-[22px] font-black text-[11px] uppercase tracking-widest transition-all duration-500 whitespace-nowrap shadow-lg border flex items-center gap-3 italic ${activeTab === tab ? 'bg-white border-primary text-primary scale-105 shadow-primary/5' : 'bg-white/40 border-white text-black/20 hover:bg-white hover:text-black'}`}
                 >
                   <span className={activeTab === tab ? 'text-primary' : 'text-black/10'}>{activeTab === tab ? <Orbit size={18} strokeWidth={3} className="animate-spin-slow" /> : <Calendar size={18} strokeWidth={3} />}</span>
                   {tab}
                 </button>
              ))}
           </div>

           <div className="relative w-full lg:w-[400px] group">
              <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-black/10 group-focus-within:text-primary transition-colors" size={24} strokeWidth={4} />
              <input 
                type="text" 
                placeholder="Scan for event signals..." 
                className="w-full h-20 bg-white/80 border border-white rounded-[32px] pl-20 pr-8 text-lg font-black text-black placeholder:text-black/5 focus:bg-white focus:border-primary transition-all outline-none shadow-2xl shadow-primary/5 italic"
              />
           </div>
        </div>

        {/* List */}
        <div className="space-y-12 pb-48 px-2">
          {loading ? (
             [1,2,3].map(i => (
                <div key={i} className="h-72 bg-white/40 border-4 border-dashed border-white rounded-[56px] animate-pulse shadow-sm" />
             ))
          ) : events.length === 0 ? (
             <div className="py-48 flex flex-col items-center text-center px-8 bg-white/20 border-4 border-dashed border-white rounded-[64px] shadow-inner animate-fade-in mx-4">
                <Ticket size={140} strokeWidth={1} className="text-black/5 animate-spin-slow" />
                <h3 className="text-5xl font-black text-black/10 italic mb-8 uppercase tracking-tighter">Quiet Frequency.</h3>
                <p className="text-[11px] font-black text-black/30 uppercase tracking-[0.4em] max-w-sm mx-auto mb-12 italic leading-loose">
                   No gathering signals detected in this sector. Initialize a new event pulse!
                </p>
                <button 
                  onClick={() => setActiveModal('event', fetchEvents)}
                  className="px-12 py-6 bg-primary text-white rounded-[24px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 italic transition-all hover:scale-[1.05]"
                >
                   Host Pulse
                </button>
             </div>
          ) : (
             <div className="flex flex-col gap-12">
               {events.map((ev) => {
                  const progress = ev.max_attendees && ev.max_attendees > 0
                    ? Math.min(100, Math.round(((ev.total_rsvps || 0) / ev.max_attendees) * 100))
                    : 0;
                  const isExpanded = expandedReqs.has(ev.event_id);

                  return (
                    <div 
                      key={ev.event_id} 
                      className="bg-white/80 backdrop-blur-3xl p-10 md:p-16 rounded-[56px] group transition-all duration-700 hover:scale-[1.01] border border-white shadow-2xl shadow-primary/5 relative overflow-hidden animate-fade-in"
                    >
                       {/* Context Accent */}
                       <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] opacity-0 group-hover:opacity-100 transition-opacity"></div>

                       <div className="flex flex-col lg:flex-row justify-between gap-12 relative z-10">
                          <div className="flex-1 space-y-10">
                             <div className="flex items-center gap-8">
                                <div className="w-24 h-24 bg-primary/5 rounded-[32px] flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-700 border border-primary/10 shadow-sm group-hover:rotate-6">
                                   <Calendar size={36} strokeWidth={3} />
                                </div>
                                <div className="space-y-4">
                                   <div className="flex items-center gap-4">
                                      <span className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em] italic">TRANSMISSION BY @{ev.username}</span>
                                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                                      <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] italic">{ev.campus || 'VILLAGE NODE'}</span>
                                   </div>
                                   <h3 className="text-4xl md:text-5xl font-black text-black tracking-tighter leading-none italic uppercase group-hover:text-primary transition-colors duration-700">{ev.title}</h3>
                                </div>
                             </div>

                             <div className="flex flex-wrap items-center gap-8">
                                <div className="flex items-center gap-4 px-8 py-4 bg-black/5 rounded-[22px] border border-black/5">
                                   <Clock size={20} strokeWidth={4} className="text-primary" />
                                   <span className="text-sm font-black text-black uppercase tracking-widest italic">
                                      {new Date(ev.start_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                   </span>
                                </div>
                                <div className="flex items-center gap-4 px-8 py-4 bg-black/5 rounded-[22px] border border-black/5">
                                   <Users size={20} strokeWidth={4} className="text-primary" />
                                   <span className="text-sm font-black text-black uppercase tracking-widest italic">{ev.total_rsvps || 0} CONVERGED</span>
                                </div>
                                {ev.max_attendees && ev.max_attendees > 0 && (
                                   <div className="flex-1 min-w-[250px] pt-2">
                                      <div className="flex items-center justify-between mb-3 text-[9px] font-black uppercase text-black/20 tracking-[0.3em] italic">
                                         <span>Frequency Load</span>
                                         <span>{progress}%</span>
                                      </div>
                                      <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden p-[2px]">
                                         <div 
                                           className={`h-full rounded-full transition-all duration-1000 ${progress >= 90 ? 'bg-red-500' : 'bg-primary shadow-[0_0_10px_rgba(225,29,72,0.5)]'}`}
                                           style={{ width: `${progress}%` }}
                                         />
                                      </div>
                                   </div>
                                )}
                             </div>
                          </div>

                          <div className="flex flex-col items-center lg:items-end justify-between gap-10 shrink-0">
                             <div className="flex items-center gap-4">
                                {ev.is_creator && (
                                   <button 
                                    onClick={() => navigate(`/events/admin?id=${ev.event_id}`)}
                                    className="px-8 py-3 bg-black text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-primary transition-all shadow-xl shadow-black/10 italic"
                                   >
                                      Tune
                                   </button>
                                )}
                                {statusBadge(ev.user_status)}
                             </div>

                             <div className="flex items-center gap-6 w-full lg:w-auto">
                                {!ev.user_status && (
                                   <button 
                                    onClick={() => handleRSVP(ev.event_id, 'pending')}
                                    className="flex-1 lg:px-16 h-20 bg-primary text-white rounded-[28px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 hover:scale-[1.05] transition-all active:scale-95 italic"
                                   >
                                      Join Signal
                                   </button>
                                )}
                                {ev.user_status === 'accepted' && (
                                   <div className="flex items-center gap-4 flex-1 lg:flex-none">
                                      <button className="flex-1 px-12 h-20 bg-black text-white rounded-[28px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-black/30 hover:scale-[1.05] transition-all flex items-center justify-center gap-4 italic">
                                         <Ticket size={24} strokeWidth={4} className="text-primary" />
                                         Access Pass
                                      </button>
                                      <button 
                                        onClick={() => handleRSVP(ev.event_id, 'not_going')}
                                        className="w-20 h-20 bg-black/5 hover:bg-red-500 hover:text-white text-black/10 rounded-[28px] flex items-center justify-center transition-all duration-500 shadow-sm group/close"
                                      >
                                         <X size={32} strokeWidth={4} className="group-hover/close:rotate-90 transition-transform" />
                                      </button>
                                   </div>
                                )}
                                {ev.user_status && ev.user_status !== 'accepted' && (
                                   <button 
                                     onClick={() => handleRSVP(ev.event_id, 'not_going')}
                                     className="px-12 h-20 bg-black/5 text-black/20 rounded-[28px] font-black text-xs uppercase tracking-[0.2em] hover:text-black transition-all italic border border-black/5"
                                   >
                                      Cancel Signal
                                   </button>
                                )}
                                <button 
                                  onClick={() => toggleReqs(ev.event_id)}
                                  className={`w-20 h-20 rounded-[28px] flex items-center justify-center transition-all duration-500 border-2 ${isExpanded ? 'bg-black border-black text-white shadow-2xl' : 'bg-white border-white text-black/10 hover:text-black hover:shadow-xl'}`}
                                >
                                   <ChevronDown size={32} strokeWidth={4} className={`transition-transform duration-500 ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                             </div>
                          </div>
                       </div>

                       {isExpanded && (
                          <div className="mt-12 pt-12 border-t border-black/[0.03] animate-scale-in">
                             <div className="flex items-center gap-6 mb-8 px-2">
                                <div className="w-1.5 h-12 bg-primary rounded-full" />
                                <div>
                                   <h4 className="text-3xl font-black text-black italic uppercase tracking-tighter">Mission Requirements</h4>
                                   <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] mt-2 italic">Critical gathering harmonics.</p>
                                </div>
                              </div>
                              <div className="bg-white/40 backdrop-blur-3xl rounded-[40px] p-10 border border-white shadow-inner">
                                 <p className="text-lg font-bold text-black leading-loose italic opacity-70 whitespace-pre-wrap">
                                    {ev.requirements || 'No specific signal requirements listed for this gathering.'}
                                 </p>
                              </div>
                          </div>
                       )}
                    </div>
                  );
               })}
             </div>
          )}
        </div>
      </main>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-scale-in { animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .animate-spin-slow { animation: spin 15s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
