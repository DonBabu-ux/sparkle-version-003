import { useState, useEffect } from 'react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';

export default function Confessions() {
  const { user } = useUserStore();
  const [confessions, setConfessions] = useState<any[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [campus, setCampus] = useState(user?.campus || 'all');

  useEffect(() => {
    const fetchConfessions = async () => {
      setLoading(true);
      try {
        const response = await api.get(`/confessions?campus=${campus}`);
        const data = response.data;
        const list = data.data || data.confessions || (Array.isArray(data) ? data : []);
        setConfessions(list);
      } catch (err) {
        console.error('Failed to fetch confessions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfessions();
  }, [campus]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;

    setSubmitting(true);
    try {
      const response = await api.post('/confessions', { content, campus });
      if (response.data.success || response.data.status === 'success') {
        setContent('');
        const res = await api.get(`/confessions?campus=${campus}`);
        const data = res.data;
        const list = data.data || data.confessions || (Array.isArray(data) ? data : []);
        setConfessions(list);
      }
    } catch (err) {
      console.error('Confession failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReact = async (id: string) => {
    try {
      await api.post(`/confessions/${id}/react`);
      setConfessions(prev => prev.map(c => 
        c.confession_id === id ? { ...c, react_count: (c.react_count || 0) + 1 } : c
      ));
    } catch (err) {
      console.error('Reaction failed:', err);
    }
  };

  return (
    <div className="confessions-root">
      <Navbar />

      <div className="confessions-layout">
        <main className="confessions-main">
          {/* Hero */}
          <div className="confessions-hero">
            <div className="confessions-icon">✨</div>
            <h1 className="confessions-title">Anonymous Sanctuary</h1>
            <p className="confessions-subtitle">A safe space for your untold campus stories</p>

            <div className="campus-filter">
              {[
                { id: 'all', label: 'Global' },
                { id: 'Main Campus', label: 'Main' },
                { id: 'North Campus', label: 'North' },
                { id: 'South Campus', label: 'South' }
              ].map(c => (
                <button
                  key={c.id}
                  onClick={() => setCampus(c.id)}
                  className={`campus-btn${campus === c.id ? ' active' : ''}`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Post Box */}
          <div className="confession-compose-card">
            <form onSubmit={handlePost}>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Share your thoughts with the community, safely and anonymously..."
                className="confession-textarea"
              />
              <div className="confession-compose-footer">
                <div className="encrypted-badge">
                  <span className="pulse-dot-green"></span>
                  <span>Signal Encrypted</span>
                </div>
                <button
                  type="submit"
                  disabled={!content.trim() || submitting}
                  className="confession-submit-btn"
                >
                  {submitting ? 'Sharing...' : 'Share Anonymously'}
                </button>
              </div>
            </form>
          </div>

          {/* Feed */}
          <div className="confession-feed">
            {loading ? (
              <div className="confession-loading">
                <div className="confession-spinner"></div>
                <p>Deciphering Whispers...</p>
              </div>
            ) : confessions.length > 0 ? confessions.map((conf, idx) => (
              <div key={conf.confession_id || idx} className="confession-card">
                <div className="confession-card-header">
                  <div className="confession-fragment">
                    <span className="fragment-dot"></span>
                    <span>Fragment #{String(idx + 1000).padStart(4, '0')}</span>
                  </div>
                  <span className="confession-date">
                    Shared {conf.created_at ? new Date(conf.created_at).toLocaleDateString() : 'recently'}
                  </span>
                </div>
                <p className="confession-content">"{conf.content}"</p>

                <div className="confession-actions">
                  <button onClick={() => handleReact(conf.confession_id)} className="confession-action-btn">
                    <div className="action-icon">🤝</div>
                    <span>{conf.react_count || 0} Supportive</span>
                  </button>
                  <button className="confession-action-btn disabled">
                    <div className="action-icon">💬</div>
                    <span>Observe Signals</span>
                  </button>
                </div>
              </div>
            )) : (
              <div className="confession-empty">
                <p>The silence is absolute.</p>
                <p>The space is quiet for now.</p>
              </div>
            )}
          </div>
        </main>
      </div>

      <style>{`
        .confessions-root {
          display: flex;
          min-height: 100vh;
          background: #1a0b10; /* Soft, deep pink/mauve base */
          color: #fff1f2;
          position: relative;
          overflow: hidden;
        }
        
        /* Drifting background circles - Rosy Hues */
        .confessions-root::before {
          content: '';
          position: absolute;
          top: -10%; left: -10%; width: 40%; height: 40%;
          background: radial-gradient(circle, rgba(244, 63, 94, 0.1) 0%, transparent 70%);
          border-radius: 50%;
          filter: blur(80px);
          animation: drift 20s infinite alternate;
        }
        .confessions-root::after {
          content: '';
          position: absolute;
          bottom: -10%; right: -10%; width: 50%; height: 50%;
          background: radial-gradient(circle, rgba(255, 61, 109, 0.08) 0%, transparent 70%);
          border-radius: 50%;
          filter: blur(100px);
          animation: drift 25s infinite alternate-reverse;
        }
        @keyframes drift {
          from { transform: translate(0, 0); }
          to { transform: translate(100px, 100px); }
        }

        .confessions-layout {
          flex: 1;
          display: flex;
          justify-content: center;
          padding: 80px 20px 120px;
          overflow-y: auto;
          position: relative;
          z-index: 10;
        }
        .confessions-main {
          width: 100%;
          max-width: 680px;
        }

        /* Hero */
        .confessions-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          margin-bottom: 60px;
        }
        .confessions-icon {
          width: 72px; height: 72px;
          background: linear-gradient(135deg, #FF3D6D, #f43f5e);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 2rem;
          box-shadow: 0 10px 40px rgba(255, 61, 109, 0.2);
          border: 1px solid rgba(255,255,255,0.1);
          margin-bottom: 32px;
        }
        .confessions-title {
          font-family: 'Outfit', sans-serif;
          font-size: 3.5rem;
          font-weight: 800;
          letter-spacing: -0.04em;
          color: #f8fafc;
          margin-bottom: 12px;
          background: linear-gradient(to bottom, #fff, #94a3b8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .confessions-subtitle {
          font-size: 0.75rem;
          font-weight: 700;
          color: #FF3D6D;
          text-transform: uppercase;
          letter-spacing: 0.25em;
          margin-bottom: 40px;
          opacity: 0.9;
        }

        /* Campus Filter */
        .campus-filter {
          display: flex;
          gap: 4px;
          background: rgba(15, 23, 42, 0.8);
          padding: 4px;
          border-radius: 40px;
          border: 1px solid rgba(255,255,255,0.05);
          backdrop-filter: blur(20px);
        }
        .campus-btn {
          padding: 10px 24px;
          border-radius: 30px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          border: none;
          cursor: pointer;
          background: transparent;
          color: #94a3b8;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .campus-btn:hover { color: #f8fafc; background: rgba(255,255,255,0.03); }
        .campus-btn.active {
          background: #FF3D6D;
          color: #fff;
          box-shadow: 0 8px 16px rgba(255, 61, 109, 0.2);
        }

        /* Compose Card */
        .confession-compose-card {
          background: #4c0519; /* Deep, vibrant pink/burgundy */
          border-radius: 32px;
          border: 1px solid rgba(255, 61, 109, 0.2);
          margin-bottom: 50px;
          padding: 40px;
          transition: transform 0.3s;
          box-shadow: 0 30px 60px rgba(0,0,0,0.4);
        }
        .confession-compose-card:focus-within {
          transform: translateY(-6px);
          border-color: rgba(255, 61, 109, 0.5);
        }
        .confession-textarea {
          width: 100%;
          background: #2d0611;
          border: 1px solid rgba(255, 61, 109, 0.15);
          border-radius: 24px;
          padding: 24px;
          font-size: 1.05rem;
          font-weight: 400;
          color: #fff;
          font-family: inherit;
          min-height: 160px;
          resize: none;
          outline: none;
          transition: all 0.4s;
          box-sizing: border-box;
          line-height: 1.6;
        }
        .confession-textarea::placeholder { color: #8c4a5c; }
        .confession-textarea:focus { 
          background: #3b0a1a;
          border-color: #FF3D6D; 
          box-shadow: 0 0 40px rgba(255, 61, 109, 0.1); 
        }
        .confession-compose-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 24px;
        }
        .encrypted-badge {
          display: flex; align-items: center; gap: 10px;
          font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
          color: #d17a8f;
        }
        .pulse-dot-green {
          width: 10px; height: 10px;
          background: #ff7eb3;
          border-radius: 50%;
          display: inline-block;
          box-shadow: 0 0 10px rgba(255, 126, 179, 0.6);
          animation: pulseSafe 2s infinite;
        }
        @keyframes pulseSafe { 0%,100%{opacity:1; transform:scale(1);} 50%{opacity:0.4; transform:scale(0.85);} }
        .confession-submit-btn {
          padding: 14px 40px;
          background: #ffffff;
          color: #4c0519;
          border: none;
          border-radius: 100px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 10px 25px rgba(255, 61, 109, 0.2);
        }
        .confession-submit-btn:hover { 
          transform: translateY(-2px);
          background: #ff7eb3;
          color: #fff;
          box-shadow: 0 15px 30px rgba(255, 61, 109, 0.35);
        }
        .confession-submit-btn:disabled { opacity: 0.2; cursor: not-allowed; }

        /* Feed */
        .confession-feed { display: flex; flex-direction: column; gap: 32px; }
        .confession-loading {
          display: flex; flex-direction: column; align-items: center;
          padding: 100px 0; text-align: center;
        }
        .confession-spinner {
          width: 48px; height: 48px;
          border: 3px solid rgba(255, 61, 109, 0.1);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          margin-bottom: 24px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .confession-loading p {
          font-size: 11px; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.2em; color: #d17a8f;
        }

        .confession-card {
          background: #4c0519; /* Deep, vibrant pink/burgundy */
          border-radius: 32px;
          border: 1px solid rgba(255, 61, 109, 0.15);
          padding: 40px;
          transition: all 0.4s;
          box-shadow: 0 20px 50px rgba(0,0,0,0.3);
        }
        .confession-card:hover { 
          border-color: rgba(255, 61, 109, 0.4); 
          background: #5e0b21;
          transform: translateY(-6px);
          box-shadow: 0 30px 70px rgba(0,0,0,0.45);
        }
        .confession-card-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 24px;
        }
        .confession-fragment {
          display: flex; align-items: center; gap: 10px;
          font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b;
        }
        .fragment-dot {
          width: 8px; height: 8px; background: rgba(255, 61, 109, 0.3); border-radius: 50%;
        }
        .confession-date {
          font-size: 10px; font-weight: 600; text-transform: uppercase; color: #334155; letter-spacing: 0.05em;
        }
        .confession-content {
          font-size: 1.15rem; font-weight: 400; color: #e2e8f0;
          line-height: 1.8; margin-bottom: 40px;
        }
        .confession-actions {
          display: flex; gap: 24px;
          padding-top: 24px; border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        .confession-action-btn {
          display: flex; align-items: center; gap: 12px;
          background: none; border: none; cursor: pointer;
          font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
          color: #475569; transition: all 0.3s;
        }
        .confession-action-btn:hover { color: #FF3D6D; }
        .confession-action-btn:hover .action-icon { background: rgba(255, 61, 109, 0.1); color: #FF3D6D; }
        .confession-action-btn.disabled { opacity: 0.3; cursor: default; }
        .action-icon {
          width: 44px; height: 44px;
          background: rgba(2, 6, 23, 0.8);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 14px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1rem; transition: all 0.3s;
        }

        .confession-empty {
          padding: 100px 0; text-align: center;
          background: rgba(15, 23, 42, 0.2);
          border-radius: 40px;
          border: 1px dashed rgba(255,255,255,0.05);
        }
        .confession-empty p {
          font-size: 0.85rem; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.2em; color: #475569;
        }

        @media (max-width: 768px) {
          .confessions-layout { padding: 100px 16px 120px; }
          .confessions-title { font-size: 2.5rem; }
          .confession-card, .confession-compose-card { padding: 24px; }
        }
      `}</style>
    </div>
  );
}
