import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import api from '../api/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

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
    <div className="auth-page-wrapper">
      <div className="auth-container animate-scale-in">

        {/* LEFT: Visual Side */}
        <div className="visual-side">
          <img src="/auth-bg.png" alt="" className="auth-visual-bg" />
          <div className="auth-logo-container">
            <h1 className="auth-logo">Sparkle</h1>
            <p className="auth-tagline">
              Account recovery is quick and secure. We'll have you back in no time.
            </p>
          </div>
          <ul className="features-list">
            <li>🔢 Receive a 6-digit OTP code</li>
            <li>🔒 All codes are single-use and encrypted</li>
          </ul>
        </div>

        {/* RIGHT: Form Side */}
        <div className="form-side">
          {error && <div className="auth-message error show">⚠️ {error}</div>}

          <div className="auth-form-container">
            {sent ? (
              /* ── Success State ── */
              <div className="animate-fade-in text-center">
                <div className="panel-header">
                  <div style={{ fontSize: 56, marginBottom: 16 }}>📬</div>
                  <h2 className="panel-title">
                    OTP Code Sent!
                  </h2>
                  <p className="panel-subtitle" style={{ lineHeight: 1.7, maxWidth: 340, margin: '0 auto' }}>
                    We sent a 6-digit code to {email}. Check your inbox, then click below.
                  </p>
                </div>

                <Link
                  to={`/reset-password?email=${encodeURIComponent(email)}&mode=otp`}
                  className="premium-btn"
                  style={{ display: 'flex', textDecoration: 'none', marginBottom: 24 }}
                >
                  Enter OTP Code →
                </Link>

                <button
                  onClick={() => { setSent(false); setError(''); }}
                  className="text-sm font-bold"
                  style={{ color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Try a different email
                </button>
              </div>
            ) : (
              /* ── Form State ── */
              <div className="animate-fade-in">
                <div className="panel-header">
                  <h1 className="panel-title">Forgot Password?</h1>
                  <p className="panel-subtitle">No worries — we'll get you back in.</p>
                </div>

                <form onSubmit={handleSubmit}>

                  {/* Email */}
                  <div className="auth-form-group">
                    <label className="auth-label">Email Address</label>
                    <div className="input-with-icon">
                      <Mail size={16} className="input-icon" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(''); }}
                        placeholder="your@email.com"
                        required
                        autoFocus
                        className="auth-input"
                      />
                    </div>
                  </div>

                  {/* Submit */}
                  <button type="submit" className="premium-btn" disabled={loading} style={{ marginBottom: 24, marginTop: 32 }}>
                    {loading
                      ? <i className="fas fa-circle-notch fa-spin"></i>
                      : 'Send OTP Code'}
                  </button>

                  {/* Divider */}
                  <div className="relative my-6 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-100"></div>
                    </div>
                    <span className="relative px-4 bg-white">or</span>
                  </div>

                  {/* Back to login */}
                  <p className="auth-link" style={{ textAlign: 'center' }}>
                    Remembered it?{' '}
                    <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <ArrowLeft size={13} /> Back to Login
                    </Link>
                  </p>
                </form>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
