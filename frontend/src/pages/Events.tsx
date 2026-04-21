import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users, UserCheck, ChevronDown, ChevronUp, Plus, Clock } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import { useModalStore } from '../store/modalStore';

const TABS = ['All', 'My Campus', 'My Events', 'Trending'];

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
  const [activeTab, setActiveTab] = useState('All');
  const [expandedReqs, setExpandedReqs] = useState<Set<string>>(new Set());

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (activeTab === 'My Campus' && user?.campus) params.campus = user.campus;
      if (activeTab === 'My Events') params.filter = 'managed';
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
    const map: Record<string, { label: string; cls: string }> = {
      pending: { label: '⏳ Pending Approval', cls: 'ev-status-pending' },
      accepted: { label: '✔ Accepted', cls: 'ev-status-accepted' },
      rejected: { label: '❌ Rejected', cls: 'ev-status-rejected' },
      attended: { label: '⭐ Attended', cls: 'ev-status-accepted' },
    };
    const s = map[status];
    return s ? <span className={`ev-status-badge ${s.cls}`}>{s.label}</span> : null;
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="ev-content">
        <main className="ev-container">
          {/* Header */}
          <div className="ev-page-header">
            <div className="ev-header-left">
              <Calendar size={28} className="ev-header-icon" />
              <div>
                <h1>Campus Events</h1>
                <p>Discover, RSVP, and attend events around you</p>
              </div>
            </div>
            <button className="ev-create-btn" onClick={() => setActiveModal('event', fetchEvents)}>
              <Plus size={18} /> Host Event
            </button>
          </div>

          {/* Tabs */}
          <div className="ev-tabs">
            {TABS.map(tab => (
              <button key={tab} className={`ev-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                {tab}
              </button>
            ))}
          </div>

          {/* Events List */}
          {loading ? (
            <div className="ev-list">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="ev-skeleton">
                  <div className="evs-header">
                    <div className="evs-line pulse" style={{ width: '30%', height: 10 }} />
                    <div className="evs-dot pulse" />
                  </div>
                  <div className="evs-line pulse" style={{ width: '70%', height: 18, margin: '10px 0 8px' }} />
                  <div className="evs-line pulse" style={{ width: '50%', height: 12 }} />
                  <div className="evs-line pulse" style={{ width: '100%', height: 8, marginTop: 16 }} />
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="ev-empty">
              <Calendar size={48} className="ev-empty-icon" />
              <h3>No upcoming events</h3>
              <p>Check back later, or host one yourself!</p>
              <button className="ev-create-btn" onClick={() => setActiveModal('event', fetchEvents)}>Create Event</button>
            </div>
          ) : (
            <div className="ev-list">
              {events.map(ev => {
                const progress = ev.max_attendees && ev.max_attendees > 0
                  ? Math.min(100, Math.round(((ev.total_rsvps || 0) / ev.max_attendees) * 100))
                  : 0;
                const spotsLeft = ev.max_attendees ? Math.max(0, ev.max_attendees - (ev.total_rsvps || 0)) : null;
                const isExpanded = expandedReqs.has(ev.event_id);

                return (
                  <div key={ev.event_id} className="ev-card">
                    <div className="ev-card-top">
                      <div className="ev-meta-left">
                        <span className="ev-organizer">{ev.username}</span>
                        <span className="ev-campus-badge">{ev.campus || 'Campus Wide'}</span>
                      </div>
                      <div className="ev-top-right">
                        <span className="ev-live-dot" title="Live Updates Active" />
                        {ev.is_creator && (
                          <button className="ev-manage-btn" onClick={() => navigate(`/events/admin?id=${ev.event_id}`)}>Manage</button>
                        )}
                      </div>
                    </div>

                    <h3 className="ev-title">{ev.title}</h3>

                    <div className="ev-stats-row">
                      <span><Users size={13} /> {ev.total_rsvps || 0} RSVP</span>
                      <span><UserCheck size={13} /> {ev.total_attended || 0} Present</span>
                    </div>

                    <div className="ev-time">
                      <Clock size={13} />
                      {new Date(ev.start_time).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </div>

                    {ev.max_attendees && ev.max_attendees > 0 && (
                      <div className="ev-progress-wrap">
                        <div className="ev-progress-bar">
                          <div
                            className="ev-progress-fill"
                            style={{ width: `${progress}%`, background: progress >= 90 ? '#ef4444' : 'var(--primary-gradient)' }}
                          />
                        </div>
                        <div className="ev-progress-labels">
                          <span>{progress}% FULL</span>
                          <span>{spotsLeft} SPOTS LEFT</span>
                        </div>
                      </div>
                    )}

                    {ev.user_status && (
                      <div style={{ marginBottom: 12 }}>{statusBadge(ev.user_status)}</div>
                    )}

                    <div className="ev-actions">
                      {!ev.user_status && (
                        <button className="ev-btn-primary" onClick={() => handleRSVP(ev.event_id, 'pending')}>RSVP</button>
                      )}
                      {ev.user_status === 'accepted' && (
                        <>
                          <button className="ev-btn-secondary">🎫 Entry Pass</button>
                          <button className="ev-btn-cancel" onClick={() => handleRSVP(ev.event_id, 'not_going')}>Cancel</button>
                        </>
                      )}
                      {ev.user_status && ev.user_status !== 'accepted' && (
                        <button className="ev-btn-cancel" onClick={() => handleRSVP(ev.event_id, 'not_going')}>Withdraw</button>
                      )}
                      <button className="ev-btn-expand" onClick={() => toggleReqs(ev.event_id)}>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="ev-requirements">
                        <strong>EVENT REQUIREMENTS</strong>
                        <p>{ev.requirements || '- No specific requirements'}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* FAB */}
      <button className="ev-fab" onClick={() => setActiveModal('event', fetchEvents)}><Plus size={24} /></button>

      <style>{`
        .page-wrapper { display: flex; background: #f8fafc; min-height: 100vh; }
        .ev-content { flex: 1; overflow-y: auto; }
        .ev-container { max-width: 820px; margin: 0 auto; padding: 30px 20px 100px; }

        .ev-page-header { display: flex; justify-content: space-between; align-items: center; gap: 20px; background: white; border-radius: 24px; padding: 26px 30px; margin-bottom: 24px; border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 4px 20px rgba(0,0,0,0.04); }
        .ev-header-left { display: flex; align-items: center; gap: 16px; }
        .ev-header-icon { color: var(--primary, #FF3D6D); }
        .ev-page-header h1 { font-size: 1.5rem; font-weight: 900; margin: 0 0 4px; color: #1e293b; letter-spacing: -0.5px; }
        .ev-page-header p { font-size: 0.88rem; color: #64748b; margin: 0; }

        .ev-create-btn { display: inline-flex; align-items: center; gap: 8px; background: var(--primary-gradient); color: white; border: none; padding: 12px 22px; border-radius: 14px; font-weight: 800; font-size: 0.9rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 14px rgba(255,61,109,0.25); white-space: nowrap; }
        .ev-create-btn:hover { opacity: 0.9; transform: translateY(-2px); }

        .ev-tabs { display: flex; gap: 8px; margin-bottom: 24px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
        .ev-tabs::-webkit-scrollbar { display: none; }
        .ev-tab { padding: 10px 22px; border-radius: 14px; background: white; border: 1px solid rgba(0,0,0,0.08); color: #64748b; font-weight: 700; cursor: pointer; transition: 0.25s; white-space: nowrap; font-size: 0.88rem; }
        .ev-tab:hover { border-color: #FF3D6D; color: #FF3D6D; }
        .ev-tab.active { background: var(--primary-gradient); color: white; border-color: transparent; box-shadow: 0 4px 14px rgba(255,61,109,0.2); }

        .ev-list { display: flex; flex-direction: column; gap: 16px; }

        .ev-card { background: white; border-radius: 28px; padding: 24px; box-shadow: var(--shadow-md); border: 1px solid rgba(0,0,0,0.04); transition: all 0.5s var(--ease-out); }
        .ev-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); border-color: rgba(255, 61, 109, 0.1); }
        .ev-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        .ev-meta-left { display: flex; flex-direction: column; gap: 3px; }
        .ev-organizer { font-size: 11px; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
        .ev-campus-badge { display: inline-block; background: var(--primary-gradient); color: white; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; width: fit-content; }
        .ev-top-right { display: flex; align-items: center; gap: 10px; }
        .ev-live-dot { width: 10px; height: 10px; background: #10b981; border-radius: 50%; box-shadow: 0 0 0 0 rgba(16,185,129,0.7); animation: livePulse 2s infinite; }
        @keyframes livePulse { 0%{box-shadow:0 0 0 0 rgba(16,185,129,0.7)} 70%{box-shadow:0 0 0 8px rgba(16,185,129,0)} 100%{box-shadow:0 0 0 0 rgba(16,185,129,0)} }
        .ev-manage-btn { background: #f8fafc; border: 1px solid #e2e8f0; color: #475569; padding: 6px 14px; border-radius: 10px; font-size: 12px; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .ev-manage-btn:hover { background: #f1f5f9; }

        .ev-title { font-size: 1.3rem; font-weight: 900; color: #0f172a; margin: 0 0 12px; font-family: 'Outfit', sans-serif; letter-spacing: -0.5px; }
        .ev-stats-row { display: flex; gap: 16px; font-size: 12px; color: #64748b; font-weight: 700; margin-bottom: 8px; cursor: pointer; }
        .ev-stats-row span { display: flex; align-items: center; gap: 5px; }
        .ev-time { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #64748b; font-weight: 600; margin-bottom: 14px; }

        .ev-progress-wrap { margin-bottom: 14px; }
        .ev-progress-bar { height: 7px; background: #e2e8f0; border-radius: 10px; overflow: hidden; }
        .ev-progress-fill { height: 100%; border-radius: 10px; transition: width 0.5s ease; }
        .ev-progress-labels { display: flex; justify-content: space-between; margin-top: 4px; font-size: 10px; font-weight: 800; color: #94a3b8; }

        .ev-status-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 800; padding: 4px 12px; border-radius: 9px; text-transform: uppercase; margin-bottom: 12px; }
        .ev-status-pending { background: #fef3c7; color: #92400e; }
        .ev-status-accepted { background: #dcfce7; color: #166534; }
        .ev-status-rejected { background: #fee2e2; color: #991b1b; }

        .ev-actions { display: flex; gap: 8px; }
        .ev-btn-primary { flex: 3; background: var(--primary-gradient); color: white; border: none; padding: 10px; border-radius: 12px; font-weight: 700; cursor: pointer; transition: 0.2s; }
        .ev-btn-primary:hover { opacity: 0.9; }
        .ev-btn-secondary { flex: 2; background: #f8fafc; color: #334155; border: 1px solid #e2e8f0; padding: 10px; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 13px; }
        .ev-btn-cancel { flex: 1; background: #fef2f2; color: #ef4444; border: 1px solid #fecaca; padding: 10px; border-radius: 12px; font-weight: 700; cursor: pointer; font-size: 13px; }
        .ev-btn-expand { background: #f1f5f9; color: #475569; border: none; padding: 10px 14px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; }

        .ev-requirements { margin-top: 14px; padding: 14px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; font-size: 13px; animation: fadeIn 0.2s ease; }
        .ev-requirements strong { display: block; margin-bottom: 6px; font-size: 11px; color: #94a3b8; }
        .ev-requirements p { margin: 0; color: #475569; white-space: pre-line; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }

        .ev-skeleton { background: white; border-radius: 20px; padding: 22px; border: 1px solid rgba(0,0,0,0.05); }
        .evs-header { display: flex; justify-content: space-between; align-items: center; }
        .evs-dot { width: 10px; height: 10px; border-radius: 50%; background: #e2e8f0; }
        .evs-line { border-radius: 6px; background: #e2e8f0; }
        .pulse { animation: evPulse 1.5s ease-in-out infinite; }
        @keyframes evPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

        .ev-empty { text-align: center; padding: 80px 40px; background: white; border-radius: 24px; border: 1px solid rgba(0,0,0,0.05); }
        .ev-empty-icon { color: #cbd5e1; margin-bottom: 16px; }
        .ev-empty h3 { font-size: 1.3rem; font-weight: 800; color: #1e293b; margin: 0 0 8px; }
        .ev-empty p { color: #64748b; margin: 0 0 24px; }

        .ev-fab { position: fixed; bottom: 36px; right: 36px; width: 56px; height: 56px; border-radius: 50%; background: var(--primary-gradient); color: white; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer; box-shadow: 0 8px 24px rgba(255,61,109,0.35); transition: 0.2s; z-index: 100; }
        .ev-fab:hover { transform: scale(1.1); }
      `}</style>
    </div>
  );
}
