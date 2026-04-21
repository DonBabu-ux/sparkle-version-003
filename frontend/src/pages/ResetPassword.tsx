import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, Eye, EyeOff } from 'lucide-react';
import api from '../api/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const emailParam = searchParams.get('email') || '';
  const tokenParam = searchParams.get('token') || searchParams.get('code') || '';

  const [otp, setOtp] = useState(tokenParam);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Password strength
  const strength = (() => {
    if (!newPassword) return 0;
    let s = 0;
    if (newPassword.length >= 8) s++;
    if (/[A-Z]/.test(newPassword)) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    return s;
  })();
  const strengthColors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e'];
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) return setError('Passwords do not match.');
    if (newPassword.length < 8) return setError('Password must be at least 8 characters.');

    const resetCode = otp || tokenParam;
    if (!resetCode) return setError('Missing verification code. Please use the link from your email or enter the code.');

    const payload = { 
      token: resetCode, 
      email: emailParam, 
      code: resetCode, 
      newPassword 
    };
    console.log('[DEBUG] Reset Password Payload:', payload);

    setLoading(true);
    try {
      await api.post('/auth/reset-password', payload);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      setError(e.response?.data?.message || 'Reset failed. The token may have expired.');
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
              Create a strong, unique password to keep your account secure.
            </p>
          </div>
          <ul className="features-list">
            <li>🔒 Use at least 8 characters</li>
            <li>💡 Mix letters, numbers & symbols</li>
            <li>🔑 Never share your password</li>
          </ul>
        </div>

        {/* RIGHT: Form Side */}
        <div className="form-side">
          {error && <div className="auth-message error show">⚠️ {error}</div>}

          <div className="auth-form-container">

            {success ? (
              /* ── Success State ── */
              <div className="animate-fade-in text-center">
                <div className="panel-header">
                  <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
                  <h2 className="panel-title">Password Reset!</h2>
                  <p className="panel-subtitle">
                    Your password has been updated. Redirecting you to login...
                  </p>
                </div>
                {/* Progress bar */}
                <div style={{ height: 4, background: 'var(--border-light)', borderRadius: 99, marginTop: 32, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    background: 'var(--primary-gradient)',
                    borderRadius: 99,
                    animation: 'shrink 3s linear forwards',
                  }}></div>
                </div>
                <style>{`@keyframes shrink { from { width: 100% } to { width: 0% } }`}</style>
              </div>
            ) : (
              /* ── Form State ── */
              <div className="animate-fade-in">
                <div className="panel-header">
                  <h1 className="panel-title">Set New Password</h1>
                  <p className="panel-subtitle">
                    Enter the OTP we sent to {emailParam} and your new password.
                  </p>
                </div>

                <form onSubmit={handleSubmit}>

                  {/* OTP field */}
                  <div className="auth-form-group">
                    <label className="auth-label">6-Digit OTP Code</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••••"
                      required
                      autoFocus
                      className="auth-input"
                      style={{ textAlign: 'center', letterSpacing: '0.5em', fontSize: 22, fontWeight: 800 }}
                    />
                  </div>

                  {/* New Password */}
                  <div className="auth-form-group">
                    <label className="auth-label">New Password</label>
                    <div className="input-with-icon">
                      <Lock size={16} className="input-icon" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 8 characters"
                        required
                        className="auth-input"
                        style={{ paddingRight: 44 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {/* Password strength meter */}
                    {newPassword && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                          {[1, 2, 3, 4].map(i => (
                            <div key={i} style={{
                              flex: 1, height: 4, borderRadius: 99,
                              background: i <= strength ? strengthColors[strength] : 'var(--border-light)',
                              transition: 'all 0.3s',
                            }} />
                          ))}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: strengthColors[strength] }}>
                          {strengthLabels[strength]}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="auth-form-group">
                    <label className="auth-label">Confirm Password</label>
                    <div className="input-with-icon">
                      <Lock size={16} className="input-icon" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your new password"
                        required
                        className="auth-input"
                        style={{
                          borderColor: confirmPassword && newPassword !== confirmPassword
                            ? '#ef4444'
                            : undefined,
                        }}
                      />
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p style={{ fontSize: 12, color: '#ef4444', marginTop: 4, fontWeight: 500 }}>
                        Passwords do not match
                      </p>
                    )}
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    className="premium-btn"
                    disabled={loading}
                    style={{ marginBottom: 20 }}
                  >
                    {loading
                      ? <i className="fas fa-circle-notch fa-spin"></i>
                      : 'Reset Password'}
                  </button>

                  {/* Footer link */}
                  <p className="auth-link" style={{ textAlign: 'center' }}>
                    Didn't receive anything?{' '}
                    <Link to="/forgot-password">Request again</Link>
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
