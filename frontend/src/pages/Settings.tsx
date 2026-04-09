import { useState } from 'react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import Navbar from '../components/Navbar';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const { user, setUser } = useUserStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: user?.name || '',
    username: user?.username || '',
    headline: user?.headline || '',
    bio: user?.bio || '',
    campus: user?.campus || '',
    major: user?.major || '',
    website: user?.website || '',
    phone_number: user?.phone_number || '',
    birthday: user?.birthday ? new Date(user.birthday).toISOString().substring(0, 10) : '',
    two_factor_enabled: user?.two_factor_enabled || false,
    is_private: user?.is_private || false,
    show_contact_info: user?.show_contact_info || false,
    show_birthday: user?.show_birthday || false,
    dm_permission: user?.dm_permission || 'everyone',
    theme: user?.theme || 'light'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const val = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;
    setFormData(prev => ({ ...prev, [name]: val }));
  };

  const handleUpdateSetting = async (key: string, value: any) => {
    try {
      await api.put('/users/settings', { [key]: value });
      setUser({ ...user, [key]: value });
    } catch (err) {
      console.error('Failed to update setting:', err);
    }
  };

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError(null);

    try {
      const response = await api.put('/users/profile', formData);
      if (response.data.success || response.status === 200) {
        setSuccess('Profile updated successfully!');
        setUser({ ...user, ...formData });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('sparkleToken');
    navigate('/login');
  };

  return (
    <div className="settings-page">
      <Navbar />

      <div className="settings-content">
        <div className="settings-page-header">
          <div>
            <h1 className="settings-page-title">Settings</h1>
            <p className="settings-page-subtitle">Manage your account preferences</p>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            <i className="fas fa-sign-out-alt"></i> Logout
          </button>
        </div>

        <div className="settings-tabs-row">
          {[
            { id: 'profile', icon: 'fa-user-edit', label: 'Edit Profile' },
            { id: 'security', icon: 'fa-shield-alt', label: 'Security' },
            { id: 'privacy', icon: 'fa-eye-slash', label: 'Privacy' },
            { id: 'messaging', icon: 'fa-comments', label: 'Messaging' },
            { id: 'notifications', icon: 'fa-bell', label: 'Alerts' },
            { id: 'appearance', icon: 'fa-palette', label: 'Display' }
          ].map(tab => (
            <div
              key={tab.id}
              className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <i className={`fas ${tab.icon}`}></i> {tab.label}
            </div>
          ))}
        </div>

        <main className="settings-main">
          <div className="settings-card">
            {activeTab === 'profile' && (
              <div className="settings-section animate-fade-in">
                <div className="section-header">
                  <h2 className="section-title">Edit Profile</h2>
                  <p className="section-desc">Customize how you appear to others.</p>
                </div>

                {success && <div className="alert-success animate-fade-in">✨ {success}</div>}
                {error && <div className="alert-error animate-fade-in">⚠️ {error}</div>}

                <div className="avatar-edit-row">
                  <img src={user?.avatar_url || '/uploads/avatars/default.png'} className="settings-avatar" alt="" />
                  <div className="avatar-actions">
                    <div className="flex gap-4 mb-2">
                      <button className="btn-outline-sm">Upload Photo</button>
                      <button className="btn-outline-sm">Remove</button>
                    </div>
                    <p className="helper-text">Recommended: 400x400 PNG/JPG</p>
                  </div>
                </div>

                <form onSubmit={handleSubmitProfile}>
                  <div className="form-row">
                    <div className="input-group">
                      <label className="label">Full Name</label>
                      <input type="text" name="name" className="input" value={formData.name} onChange={handleChange} />
                    </div>
                    <div className="input-group">
                      <label className="label">Username</label>
                      <input type="text" name="username" className="input" value={formData.username} onChange={handleChange} />
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="label">Headline</label>
                    <input type="text" name="headline" className="input" value={formData.headline} onChange={handleChange} placeholder="e.g. Creator & Designer" />
                  </div>

                  <div className="input-group">
                    <label className="label">Bio</label>
                    <textarea name="bio" className="input" rows={3} value={formData.bio} onChange={handleChange} placeholder="Tell us about yourself..." />
                  </div>

                  <div className="form-row">
                    <div className="input-group">
                      <label className="label">Campus</label>
                      <input type="text" name="campus" className="input" value={formData.campus} onChange={handleChange} />
                    </div>
                    <div className="input-group">
                      <label className="label">Major</label>
                      <input type="text" name="major" className="input" value={formData.major} onChange={handleChange} />
                    </div>
                  </div>

                  <div className="input-group">
                    <label className="label">Website</label>
                    <input type="text" name="website" className="input" value={formData.website} onChange={handleChange} placeholder="https://example.com" />
                  </div>

                  <div className="form-row">
                    <div className="input-group">
                      <label className="label">Phone</label>
                      <input type="text" name="phone_number" className="input" value={formData.phone_number} onChange={handleChange} placeholder="+254..." />
                    </div>
                    <div className="input-group">
                      <label className="label">Birthday</label>
                      <input type="date" name="birthday" className="input" value={formData.birthday} onChange={handleChange} />
                    </div>
                  </div>

                  <button type="submit" disabled={loading} className="premium-btn save-btn">
                    {loading ? 'Saving...' : 'Save Profile Changes'}
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="settings-section animate-fade-in">
                <div className="section-header">
                  <h2 className="section-title">Security & Protection</h2>
                  <p className="section-desc">Keep your account safe and monitored.</p>
                </div>

                <div className="input-group">
                  <label className="label">Email Address (Primary)</label>
                  <input type="email" className="input" value={user?.email || ''} disabled />
                </div>

                <div className="special-card">
                  <div className="flex-between">
                    <div>
                      <h4 className="card-title">6-Digit 2FA PIN</h4>
                      <p className="card-desc">Secure every login attempt.</p>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        name="two_factor_enabled"
                        checked={formData.two_factor_enabled}
                        onChange={(e) => {
                          handleChange(e);
                          handleUpdateSetting('two_factor_enabled', e.target.checked);
                        }}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>

                <div className="mt-8">
                  <span className="group-label">Update Password</span>
                  <input type="password" className="input mb-4" placeholder="Current Password" />
                  <input type="password" className="input mb-4" placeholder="New Password" />
                  <input type="password" className="input mb-4" placeholder="Confirm New Password" />
                  <button className="premium-btn w-full mt-4">Update Password</button>
                </div>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="settings-section animate-fade-in">
                <div className="section-header">
                  <h2 className="section-title">Privacy Control</h2>
                  <p className="section-desc">Manage your visibility across Sparkle.</p>
                </div>

                <div className="settings-list">
                  {[
                    { k: 'is_private', l: 'Private Profile', d: 'Only mutual followers can see posts.' },
                    { k: 'show_contact_info', l: 'Show Contact Info', d: 'Allow discovery by phone/email.' },
                    { k: 'show_birthday', l: 'Show Birthday', d: 'Visible on your public profile.' }
                  ].map(item => (
                    <div key={item.k} className="flex-between py-4 border-b border-slate-50">
                      <div>
                        <h4 className="font-bold text-slate-800">{item.l}</h4>
                        <p className="text-xs text-slate-400">{item.d}</p>
                      </div>
                      <label className="switch">
                        <input
                          type="checkbox"
                          name={item.k}
                          checked={(formData as any)[item.k]}
                          onChange={(e) => {
                            handleChange(e);
                            handleUpdateSetting(item.k, e.target.checked);
                          }}
                        />
                        <span className="slider"></span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'messaging' && (
              <div className="settings-section animate-fade-in">
                <div className="section-header">
                  <h2 className="section-title">Messaging Privacy</h2>
                  <p className="section-desc">Filter who is allowed to send you direct messages.</p>
                </div>

                <div className="radio-group-card">
                  <h3 className="group-title">DM Permissions</h3>
                  <p className="group-desc">Who can send you messages?</p>
                  <div className="radio-options mt-4">
                    {['everyone', 'followers', 'none'].map(opt => (
                      <label key={opt} className="radio-option">
                        <input
                          type="radio"
                          name="dm_permission"
                          value={opt}
                          checked={formData.dm_permission === opt}
                          onChange={(e) => {
                            handleChange(e);
                            handleUpdateSetting('dm_permission', opt);
                          }}
                        />
                        <span className="capitalize">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      <style>{`
        .settings-page {
          display: flex;
          min-height: 100vh;
          background: var(--bg-main);
        }

        .settings-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
          padding: 40px 32px 100px;
          max-width: 900px;
        }

        .settings-page-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 28px;
        }
        .settings-page-title {
          font-size: 2rem;
          font-weight: 800;
          color: var(--text-main);
          font-family: 'Outfit', sans-serif;
        }
        .settings-page-subtitle {
          font-size: 0.9rem;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .logout-btn {
          background: #fee2e2;
          color: #ef4444;
          border: none;
          padding: 10px 20px;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.9rem;
        }
        .logout-btn:hover { background: #fecaca; }

        .settings-tabs-row {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
          margin-bottom: 28px;
          -ms-overflow-style: none;
          scrollbar-width: none;
          flex-wrap: wrap;
        }
        .settings-tabs-row::-webkit-scrollbar { display: none; }
        .tab-item {
          padding: 10px 20px;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-muted);
          cursor: pointer;
          transition: 0.2s;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 8px;
          border: 1.5px solid var(--border-light);
          background: white;
        }
        .tab-item:hover { background: #f1f5f9; color: var(--text-main); }
        .tab-item.active {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
          box-shadow: 0 4px 10px rgba(255, 61, 109, 0.25);
        }

        .settings-main { flex: 1; }
        .settings-card {
          background: white;
          border-radius: 24px;
          border: 1px solid var(--border-light);
          padding: 40px;
          box-shadow: var(--shadow-sm);
        }
        .section-header { margin-bottom: 30px; }
        .section-title { font-size: 1.75rem; font-weight: 800; color: var(--text-main); margin-bottom: 4px; }
        .section-desc { color: var(--text-muted); font-size: 0.95rem; }

        .alert-success { padding: 12px 16px; margin-bottom: 24px; background: #ecfdf5; color: #059669; border-radius: 12px; text-align: center; font-size: 0.9rem; font-weight: 700; border: 1px solid #a7f3d0; }
        .alert-error { padding: 12px 16px; margin-bottom: 24px; background: #fff1f2; color: #e11d48; border-radius: 12px; text-align: center; font-size: 0.9rem; font-weight: 700; border: 1px solid #fecdd3; }

        .avatar-edit-row { display: flex; align-items: center; gap: 20px; margin-bottom: 35px; }
        .settings-avatar { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid var(--primary); }
        .btn-outline-sm { background: white; border: 1.5px solid var(--border-light); padding: 6px 14px; border-radius: 10px; font-size: 0.75rem; font-weight: 700; color: var(--text-secondary); cursor: pointer; }
        .helper-text { font-size: 0.7rem; color: var(--text-muted); }

        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .input-group { margin-bottom: 20px; }
        .label { display: block; font-weight: 700; font-size: 0.85rem; margin-bottom: 8px; color: var(--text-main); }
        .input { width: 100%; padding: 14px 18px; border: 1.5px solid var(--border-light); border-radius: 16px; background: #f8fafc; color: var(--text-main); font-size: 0.95rem; font-family: inherit; transition: all 0.2s; box-sizing: border-box; }
        .input:focus { outline: none; border-color: var(--primary); background: white; box-shadow: 0 0 0 4px rgba(255, 61, 109, 0.08); }
        .mb-4 { margin-bottom: 1rem; }

        .premium-btn.save-btn { width: 100%; margin-top: 10px; justify-content: center; padding: 16px; font-size: 1rem; }

        .special-card { background: #f5f3ff; padding: 20px; border-radius: 20px; border: 1px solid rgba(99, 102, 241, 0.1); margin-bottom: 20px; }
        .card-title { font-size: 0.95rem; font-weight: 800; color: #6366f1; }
        .card-desc { font-size: 0.75rem; color: var(--text-secondary); }

        .flex-between { display: flex; justify-content: space-between; align-items: center; }
        .gap-4 { gap: 1rem; }
        .mt-8 { margin-top: 2rem; }
        .w-full { width: 100%; }
        .mt-4 { margin-top: 1rem; }

        .switch { position: relative; display: inline-block; width: 50px; height: 26px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background: #cbd5e1; transition: .4s; border-radius: 34px; }
        .slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background: white; transition: .4s; border-radius: 50%; }
        input:checked + .slider { background: var(--primary); }
        input:checked + .slider:before { transform: translateX(24px); }

        .group-label { display: block; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: var(--text-muted); margin-bottom: 20px; letter-spacing: 1px; }

        .radio-group-card { padding: 25px; background: #f8fafc; border-radius: 20px; border: 1.5px solid var(--border-light); }
        .group-title { font-size: 1rem; font-weight: 800; color: var(--text-main); }
        .group-desc { font-size: 0.85rem; color: var(--text-muted); }
        .radio-options { display: flex; flex-direction: column; gap: 12px; }
        .radio-option { display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: white; border: 1.5px solid var(--border-light); border-radius: 12px; font-weight: 600; cursor: pointer; transition: 0.2s; }
        .radio-option:hover { border-color: var(--primary); background: #fff1f2; }
        .radio-option input { width: 18px; height: 18px; accent-color: var(--primary); }

        .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
        .border-b { border-bottom-width: 1px; border-bottom-style: solid; }
        .border-slate-50 { border-color: #f8fafc; }
        .font-bold { font-weight: 700; }
        .text-slate-800 { color: #1e293b; }
        .text-xs { font-size: 0.75rem; }
        .text-slate-400 { color: #94a3b8; }

        @media (max-width: 1024px) {
          .settings-content { padding: 80px 16px 100px; }
        }
        @media (max-width: 768px) {
          .form-row { grid-template-columns: 1fr; gap: 0; }
          .settings-card { padding: 24px; border-radius: 16px; }
          .settings-content { padding: 80px 12px 100px; }
        }
      `}</style>
    </div>
  );
}
