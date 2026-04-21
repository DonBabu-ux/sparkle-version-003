import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCheck, X, Clock } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';

interface FollowRequest {
  id: string;
  username: string;
  name?: string;
  avatar_url?: string;
}

export default function FollowRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/users/follow-requests');
      setRequests(res.data.requests || res.data || []);
    } catch (err) {
      console.error('Failed to load follow requests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleRequest = async (requestId: string, action: 'accept' | 'reject') => {
    setProcessing(prev => new Set([...prev, requestId]));
    try {
      await api.post(`/users/follow-requests/${requestId}/${action}`);
      setRequests(prev => prev.filter(r => r.id !== requestId));
    } catch (err) {
      console.error('Request action failed:', err);
    } finally {
      setProcessing(prev => { const next = new Set(prev); next.delete(requestId); return next; });
    }
  };

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="fr-content">
        <main className="fr-container">
          <div className="fr-page-header">
            <UserCheck size={28} className="fr-header-icon" />
            <div>
              <h1>Follow Requests</h1>
              <p>{requests.length} pending request{requests.length !== 1 ? 's' : ''}</p>
            </div>
          </div>

          {loading ? (
            <div className="fr-list">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="fr-skeleton">
                  <div className="frs-avatar pulse" />
                  <div className="frs-info">
                    <div className="frs-line pulse" style={{ width: '45%', marginBottom: 6 }} />
                    <div className="frs-line pulse" style={{ width: '65%' }} />
                  </div>
                  <div className="frs-btns">
                    <div className="frs-btn-box pulse" />
                    <div className="frs-btn-box pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : requests.length === 0 ? (
            <div className="fr-empty">
              <div className="fr-empty-icon"><Clock size={48} /></div>
              <h3>No Pending Requests</h3>
              <p>When people request to follow you, they'll appear here.</p>
            </div>
          ) : (
            <div className="fr-list">
              {requests.map(req => (
                <div
                  key={req.id}
                  className={`fr-card ${processing.has(req.id) ? 'fading' : ''}`}
                >
                  <div className="fr-user-info" onClick={() => navigate(`/profile/${req.username}`)}>
                    <img
                      src={req.avatar_url || '/uploads/avatars/default.png'}
                      className="fr-avatar"
                      alt={req.username}
                      onError={(e) => { (e.target as HTMLImageElement).src = '/uploads/avatars/default.png'; }}
                    />
                    <div className="fr-details">
                      <h4>{req.username}</h4>
                      <p>{req.name || 'Sparkle User'}</p>
                    </div>
                  </div>
                  <div className="fr-actions">
                    <button
                      className="fr-accept-btn"
                      onClick={() => handleRequest(req.id, 'accept')}
                      disabled={processing.has(req.id)}
                    >
                      Confirm
                    </button>
                    <button
                      className="fr-reject-btn"
                      onClick={() => handleRequest(req.id, 'reject')}
                      disabled={processing.has(req.id)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <style>{`
        .page-wrapper { display: flex; background: var(--bg-main, #f8fafc); min-height: 100vh; }
        .fr-content { flex: 1; padding: 30px 20px; }
        .fr-container { max-width: 620px; margin: 0 auto; }

        .fr-page-header { display: flex; align-items: center; gap: 16px; margin-bottom: 30px; padding: 28px 30px; background: white; border-radius: 24px; border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 4px 20px rgba(0,0,0,0.04); }
        .fr-header-icon { color: var(--primary, #FF3D6D); }
        .fr-page-header h1 { font-size: 1.6rem; font-weight: 900; color: #1e293b; margin: 0 0 4px; letter-spacing: -0.5px; }
        .fr-page-header p { font-size: 0.9rem; color: #64748b; margin: 0; font-weight: 600; }

        .fr-list { display: flex; flex-direction: column; gap: 12px; }

        .fr-card { background: white; border-radius: 18px; padding: 16px 18px; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 12px rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.05); transition: all 0.3s ease; }
        .fr-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
        .fr-card.fading { opacity: 0.5; pointer-events: none; transform: translateX(20px); }

        .fr-user-info { display: flex; align-items: center; gap: 14px; cursor: pointer; flex: 1; }
        .fr-avatar { width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 2px solid #f1f5f9; }
        .fr-details h4 { margin: 0 0 3px; font-size: 15px; font-weight: 800; color: #1e293b; }
        .fr-details p { margin: 0; font-size: 13px; color: #64748b; font-weight: 500; }

        .fr-actions { display: flex; align-items: center; gap: 8px; }
        .fr-accept-btn { background: var(--primary, #FF3D6D); color: white; border: none; padding: 9px 18px; border-radius: 12px; cursor: pointer; font-weight: 700; font-size: 13px; transition: 0.2s; }
        .fr-accept-btn:hover { opacity: 0.85; transform: scale(1.02); }
        .fr-accept-btn:disabled { opacity: 0.5; cursor: wait; }
        .fr-reject-btn { background: #f1f5f9; color: #64748b; border: none; width: 36px; height: 36px; border-radius: 10px; cursor: pointer; font-weight: 700; transition: 0.2s; display: flex; align-items: center; justify-content: center; }
        .fr-reject-btn:hover { background: #fee2e2; color: #ef4444; }
        .fr-reject-btn:disabled { opacity: 0.5; cursor: wait; }

        .fr-skeleton { display: flex; align-items: center; gap: 14px; background: white; padding: 16px 18px; border-radius: 18px; border: 1px solid #f8fafc; }
        .frs-avatar { width: 52px; height: 52px; border-radius: 50%; background: #f1f5f9; flex-shrink: 0; }
        .frs-info { flex: 1; }
        .frs-line { height: 12px; border-radius: 6px; background: #f1f5f9; }
        .frs-btns { display: flex; gap: 8px; }
        .frs-btn-box { width: 72px; height: 34px; border-radius: 10px; background: #f1f5f9; }
        .pulse { animation: pulseFr 1.5s ease-in-out infinite; }
        @keyframes pulseFr { 0%,100%{opacity:1} 50%{opacity:0.5} }

        .fr-empty { text-align: center; padding: 80px 20px; background: white; border-radius: 24px; border: 1px solid rgba(0,0,0,0.05); }
        .fr-empty-icon { width: 90px; height: 90px; background: #f8fafc; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: #cbd5e1; }
        .fr-empty h3 { font-size: 1.3rem; font-weight: 800; color: #1e293b; margin: 0 0 8px; }
        .fr-empty p { font-size: 14px; color: #64748b; }
      `}</style>
    </div>
  );
}
