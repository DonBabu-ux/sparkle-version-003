import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';

interface PollOption {
  option_id: string;
  option_text: string;
  vote_count: number;
}

interface PollDetail {
  poll_id: string;
  question: string;
  creator_name?: string;
  username?: string;
  is_anonymous?: boolean;
  total_votes?: number;
  created_at: string;
  campus?: string;
  options?: PollOption[];
  user_voted_option?: string;
}

export default function PollDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [poll, setPoll] = useState<PollDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchPoll();
  }, [id]);

  const fetchPoll = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/polls/${id}/results`);
      const data = res.data.poll || res.data;
      setPoll(data);
      if (data.user_voted_option) setSelected(data.user_voted_option);
    } catch (err) {
      console.error('Poll detail fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (optionId: string) => {
    if (poll?.user_voted_option || voting) return;
    setVoting(true);
    setSelected(optionId);
    try {
      await api.post(`/polls/${id}/vote`, { option_id: optionId });
      fetchPoll();
    } catch (err) {
      console.error('Vote error:', err);
      setSelected(poll?.user_voted_option || null);
    } finally {
      setVoting(false);
    }
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="pld-content">
        <main className="pld-container">
          <button className="pld-back-btn" onClick={() => navigate('/polls')}>
            <ArrowLeft size={18} /> Back to Polls
          </button>

          {loading ? (
            <div className="pld-skeleton">
              <div className="pld-sk-line pulse" style={{ width: '80%', height: 22, marginBottom: 10 }} />
              <div className="pld-sk-line pulse" style={{ width: '40%', height: 13, marginBottom: 30 }} />
              {[...Array(4)].map((_, i) => (
                <div key={i} className="pld-sk-option pulse" />
              ))}
            </div>
          ) : !poll ? (
            <div className="pld-not-found">
              <BarChart2 size={48} />
              <h3>Poll not found</h3>
              <button onClick={() => navigate('/polls')}>Back to Polls</button>
            </div>
          ) : (
            <div className="pld-card">
              <div className="pld-header">
                <BarChart2 size={22} className="pld-icon" />
                <div>
                  <div className="pld-meta">
                    By {poll.is_anonymous ? 'Anonymous' : (poll.creator_name || `@${poll.username}`)}
                    {' • '}{new Date(poll.created_at).toLocaleDateString()}
                    {poll.campus && ` • ${poll.campus}`}
                  </div>
                  <div className="pld-total">{poll.total_votes || 0} total votes</div>
                </div>
              </div>

              <h2 className="pld-question">{poll.question}</h2>

              {poll.user_voted_option && (
                <div className="pld-voted-notice">✔ You've already voted on this poll</div>
              )}

              <div className="pld-options">
                {poll.options?.map(opt => {
                  const pct = poll.total_votes && poll.total_votes > 0
                    ? Math.round((opt.vote_count / poll.total_votes) * 100) : 0;
                  const isSelected = selected === opt.option_id;
                  const hasVoted = !!poll.user_voted_option;

                  return (
                    <button
                      key={opt.option_id}
                      className={`pld-option ${hasVoted ? 'has-voted' : 'can-vote'} ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleVote(opt.option_id)}
                      disabled={hasVoted || voting}
                    >
                      <div className="pld-option-top">
                        <span className="pld-option-text">{opt.option_text}</span>
                        {hasVoted && <span className="pld-option-pct">{pct}%</span>}
                      </div>
                      {hasVoted && (
                        <div className="pld-option-bar-wrap">
                          <div className="pld-option-bar">
                            <div className="pld-option-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="pld-vote-count">{opt.vote_count} votes</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </main>
      </div>

      <style>{`
        .page-wrapper { display: flex; background: var(--bg-main, #f8fafc); min-height: 100vh; }
        .pld-content { flex: 1; }
        .pld-container { max-width: 640px; margin: 0 auto; padding: 30px 20px 80px; }
        .pld-back-btn { display: inline-flex; align-items: center; gap: 8px; background: white; border: 1px solid #e2e8f0; padding: 10px 18px; border-radius: 12px; font-weight: 700; font-size: 14px; color: #334155; cursor: pointer; margin-bottom: 24px; transition: 0.2s; }
        .pld-back-btn:hover { border-color: #FF3D6D; color: #FF3D6D; }
        .pld-card { background: white; border-radius: 28px; padding: 36px; box-shadow: 0 8px 30px rgba(0,0,0,0.07); border: 1px solid rgba(0,0,0,0.05); }
        .pld-header { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 20px; }
        .pld-icon { color: var(--primary, #FF3D6D); flex-shrink: 0; margin-top: 2px; }
        .pld-meta { font-size: 13px; color: #94a3b8; font-weight: 500; margin-bottom: 3px; }
        .pld-total { font-size: 13px; color: #64748b; font-weight: 700; }
        .pld-question { font-size: 1.5rem; font-weight: 900; color: #0f172a; margin: 0 0 24px; line-height: 1.3; letter-spacing: -0.5px; }
        .pld-voted-notice { background: #dcfce7; color: #166534; padding: 10px 16px; border-radius: 12px; font-size: 13px; font-weight: 700; margin-bottom: 20px; }
        .pld-options { display: flex; flex-direction: column; gap: 12px; }
        .pld-option { width: 100%; text-align: left; padding: 16px 20px; border-radius: 16px; border: 2px solid #e2e8f0; background: white; cursor: pointer; transition: all 0.25s; }
        .pld-option.can-vote:hover { border-color: #FF3D6D; background: #fff5f7; transform: translateY(-2px); }
        .pld-option.has-voted { cursor: default; }
        .pld-option.selected { border-color: #FF3D6D; background: linear-gradient(135deg, rgba(255,107,139,0.08), rgba(255,61,109,0.05)); }
        .pld-option:disabled { opacity: 1; }
        .pld-option-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .pld-option-text { font-weight: 700; font-size: 15px; color: #1e293b; }
        .pld-option-pct { font-size: 15px; font-weight: 800; color: var(--primary, #FF3D6D); }
        .pld-option-bar-wrap { display: flex; align-items: center; gap: 10px; }
        .pld-option-bar { flex: 1; background: #f1f5f9; height: 7px; border-radius: 4px; overflow: hidden; }
        .pld-option-fill { height: 100%; background: linear-gradient(90deg, #FF6B8B, #FF3D6D); border-radius: 4px; transition: width 0.6s ease; }
        .pld-vote-count { font-size: 12px; color: #94a3b8; font-weight: 600; white-space: nowrap; }
        .pld-skeleton { background: white; border-radius: 28px; padding: 36px; border: 1px solid rgba(0,0,0,0.05); }
        .pld-sk-line { border-radius: 6px; background: #f1f5f9; }
        .pld-sk-option { height: 60px; border-radius: 16px; background: #f1f5f9; margin-bottom: 12px; }
        .pulse { animation: pldPulse 1.5s ease-in-out infinite; }
        @keyframes pldPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .pld-not-found { text-align: center; padding: 80px; color: #94a3b8; }
        .pld-not-found h3 { font-size: 1.2rem; font-weight: 800; color: #334155; margin: 16px 0 12px; }
        .pld-not-found button { background: linear-gradient(135deg,#FF6B8B,#FF3D6D); color: white; border: none; padding: 12px 24px; border-radius: 14px; font-weight: 700; cursor: pointer; }
      `}</style>
    </div>
  );
}
