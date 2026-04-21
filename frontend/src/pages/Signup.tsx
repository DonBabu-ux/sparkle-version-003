import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, Mail, AtSign, Users, Camera, Heart, MessageCircle, Hash } from 'lucide-react';
import api from '../api/api';
import { useUserStore } from '../store/userStore';

type Step = 1 | 2 | 3 | 4 | 5;

const UNIVERSITIES = [
  'Karatina University', 'Chuka University', 'Dedan Kimathi University',
  'Mount Kenya University', "Murang'a University", 'Pwani University',
  'Mount Media University', 'University of Nairobi',
];

const AFFILIATION_TYPES = ['University', 'Company', 'Business', 'Community', 'None'];

export default function Signup() {
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState({
    name: '', username: '', email: '', password: '', phone: '',
    affiliation_type: 'None', campus: '', major: '', year: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  
  const navigate = useNavigate();

  const update = (field: string, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const showError = (msg: string) => { setError(msg); setSuccess(''); };
  const showSuccess = (msg: string) => { setSuccess(msg); setError(''); };

  const prevStep = () => { if (step > 1) setStep((step - 1) as Step); };
  const nextStep = () => { if (step < 5) setStep((step + 1) as Step); };

  const validateStep2 = () => {
    if (!form.name.trim()) return 'Full name is required.';
    if (!form.username.trim() || form.username.length < 3) return 'Username must be at least 3 characters.';
    if (!form.email.trim() || !form.email.includes('@')) return 'Valid email is required.';
    if (!form.password || form.password.length < 6) return 'Password must be at least 6 characters.';
    return '';
  };

  const handleNextFromStep2 = () => {
    const err = validateStep2();
    if (err) { showError(err); return; }
    setError(''); setStep(3);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/signup', {
        name: form.name,
        username: form.username,
        email: form.email,
        password: form.password,
        campus: form.affiliation_type !== 'None' ? form.campus : undefined,
        major: form.major || undefined,
        year: form.year || undefined,
        user_type: 'student',
      });

      if (res.data?.token) {
        // Store token temporarily for after verification
        localStorage.setItem('sparkle_signup_token', res.data.token);
      }
      
      showSuccess('Account created! Please verify your email.');
      setStep(5);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      showError(e.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const { login } = useUserStore();

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length < 6) { showError('Please enter the 6-digit code'); return; }
    setVerifying(true);
    setError('');
    try {
      await api.post('/auth/verify-email', { 
        email: form.email,
        code: otpCode 
      });

      // Log the user in with the signup token
      const signupToken = localStorage.getItem('sparkle_signup_token');
      if (signupToken) {
        // Validate the token and get user data
        const validateRes = await api.get('/auth/validate', {
          headers: { Authorization: `Bearer ${signupToken}` }
        });
        login(signupToken, validateRes.data.user);
        localStorage.removeItem('sparkle_signup_token');
        showSuccess('Verification successful! Logging you in...');
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        showSuccess('Email verified! Please log in.');
        setTimeout(() => navigate('/login'), 2000);
      }
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      showError(e.response?.data?.message || 'Invalid verification code');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="auth-container animate-scale-in">
        
        {/* LEFT Side: Visual/Image */}
        <div className="visual-side">
          <img src="/auth-bg.png" alt="" className="auth-visual-bg" />
          
          <div className="auth-logo-container">
            <h1 className="auth-logo">Sparkle</h1>
            <p className="auth-tagline">Sign up to see photos and videos from your friends on Sparkle.</p>
          </div>

          <ul className="features-list">
            <li><Users size={20} /> Connect with friends</li>
            <li><Camera size={20} /> Share photos and videos</li>
            <li><Heart size={20} /> Like and comment on posts</li>
            <li><MessageCircle size={20} /> Join group chats</li>
          </ul>
        </div>

        {/* RIGHT Side: Form */}
        <div className="form-side">
          {/* Progress Tracker remains at the top */}
          <div className="progress-bar">
            {[1, 2, 3, 4, 5].map((s, i) => (
              <React.Fragment key={s}>
                <div className={`step ${step === s ? 'active' : step > s ? 'completed' : ''}`}>
                  {step > s ? '✓' : s}
                </div>
                {i < 4 && <div className={`step-line ${step > s ? 'completed' : ''}`} />}
              </React.Fragment>
            ))}
          </div>

          {error && <div className="auth-message error show">⚠️ {error}</div>}
          {success && <div className="auth-message success show">✨ {success}</div>}

          {/* Centered Panel content */}
          <div className="auth-form-container">
            
            {/* Step 1: Welcome Options */}
            {step === 1 && (
              <div className="form-panel active">
                <div className="panel-header">
                  <h1 className="panel-title">Create Account</h1>
                  <p className="panel-subtitle">Join the Sparkle community today.</p>
                </div>
                
                <button className="social-btn" style={{ marginBottom: '16px' }}>
                  <img src="https://www.google.com/favicon.ico" alt="" className="social-icon" style={{ width: '18px' }} />
                  Continue with Google
                </button>

                <div className="relative my-8 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                  <span className="relative px-4 bg-white">or</span>
                </div>

                <button className="premium-btn" onClick={nextStep}>
                  Sign up with email or phone
                </button>

                <p className="auth-link">
                  Have an account? <Link to="/login">Log in</Link>
                </p>
              </div>
            )}

            {/* Step 2: Basic Identity */}
            {step === 2 && (
              <div className="form-panel active">
                 <div className="panel-header">
                  <h1 className="panel-title">Basic Info</h1>
                  <p className="panel-subtitle">Tell us who you are.</p>
                </div>

                <div className="auth-form-group">
                  <label className="auth-label">Full Name</label>
                  <div className="input-with-icon">
                    <User size={16} className="input-icon" />
                    <input type="text" value={form.name} onChange={e => update('name', e.target.value)} className="auth-input" placeholder="Enter your full name" required />
                  </div>
                </div>

                <div className="auth-form-group">
                  <label className="auth-label">Username</label>
                  <div className="input-with-icon">
                    <AtSign size={16} className="input-icon" />
                    <input type="text" value={form.username} onChange={e => update('username', e.target.value)} className="auth-input" placeholder="Choose a username" required />
                  </div>
                </div>

                <div className="auth-form-group">
                  <label className="auth-label">Email Address</label>
                  <div className="input-with-icon">
                    <Mail size={16} className="input-icon" />
                    <input type="email" value={form.email} onChange={e => update('email', e.target.value)} className="auth-input" placeholder="Enter your email" required />
                  </div>
                </div>

                <div className="auth-form-group">
                  <label className="auth-label">Password</label>
                  <div className="input-with-icon">
                    <Lock size={16} className="input-icon" />
                    <input type="password" value={form.password} onChange={e => update('password', e.target.value)} className="auth-input" placeholder="Create a strong password" required />
                  </div>
                </div>

                <div className="flex gap-3 mt-8">
                  <button className="social-btn flex-1" onClick={prevStep}>Back</button>
                  <button className="premium-btn flex-1" onClick={handleNextFromStep2}>Continue</button>
                </div>
              </div>
            )}

            {/* Step 3: Affiliation */}
            {step === 3 && (
              <div className="form-panel active">
                 <div className="panel-header">
                  <h1 className="panel-title">Campus Hub</h1>
                  <p className="panel-subtitle">Where do you belong?</p>
                </div>

                <div className="auth-form-group">
                  <label className="auth-label">Affiliation Type</label>
                  <select value={form.affiliation_type} onChange={e => update('affiliation_type', e.target.value)} className="auth-input" style={{ paddingLeft: '12px' }}>
                    {AFFILIATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {form.affiliation_type === 'University' ? (
                  <div className="auth-form-group">
                    <label className="auth-label">Select Campus</label>
                    <select value={form.campus} onChange={e => update('campus', e.target.value)} className="auth-input" style={{ paddingLeft: '12px' }}>
                      <option value="">-- Choose your university --</option>
                      {UNIVERSITIES.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                ) : form.affiliation_type !== 'None' && (
                  <div className="auth-form-group">
                    <label className="auth-label">Organization Name</label>
                    <input type="text" value={form.campus} onChange={e => update('campus', e.target.value)} className="auth-input" placeholder="Enter organization name" style={{ paddingLeft: '12px' }} />
                  </div>
                )}

                <div className="auth-form-group">
                  <label className="auth-label">Major / Field of Study</label>
                  <input type="text" value={form.major} onChange={e => update('major', e.target.value)} className="auth-input" placeholder="e.g. Software Engineering" style={{ paddingLeft: '12px' }} />
                </div>

                <div className="flex gap-3 mt-8">
                  <button className="social-btn flex-1" onClick={prevStep}>Back</button>
                  <button className="premium-btn flex-1" onClick={nextStep}>Next</button>
                </div>
              </div>
            )}

            {/* Step 4: Final Check */}
            {step === 4 && (
              <div className="form-panel active">
                 <div className="panel-header">
                  <h1 className="panel-title">Final Check</h1>
                  <p className="panel-subtitle">Review your details.</p>
                </div>

                <div className="summary-card" style={{ background: '#f9f9f9', padding: '20px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #eee' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span style={{ color: '#8E8E8E', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Identity</span>
                      <span style={{ fontWeight: '700' }}>{form.name} (@{form.username})</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <span style={{ color: '#8E8E8E', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Email</span>
                      <span style={{ fontWeight: '700' }}>{form.email}</span>
                   </div>
                   <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#8E8E8E', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>Campus</span>
                      <span style={{ fontWeight: '700' }}>{form.campus || 'None'}</span>
                   </div>
                </div>

                <button className="premium-btn" onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Creating Account...' : 'Sign Up'}
                </button>

                <p className="text-xs text-center mt-6 text-slate-400 font-medium">
                  By signing up, you agree to our Terms and Privacy Policy.
                </p>

                <button className="social-btn mt-4 w-full" onClick={prevStep}>Go Back</button>
              </div>
            )}

            {/* Step 5: Verification */}
            {step === 5 && (
              <div className="form-panel active text-center">
                 <div className="panel-header">
                  <h1 className="panel-title">Verify Device</h1>
                  <p className="panel-subtitle">Enter the 6-digit code sent to your email.</p>
                </div>

                <div className="auth-form-group">
                   <div className="input-with-icon">
                    <Hash size={16} className="input-icon" />
                    <input 
                      type="text" 
                      value={otpCode} 
                      maxLength={6}
                      onChange={e => setOtpCode(e.target.value.replace(/[^0-9]/g, ''))} 
                      className="auth-input text-center font-black tracking-[8px] py-4 text-2xl" 
                      placeholder="000000" 
                      style={{ paddingLeft: '12px' }}
                    />
                  </div>
                </div>

                <button className="premium-btn" onClick={handleVerifyOTP} disabled={verifying}>
                  {verifying ? 'Verifying...' : 'Complete Signup'}
                </button>

                <button className="auth-link block w-full mt-6 text-indigo-600 font-bold text-sm bg-transparent border-none cursor-pointer">
                  Resend Verification Code
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
