import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, Camera, Hash, MessageCircle } from 'lucide-react';
import api from '../api/api';
import { useUserStore } from '../store/userStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA State
  const [show2FA, setShow2FA] = useState(false);
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [twofaUserId, setTwofaUserId] = useState<string | null>(null);
  const [twofaEmail, setTwofaEmail] = useState('');
  const [verifying, setVerifying] = useState(false);

  const { login } = useUserStore();
  const navigate = useNavigate();

  const showError = (msg: string) => { setError(msg); setSuccess(''); };
  const showSuccess = (msg: string) => { setSuccess(msg); setError(''); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { showError('Please fill all fields'); return; }

    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', { username: email, password });
      const data = res.data;

      // Case 1: 2FA required
      if (data?.status === 'twofa_required') {
        setTwofaUserId(data.userId);
        setTwofaEmail(data.email);
        setShow2FA(true);
        setLoading(false);
        return;
      }

      // Case 2: Successful login
      if (data?.status === 'success' && data?.token) {
        if (rememberMe) {
          localStorage.setItem('sparkleUserEmail', email);
        } else {
          localStorage.removeItem('sparkleUserEmail');
        }
        showSuccess('Login successful! Redirecting...');
        login(data.token, data.user);
        setTimeout(() => navigate('/dashboard'), 900);
        return;
      }

      // Fallback
      showError(data?.message || 'Login failed. Please try again.');
    } catch (err: any) {
      showError(err?.response?.data?.message || err?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (index: number, value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '').slice(-1);
    const newPin = [...pin];
    newPin[index] = cleaned;
    setPin(newPin);
    // Auto-advance
    if (cleaned && index < 5) {
      const next = document.getElementById(`pin-${index + 1}`);
      if (next) (next as HTMLInputElement).focus();
    }
  };

  const handlePinKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      const prev = document.getElementById(`pin-${index - 1}`);
      if (prev) (prev as HTMLInputElement).focus();
    }
  };

  const handleVerify2FA = async () => {
    const code = pin.join('');
    if (code.length < 4) { alert('Please enter your full PIN'); return; }

    setVerifying(true);
    try {
      const res = await api.post('/auth/verify-2fa', { userId: twofaUserId, pin: code });
      if (res.data?.token) {
        login(res.data.token, res.data.user);
        showSuccess('Verification successful! Redirecting...');
        setTimeout(() => navigate('/dashboard'), 900);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Invalid PIN');
      setPin(['', '', '', '', '', '']);
      const first = document.getElementById('pin-0');
      if (first) (first as HTMLInputElement).focus();
    } finally {
      setVerifying(false);
    }
  };

  const handleBackToLogin = () => {
    setShow2FA(false);
    setPin(['', '', '', '', '', '']);
    setLoading(false);
  };

  React.useEffect(() => {
    const saved = localStorage.getItem('sparkleUserEmail');
    if (saved) { setEmail(saved); setRememberMe(true); }
  }, []);

  return (
    <div className="auth-page-wrapper">
      <div className="auth-container animate-scale-in">
        
        {/* LEFT: Visual Side */}
        <div className="visual-side">
          <img src="/auth-bg.png" alt="" className="auth-visual-bg" />
          
          <div className="auth-logo-container">
            <h1 className="auth-logo">Sparkle</h1>
            <p className="auth-tagline">
              Connect with friends and the world around you on Sparkle.
            </p>
          </div>
          
          <ul className="features-list">
            <li><Camera size={20} /> See photos and updates</li>
            <li><Hash size={20} /> Follow interests</li>
            <li><MessageCircle size={20} /> Join the conversation</li>
          </ul>
        </div>

        {/* RIGHT: Form Side */}
        <div className="form-side">
          {error && <div className="auth-message error show">⚠️ {error}</div>}
          {success && <div className="auth-message success show">✨ {success}</div>}

          <div className="auth-form-container">
            {!show2FA ? (
              <div className="animate-fade-in">
                <div className="panel-header">
                  <h1 className="panel-title">Welcome Back</h1>
                  <p className="panel-subtitle">Log in to your account.</p>
                </div>

                <form onSubmit={handleLogin}>
                  <div className="auth-form-group">
                    <label className="auth-label">Username or Email</label>
                    <div className="input-with-icon">
                      <User size={16} className="input-icon" />
                      <input 
                        type="text" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        placeholder="Phone, username, or email" 
                        required 
                        className="auth-input" 
                      />
                    </div>
                  </div>

                  <div className="auth-form-group">
                    <label className="auth-label">Password</label>
                    <div className="input-with-icon">
                      <Lock size={16} className="input-icon" />
                      <input 
                        type="password" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        placeholder="Your secure password" 
                        required 
                        className="auth-input" 
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center mb-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={rememberMe} 
                        onChange={e => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" 
                      />
                      <span className="text-sm font-medium text-slate-600">Remember me</span>
                    </label>
                    <Link to="/forgot-password"  className="text-sm font-semibold text-indigo-600 hover:text-indigo-700">Forgot Password?</Link>
                  </div>

                  <button type="submit" className="premium-btn" disabled={loading}>
                    {loading ? <i className="fas fa-circle-notch fa-spin"></i> : 'Log In'}
                  </button>
                </form>

                <div className="relative my-8 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                  <span className="relative px-4 bg-white">or</span>
                </div>

                <button className="social-btn">
                  <img src="https://www.google.com/favicon.ico" alt="" className="w-4 h-4" />
                  Continue with Google
                </button>

                <p className="auth-link">
                  New to Sparkle? <Link to="/signup">Create an account</Link>
                </p>
              </div>
            ) : (
              <div className="animate-fade-in text-center">
                <div className="panel-header">
                  <h2 className="panel-title">Security Check</h2>
                  <p className="panel-subtitle">
                    Enter the code sent to <span className="text-slate-800 font-bold">{twofaEmail}</span>
                  </p>
                </div>

                <div className="flex justify-center gap-3 mb-8">
                  {pin.map((digit, i) => (
                    <input
                      key={i}
                      id={`pin-${i}`}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={e => handlePinInput(i, e.target.value)}
                      onKeyDown={e => handlePinKeyDown(i, e)}
                      className="w-10 h-14 rounded-lg border-2 border-slate-200 bg-slate-50 text-center text-xl font-bold focus:border-indigo-600 focus:bg-white outline-none transition-all"
                    />
                  ))}
                </div>

                <button 
                  className="premium-btn mb-6" 
                  onClick={handleVerify2FA} 
                  disabled={verifying}
                >
                  {verifying ? <i className="fas fa-circle-notch fa-spin"></i> : 'Verify & Continue'}
                </button>

                <button 
                  className="text-sm font-bold text-slate-400 hover:text-indigo-600"
                  onClick={handleBackToLogin}
                >
                  Back to Login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

