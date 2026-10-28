import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Users,
  ChevronDown,
  Plus,
  Clock,
  Search,
  Ticket,
  X
} from 'lucide-react';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import { useModalStore } from '../store/modalStore';
import { logger } from '../utils/logger';
import { showError } from '../utils/toast';

const TABS = [
  { key: 'all', label: 'All events' },
  { key: 'my campus', label: 'My campus' },
  { key: 'my events', label: 'My events' },
];

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
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedReqs, setExpandedReqs] = useState<Set<string>>(new Set());
  const [passQr, setPassQr] = useState<{ src: string; title: string } | null>(null);
  const [passLoading, setPassLoading] = useState<string | null>(null);

  const openAccessPass = async (eventId: string, title: string) => {
    setPassLoading(eventId);
    try {
      const res = await api.get(`/events/${eventId}/qr`);
      setPassQr({ src: res.data.qr, title });
    } catch {
      showError('Could not load your access pass. Please try again.');
    } finally {
      setPassLoading(null);
    }
  };

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (activeTab === 'my campus' && user?.campus) params.campus = user.campus;
      if (activeTab === 'my events') params.filter = 'managed';
      const res = await api.get('/events', { params });
      setEvents(res.data.events || res.data || []);
    } catch (err) {
      logger.error('Events fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, user?.campus]);

  useEffect(() => { fetchEvents(); }, [activeTab, fetchEvents]);

  const handleRSVP = async (eventId: string, status: string) => {
    const prev = events.find(e => e.event_id === eventId);
    const prevStatus = prev?.user_status ?? null;
    // Optimistic update
    setEvents(ev => ev.map(e =>
      e.event_id === eventId ? { ...e, user_status: status as CampusEvent['user_status'] } : e
    ));
    try {
      await api.post(`/events/${eventId}/rsvp`, { status });
      fetchEvents();
    } catch (err) {
      // Revert to last confirmed state on failure
      setEvents(ev => ev.map(e =>
        e.event_id === eventId ? { ...e, user_status: prevStatus } : e
      ));
      showError('RSVP failed. Please try again.');
      logger.error('RSVP error:', err);
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
    const map: Record<string, { label: string; cls: string }> = {
      pending: { label: 'Request pending', cls: 'bg-[#f0e5ec] text-slate-600 border-[#e6d8e1] dark:bg-zinc-700 dark:text-zinc-300 dark:border-zinc-700' },
      accepted: { label: 'Going', cls: 'bg-primary text-white border-primary' },
      rejected: { label: 'Not going', cls: 'bg-red-500 text-white border-red-500' },
      attended: { label: 'Attended', cls: 'bg-emerald-500 text-white border-emerald-500' },
    };
    const s = map[status] || { label: status, cls: 'bg-[#f0e5ec] text-slate-600 border-[#e6d8e1] dark:bg-zinc-700 dark:text-zinc-300 dark:border-zinc-700' };
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-[11px] font-semibold ${s.cls}`}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="flex bg-[#f8e7ed] dark:bg-zinc-900 min-h-dvh text-[#18181b] dark:text-zinc-100 font-sans overflow-x-hidden">

      <main className="flex-1 p-6 lg:p-12 relative z-10 max-w-5xl mx-auto w-full">
        {/* Header */}
        <header className="mb-8 px-1">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-full mb-4">
                <Calendar size={14} className="text-primary" />
                <span className="text-[11px] font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wide">Campus events</span>
              </div>
              <h1 className="text-3xl font-black text-[#18181b] dark:text-zinc-100 tracking-tight">
                Events
              </h1>
              <p className="text-sm text-slate-600 dark:text-zinc-400 mt-1.5 max-w-xl">
                Workshops, gatherings and parties happening at {user?.campus || 'your campus'}. Create one and invite people.
              </p>
            </div>

            <button
              onClick={() => setActiveModal('event', fetchEvents)}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors self-start"
            >
              <Plus size={16} strokeWidth={2.5} />
              Create event
            </button>
          </div>
        </header>

        {/* Controls */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-colors whitespace-nowrap border ${
                  activeTab === tab.key
                    ? 'bg-primary border-primary text-white'
                    : 'bg-[#fdf8fa] dark:bg-zinc-800 border-[#e6d8e1] dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:text-[#18181b] dark:hover:text-zinc-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-zinc-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events..."
              className="w-full h-10 bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-full pl-10 pr-4 text-sm text-[#18181b] dark:text-zinc-100 placeholder:text-slate-600 dark:placeholder:text-zinc-400 focus:border-primary outline-none transition-colors"
            />
          </div>
        </div>

        {/* List */}
        <div className="space-y-4 pb-24">
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-[#f6eef3] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-3xl animate-pulse" />
            ))
          ) : events.length === 0 ? (
            <div className="py-16 flex flex-col items-center text-center px-6 bg-[#f6eef3] dark:bg-zinc-800 border-2 border-dashed border-[#e6d8e1] dark:border-zinc-700 rounded-3xl">
              <Calendar size={40} className="text-slate-600 dark:text-zinc-400 mb-3" />
              <h3 className="text-lg font-bold text-[#18181b] dark:text-zinc-100 mb-1">No events yet</h3>
              <p className="text-sm text-slate-600 dark:text-zinc-400 max-w-sm">
                Nothing happening here right now. Create an event and your campus can join.
              </p>
              <button
                onClick={() => setActiveModal('event', fetchEvents)}
                className="mt-5 px-5 py-2.5 bg-primary text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors"
              >
                Create event
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {events.filter((ev) => {
                const q = searchQuery.trim().toLowerCase();
                return !q || ev.title.toLowerCase().includes(q) || (ev.campus || '').toLowerCase().includes(q);
              }).map((ev) => {
                const progress = ev.max_attendees && ev.max_attendees > 0
                  ? Math.min(100, Math.round(((ev.total_rsvps || 0) / ev.max_attendees) * 100))
                  : 0;
                const isExpanded = expandedReqs.has(ev.event_id);

                return (
                  <div
                    key={ev.event_id}
                    className="bg-[#fdf8fa] dark:bg-zinc-800 p-5 md:p-6 rounded-3xl border border-[#e6d8e1] dark:border-zinc-700 shadow-sm"
                  >
                    <div className="flex flex-col lg:flex-row justify-between gap-5">
                      <div className="flex-1">
                        <div className="flex items-start gap-4">
                          <div className="w-11 h-11 bg-primary/5 rounded-2xl flex items-center justify-center text-primary shrink-0 border border-primary/10">
                            <Calendar size={20} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-zinc-400 mb-0.5">
                              {ev.username && <span>Hosted by @{ev.username}</span>}
                              {ev.username && ev.campus && <span className="w-1 h-1 rounded-full bg-slate-600 dark:bg-zinc-400" />}
                              <span>{ev.campus || 'Campus event'}</span>
                            </div>
                            <h3 className="text-lg font-bold text-[#18181b] dark:text-zinc-100 leading-snug">{ev.title}</h3>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-4">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f6eef3] dark:bg-zinc-900 rounded-full text-xs font-medium text-slate-600 dark:text-zinc-400">
                            <Clock size={13} className="text-primary" />
                            {new Date(ev.start_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </div>
                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#f6eef3] dark:bg-zinc-900 rounded-full text-xs font-medium text-slate-600 dark:text-zinc-400">
                            <Users size={13} className="text-primary" />
                            {ev.total_rsvps || 0} going
                          </div>
                          {ev.max_attendees && ev.max_attendees > 0 && (
                            <div className="flex-1 min-w-[180px] pt-1">
                              <div className="flex items-center justify-between mb-1 text-[11px] text-slate-600 dark:text-zinc-400">
                                <span>Spots filled</span>
                                <span>{progress}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-[#f0e5ec] dark:bg-zinc-700 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-700 ${progress >= 90 ? 'bg-red-500' : 'bg-primary'}`}
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-start lg:items-end justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {ev.is_creator && (
                            <button
                              onClick={() => navigate(`/events/admin?id=${ev.event_id}`)}
                              className="px-3.5 py-1.5 bg-[#fdf8fa] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-full text-xs font-bold text-[#18181b] dark:text-zinc-100 hover:border-primary transition-colors"
                            >
                              Manage
                            </button>
                          )}
                          {statusBadge(ev.user_status)}
                        </div>

                        <div className="flex items-center gap-2 w-full lg:w-auto">
                          {!ev.user_status && (
                            <button
                              onClick={() => handleRSVP(ev.event_id, 'pending')}
                              className="flex-1 lg:flex-none px-5 h-10 bg-primary text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors"
                            >
                              Request to join
                            </button>
                          )}
                          {ev.user_status === 'accepted' && (
                            <div className="flex items-center gap-2 flex-1 lg:flex-none">
                              <button
                                onClick={() => openAccessPass(ev.event_id, ev.title)}
                                disabled={passLoading === ev.event_id}
                                className="flex-1 px-5 h-10 bg-[#18181b] dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-full text-sm font-bold hover:bg-zinc-700 dark:hover:bg-zinc-300 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                              >
                                <Ticket size={16} className="text-primary" />
                                {passLoading === ev.event_id ? 'Loading…' : 'Show pass'}
                              </button>
                              <button
                                onClick={() => handleRSVP(ev.event_id, 'not_going')}
                                className="w-10 h-10 bg-[#f0e5ec] dark:bg-zinc-700 hover:bg-red-500 hover:text-white text-slate-600 dark:text-zinc-300 rounded-full flex items-center justify-center transition-colors"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          )}
                          {ev.user_status && ev.user_status !== 'accepted' && (
                            <button
                              onClick={() => handleRSVP(ev.event_id, 'not_going')}
                              className="px-5 h-10 bg-[#f0e5ec] dark:bg-zinc-700 text-slate-600 dark:text-zinc-300 rounded-full text-sm font-bold hover:text-[#18181b] dark:hover:text-zinc-100 transition-colors border border-[#e6d8e1] dark:border-zinc-700"
                            >
                              Cancel request
                            </button>
                          )}
                          <button
                            onClick={() => toggleReqs(ev.event_id)}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors border ${isExpanded ? 'bg-[#18181b] dark:bg-zinc-100 border-transparent text-white dark:text-zinc-900' : 'bg-[#fdf8fa] dark:bg-zinc-800 border-[#e6d8e1] dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-primary'}`}
                          >
                            <ChevronDown size={16} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-5 pt-5 border-t border-[#ede3e9] dark:border-zinc-900">
                        <h4 className="text-sm font-bold text-[#18181b] dark:text-zinc-100 mb-1">Requirements</h4>
                        <p className="text-[11px] text-slate-600 dark:text-zinc-400 mb-3">What to bring or know before you go.</p>
                        <div className="bg-[#f6eef3] dark:bg-zinc-900 rounded-2xl p-4 border border-[#e6d8e1] dark:border-zinc-700">
                          <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap">
                            {ev.requirements || 'No specific requirements listed for this event.'}
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

      {/* Access Pass QR Overlay */}
      {passQr && (
        <div className="fixed inset-0 z-(--z-modal) flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm" onClick={() => setPassQr(null)}>
          <div className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-3xl p-6 max-w-xs w-full text-center border border-[#e6d8e1] dark:border-zinc-700 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-[#18181b] dark:text-zinc-100 mb-0.5">{passQr.title}</h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 mb-4">Show this pass at the door</p>
            <img src={passQr.src} alt="Access pass QR code" className="mx-auto w-56 h-56 rounded-2xl" />
            <button
              onClick={() => setPassQr(null)}
              className="mt-4 w-full py-2.5 bg-primary text-white rounded-full text-sm font-bold hover:bg-[#ff2d87] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <style>{`
        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
