import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import api from '../api/api';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=640&q=80&auto=format';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return setError('Please enter your email address.');
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Failed to send. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fp-page">
      <div className="fp-orb fp-orb--1" />
      <div className="fp-orb fp-orb--2" />

      <div className={`fp-container ${mounted ? 'is-visible' : ''}`}>

        {/* LEFT */}
        <div className="fp-left">
          <div className="fp-img-wrap">
            <img src={HERO_IMAGE} alt="Secure account recovery" className="fp-img" />
            <div className="fp-img-overlay" />
            <div className="fp-img-text">
              <div className="fp-img-badge">
                <Sparkles size={14} strokeWidth={2.5} />
                Account Recovery
              </div>
              <h2 className="fp-img-headline">We'll get you<br />back in.</h2>
            </div>
          </div>

          <div className="fp-info">
            <h1 className="fp-logo">Sparkle</h1>
            <p className="fp-tagline">
              Lost your password? No worries. We'll send a secure one-time code to your email.
            </p>
          </div>
        </div>

        {/* RIGHT */}
        <div className="fp-card-wrap">
          <div className="fp-card">
            {error && (
              <div className="fp-toast">
                <span className="fp-toast__dot" />
                {error}
              </div>
            )}

            {!sent ? (
              <>
                <div className="fp-card__head">
                  <h3 className="fp-card__title">Reset password</h3>
                  <p className="fp-card__sub">Enter the email linked to your account</p>
                </div>

                <form onSubmit={handleSubmit} className="fp-form">
                  <div className="fp-field">
                    <label htmlFor="fp-email" className="fp-label">
                      <Mail size={14} strokeWidth={2.5} />
                      Email address
                    </label>
                    <input
                      id="fp-email"
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(''); }}
                      className="fp-input"
                      placeholder="you@university.edu"
                      autoFocus
                    />
                  </div>

                  <button type="submit" disabled={loading} className="fp-btn fp-btn--main">
                    {loading ? <span className="fp-spin" /> : <><span>Send recovery code</span><ArrowRight size={18} strokeWidth={2.5} /></>}
                  </button>

                  <Link to="/login" className="fp-back">
                    <ArrowLeft size={15} strokeWidth={2.5} />
                    Back to login
                  </Link>
                </form>
              </>
            ) : (
              <div className="fp-success">
                <div className="fp-success__icon">
                  <Mail size={36} strokeWidth={1.5} />
                </div>
                <h3 className="fp-card__title">Check your inbox</h3>
                <p className="fp-card__sub">
                  We sent a code to <strong style={{ color: '#e11d48' }}>{email}</strong>
                </p>

                <Link
                  to={`/reset-password?email=${encodeURIComponent(email)}&mode=otp`}
                  className="fp-btn fp-btn--main"
                >
                  Enter code
                  <ArrowRight size={18} strokeWidth={2.5} />
                </Link>

                <button onClick={() => setSent(false)} className="fp-back-text" type="button">
                  Try a different email
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .fp-page {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          padding: 1.5rem; background: #fdf2f4; position: relative; overflow: hidden;
          font-family: 'Nunito Sans', system-ui, sans-serif;
        }
        .fp-orb {
          position: absolute; border-radius: 50%; filter: blur(90px);
          opacity: 0.4; pointer-events: none; will-change: transform;
        }
        .fp-orb--1 {
          width: 460px; height: 460px;
          background: radial-gradient(circle, #fda4af, transparent 70%);
          top: -10%; left: -6%;
          animation: fp-drift 20s ease-in-out infinite;
        }
        .fp-orb--2 {
          width: 360px; height: 360px;
          background: radial-gradient(circle, #fbcfe8, transparent 70%);
          bottom: -8%; right: -4%;
          animation: fp-drift 24s ease-in-out infinite reverse;
        }
        @keyframes fp-drift {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(20px, -15px); }
        }

        .fp-container {
          position: relative; z-index: 1; width: 100%; max-width: 1000px;
          display: grid; grid-template-columns: 1fr; gap: 2rem; align-items: center;
          opacity: 0; transform: translateY(20px);
          transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1),
                      transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .fp-container.is-visible { opacity: 1; transform: translateY(0); }
        @media (min-width: 1024px) {
          .fp-container { grid-template-columns: 1fr 400px; gap: 4rem; }
        }

        .fp-left { display: none; }
        @media (min-width: 1024px) { .fp-left { display: flex; flex-direction: column; gap: 1.75rem; } }

        .fp-img-wrap {
          position: relative; border-radius: 20px; overflow: hidden;
          box-shadow: 0 16px 48px rgba(190,18,60,0.1);
        }
        .fp-img { width: 100%; height: 260px; object-fit: cover; display: block; }
        .fp-img-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(136,19,55,0.75) 0%, rgba(136,19,55,0.15) 55%, transparent 100%);
        }
        .fp-img-text {
          position: absolute; bottom: 0; left: 0; padding: 1.5rem;
          display: flex; flex-direction: column; gap: 0.5rem;
        }
        .fp-img-badge {
          display: inline-flex; align-items: center; gap: 0.35rem;
          background: rgba(255,255,255,0.2); backdrop-filter: blur(8px);
          padding: 0.3rem 0.7rem; border-radius: 8px;
          font-size: 0.7rem; font-weight: 700; color: #fff;
          width: fit-content; text-transform: none; font-style: normal;
        }
        .fp-img-headline {
          font-family: 'Varela Round', sans-serif;
          font-weight: 700; font-size: 2rem; line-height: 1.15;
          color: #fff; text-transform: none; font-style: normal;
        }

        .fp-info { display: flex; flex-direction: column; gap: 0.75rem; }
        .fp-logo {
          font-family: 'Varela Round', sans-serif;
          font-weight: 700; font-size: 2.4rem; color: #be123c;
          text-transform: none; font-style: normal;
        }
        .fp-tagline {
          font-size: 1rem; line-height: 1.55; color: #78716c;
          max-width: 420px; text-transform: none; font-style: normal;
        }

        .fp-card-wrap { display: flex; justify-content: center; }
        @media (min-width: 1024px) { .fp-card-wrap { justify-content: flex-end; } }

        .fp-card {
          width: 100%; max-width: 400px;
          background: rgba(255,255,255,0.88);
          backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.65);
          border-radius: 22px; padding: 2.25rem;
          box-shadow: 0 20px 60px rgba(190,18,60,0.08), 0 4px 14px rgba(0,0,0,0.03);
          transition: box-shadow 0.35s ease;
        }
        .fp-card:hover {
          box-shadow: 0 24px 68px rgba(190,18,60,0.12), 0 6px 20px rgba(0,0,0,0.04);
        }

        .fp-card__head { margin-bottom: 1.5rem; }
        .fp-card__title {
          font-family: 'Varela Round', sans-serif;
          font-weight: 700; font-size: 1.6rem; color: #1c1917;
          text-transform: none; font-style: normal; margin-bottom: 0.2rem;
        }
        .fp-card__sub { font-size: 0.85rem; color: #a8a29e; text-transform: none; font-style: normal; }

        .fp-toast {
          display: flex; align-items: center; gap: 0.5rem;
          padding: 0.65rem 0.9rem; border-radius: 11px;
          font-size: 0.82rem; font-weight: 600; margin-bottom: 1rem;
          background: #fff1f2; border: 1px solid #fecdd3; color: #be123c;
          text-transform: none; font-style: normal;
        }
        .fp-toast__dot {
          width: 5px; height: 5px; border-radius: 50%; background: #e11d48; flex-shrink: 0;
        }

        .fp-form { display: flex; flex-direction: column; gap: 1.1rem; }
        .fp-field { display: flex; flex-direction: column; gap: 0.35rem; }
        .fp-label {
          display: flex; align-items: center; gap: 0.35rem;
          font-size: 0.75rem; font-weight: 700; color: #78716c;
          text-transform: none; font-style: normal;
        }
        .fp-label svg { color: #d4d4d4 !important; }

        .fp-input {
          width: 100%; padding: 0.8rem 0.95rem;
          background: rgba(255,241,242,0.35); border: 1.5px solid #fecdd3;
          border-radius: 12px; font-size: 0.92rem; font-weight: 500;
          color: #1c1917; outline: none;
          transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
          text-transform: none; font-style: normal;
        }
        .fp-input::placeholder { color: #d4d4d4; text-transform: none; font-style: normal; }
        .fp-input:focus {
          border-color: #fb7185; background: #fff;
          box-shadow: 0 0 0 3px rgba(251,113,133,0.12);
        }

        .fp-btn {
          display: flex; align-items: center; justify-content: center; gap: 0.45rem;
          width: 100%; padding: 0.85rem; border-radius: 12px;
          font-size: 0.95rem; font-weight: 800; cursor: pointer; border: none;
          transition: background 0.2s ease, box-shadow 0.2s ease, transform 0.12s ease;
          text-decoration: none; text-transform: none; font-style: normal;
        }
        .fp-btn:active { transform: scale(0.975); }
        .fp-btn--main {
          background: linear-gradient(135deg, #fb7185, #e11d48);
          color: #fff; box-shadow: 0 6px 18px rgba(225,29,72,0.22);
        }
        .fp-btn--main:hover { box-shadow: 0 8px 26px rgba(225,29,72,0.32); }
        .fp-btn--main:disabled { opacity: 0.65; cursor: not-allowed; }

        .fp-back {
          display: flex; align-items: center; justify-content: center; gap: 0.35rem;
          font-size: 0.82rem; font-weight: 700; color: #a8a29e;
          cursor: pointer; transition: color 0.2s ease;
          text-transform: none; font-style: normal; text-decoration: none;
        }
        .fp-back:hover { color: #e11d48; }

        .fp-success {
          text-align: center; display: flex; flex-direction: column;
          align-items: center; gap: 1rem;
        }
        .fp-success__icon {
          width: 64px; height: 64px; border-radius: 18px;
          background: linear-gradient(135deg, #fff1f2, #ffe4e6);
          display: flex; align-items: center; justify-content: center;
          color: #e11d48;
        }
        .fp-back-text {
          font-size: 0.78rem; font-weight: 700; color: #a8a29e;
          background: none; border: none; cursor: pointer;
          transition: color 0.2s ease; text-transform: none; font-style: normal;
        }
        .fp-back-text:hover { color: #e11d48; }

        .fp-spin {
          width: 18px; height: 18px;
          border: 2.5px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%;
          animation: fp-spin 0.6s linear infinite;
        }
        @keyframes fp-spin { to { transform: rotate(360deg); } }

        @media (prefers-reduced-motion: reduce) {
          .fp-orb { animation: none; }
          .fp-container { transition: none; }
          .fp-card { transition: none; }
        }
      `}</style>
    </div>
  );
}
