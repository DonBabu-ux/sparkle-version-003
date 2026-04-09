import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, Plus, ChevronRight, Hash, Calendar } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import { useModalStore } from '../store/modalStore';

interface PollOption {
  option_id: string;
  option_text: string;
  vote_count: number;
}

interface Poll {
  poll_id: string;
  question: string;
  creator_name?: string;
  username?: string;
  is_anonymous?: boolean;
  total_votes?: number;
  created_at: string;
  campus?: string;
  options?: PollOption[];
  user_voted?: boolean;
}

export default function Polls() {
  const { user } = useUserStore();
  const { setActiveModal } = useModalStore();
  const navigate = useNavigate();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [campusFilter, setCampusFilter] = useState<'all' | 'campus'>('all');

  useEffect(() => { fetchPolls(); }, [campusFilter]);

  const fetchPolls = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (campusFilter === 'campus' && user?.campus) params.campus = user.campus;
      const res = await api.get('/polls', { params });
      setPolls(res.data.polls || res.data || []);
    } catch (err) {
      console.error('Polls fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="polls-content">
        <main className="polls-container">
          {/* Header */}
          <div className="polls-page-header">
            <div className="polls-header-left">
              <BarChart2 size={28} className="polls-header-icon" />
              <div>
                <h1>Campus Polls</h1>
                <p>Vote on what matters to your campus</p>
              </div>
            </div>
            <button className="polls-create-btn" onClick={() => setActiveModal('poll', fetchPolls)}>
              <Plus size={18} /> New Poll
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="polls-filter-tabs">
            <button className={`polls-filter-tab ${campusFilter === 'all' ? 'active' : ''}`} onClick={() => setCampusFilter('all')}>
              <Hash size={14} /> All Campuses
            </button>
            <button className={`polls-filter-tab ${campusFilter === 'campus' ? 'active' : ''}`} onClick={() => setCampusFilter('campus')}>
              My Campus
            </button>
          </div>

          {/* Poll List */}
          {loading ? (
            <div className="polls-list">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="poll-skeleton">
                  <div className="psk-line pulse" style={{ width: '75%', height: 18, marginBottom: 8 }} />
                  <div className="psk-line pulse" style={{ width: '40%', height: 11, marginBottom: 18 }} />
                  <div className="psk-line pulse" style={{ width: '100%', height: 8, marginBottom: 8 }} />
                  <div className="psk-line pulse" style={{ width: '100%', height: 8 }} />
                </div>
              ))}
            </div>
          ) : polls.length === 0 ? (
            <div className="polls-empty">
              <BarChart2 size={44} className="polls-empty-icon" />
              <h3>No active polls</h3>
              <p>Be the first to start a conversation!</p>
              <button className="polls-create-btn" onClick={() => setActiveModal('poll', fetchPolls)}>Create Poll</button>
            </div>
          ) : (
            <div className="polls-list">
              {polls.map(poll => (
                <div key={poll.poll_id} className="poll-card" onClick={() => navigate(`/polls/${poll.poll_id}`)}>
                  <div className="poll-card-top">
                    <div className="poll-question-area">
                      <h3 className="poll-question">{poll.question}</h3>
                      <div className="poll-meta">
                        By {poll.is_anonymous ? 'Anonymous' : (poll.creator_name || `@${poll.username}`)}
                        {' • '}
                        <Calendar size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
                        {' '}{new Date(poll.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="poll-votes-badge">{poll.total_votes || 0} votes</div>
                  </div>

                  {/* Preview Options (first 2) */}
                  {poll.options && poll.options.slice(0, 2).map(opt => {
                    const pct = poll.total_votes && poll.total_votes > 0
                      ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;
                    return (
                      <div key={opt.option_id} className="poll-option-preview">
                        <div className="poll-option-label">
                          <span>{opt.option_text}</span>
                          <span className="poll-option-pct">{pct}%</span>
                        </div>
                        <div className="poll-option-bar">
                          <div className="poll-option-fill" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}

                  <button className="poll-vote-btn">
                    Vote & View All <ChevronRight size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <style>{`
        .page-wrapper { display: flex; background: #f8fafc; min-height: 100vh; }
        .polls-content { flex: 1; overflow-y: auto; }
        .polls-container { max-width: 720px; margin: 0 auto; padding: 30px 20px 100px; }

        .polls-page-header { display: flex; justify-content: space-between; align-items: center; gap: 20px; background: white; border-radius: 24px; padding: 26px 30px; margin-bottom: 24px; border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 4px 20px rgba(0,0,0,0.04); }
        .polls-header-left { display: flex; align-items: center; gap: 16px; }
        .polls-header-icon { color: var(--primary, #FF3D6D); }
        .polls-page-header h1 { font-size: 1.5rem; font-weight: 900; margin: 0 0 4px; color: #1e293b; letter-spacing: -0.5px; }
        .polls-page-header p { font-size: 0.88rem; color: #64748b; margin: 0; }
        .polls-create-btn { display: inline-flex; align-items: center; gap: 7px; background: var(--primary-gradient); color: white; border: none; padding: 12px 22px; border-radius: 14px; font-weight: 800; font-size: 0.9rem; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 14px rgba(255,61,109,0.2); white-space: nowrap; }
        .polls-create-btn:hover { opacity: 0.9; transform: translateY(-2px); }

        .polls-filter-tabs { display: flex; gap: 8px; margin-bottom: 22px; }
        .polls-filter-tab { padding: 10px 20px; border-radius: 14px; background: white; border: 1px solid rgba(0,0,0,0.08); color: #64748b; font-weight: 700; cursor: pointer; transition: 0.2s; font-size: 0.9rem; display: flex; align-items: center; gap: 6px; }
        .polls-filter-tab:hover { border-color: #FF3D6D; color: #FF3D6D; }
        .polls-filter-tab.active { background: var(--primary-gradient); color: white; border-color: transparent; }

        .polls-list { display: flex; flex-direction: column; gap: 16px; }

        .poll-card { cursor: pointer; background: white; border-radius: 22px; padding: 24px; box-shadow: 0 4px 16px rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.05); transition: 0.3s; }
        .poll-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.08); }
        .poll-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; gap: 16px; }
        .poll-question { font-size: 1.1rem; font-weight: 800; color: #0f172a; margin: 0 0 6px; line-height: 1.3; }
        .poll-meta { font-size: 12px; color: #94a3b8; font-weight: 500; display: flex; align-items: center; gap: 3px; flex-wrap: wrap; }
        .poll-votes-badge { background: #f1f5f9; color: #64748b; padding: 4px 12px; border-radius: 12px; font-weight: 700; font-size: 12px; white-space: nowrap; flex-shrink: 0; }

        .poll-option-preview { margin-bottom: 10px; }
        .poll-option-label { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; color: #334155; margin-bottom: 5px; }
        .poll-option-pct { color: #64748b; font-weight: 700; }
        .poll-option-bar { background: #f1f5f9; height: 7px; border-radius: 4px; overflow: hidden; }
        .poll-option-fill { height: 100%; background: var(--primary-gradient); border-radius: 4px; transition: width 0.5s ease; }

        .poll-vote-btn { width: 100%; margin-top: 16px; padding: 12px; border: 1px solid #e2e8f0; background: #f8fafc; color: #334155; border-radius: 14px; font-weight: 700; cursor: pointer; font-size: 14px; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .poll-card:hover .poll-vote-btn { background: var(--primary-gradient); color: white; border-color: transparent; }

        .poll-skeleton { background: white; border-radius: 22px; padding: 24px; border: 1px solid rgba(0,0,0,0.05); }
        .psk-line { border-radius: 6px; background: #f1f5f9; }
        .pulse { animation: pollPulse 1.5s ease-in-out infinite; }
        @keyframes pollPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }

        .polls-empty { text-align: center; padding: 80px 40px; background: white; border-radius: 24px; border: 1px solid rgba(0,0,0,0.05); }
        .polls-empty-icon { color: #cbd5e1; margin-bottom: 16px; }
        .polls-empty h3 { font-size: 1.3rem; font-weight: 800; color: #1e293b; margin: 0 0 8px; }
        .polls-empty p { color: #64748b; margin: 0 0 24px; }
      `}</style>
    </div>
  );
}

