import { useState } from 'react';
import { X, User, Shield, Lock, Bell, LogOut, ChevronRight, Camera, Loader2 } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import api from '../../api/api';

interface SettingsModalProps {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { user, setUser } = useUserStore();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);

  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [major, setMajor] = useState(user?.major || '');
  const [campus, setCampus] = useState(user?.campus || 'University of Nairobi');

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await api.put('/users/profile', { name, bio, major, campus });
      if (res.data) {
        setUser({ ...user, ...res.data.user });
        alert('Profile updated! ✨');
      }
    } catch (err) {
      console.error('Update failed:', err);
      alert('Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const navItems = [
    { id: 'profile', label: 'Edit Profile', icon: <User size={18} /> },
    { id: 'security', label: 'Security', icon: <Shield size={18} /> },
    { id: 'privacy', label: 'Privacy', icon: <Lock size={18} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={18} /> }
  ];

  return (
    <div className="settings-modal-inner">
      <div className="settings-sidebar">
        <div className="sidebar-header">
          <h2>Settings</h2>
        </div>
        <div className="settings-nav">
          {navItems.map(item => (
            <button 
              key={item.id} 
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
              <ChevronRight size={14} className="arrow" />
            </button>
          ))}
          <div className="nav-divider"></div>
          <button className="nav-item logout" onClick={() => { localStorage.clear(); window.location.href='/login'; }}>
            <LogOut size={18} />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      <div className="settings-content">
        <button className="mobile-close" onClick={onClose}><X size={20} /></button>
        
        {activeTab === 'profile' && (
          <div className="tab-pane animate-fade-in">
            <h3>Edit Profile</h3>
            
            <div className="avatar-section">
              <img src={user?.avatar_url || '/uploads/avatars/default.png'} alt="" className="settings-avatar" />
              <div className="avatar-actions">
                <span className="username">@{user?.username}</span>
                <button className="change-photo-btn"><Camera size={14} /> Change photo</button>
              </div>
            </div>

            <div className="settings-form">
              <div className="form-row">
                <label>Name</label>
                <div className="input-col">
                  <input type="text" value={name} onChange={e => setName(e.target.value)} />
                  <p className="field-hint">Help people discover your account by using your real name or nickname.</p>
                </div>
              </div>
              <div className="form-row">
                <label>Bio</label>
                <div className="input-col">
                  <textarea rows={3} value={bio} onChange={e => setBio(e.target.value)} />
                  <p className="field-hint">Tell the campus community about yourself.</p>
                </div>
              </div>
              <div className="form-row">
                <label>Major</label>
                <input type="text" value={major} onChange={e => setMajor(e.target.value)} placeholder="e.g. Computer Science" />
              </div>
              <div className="form-row">
                <label>Campus</label>
                <select value={campus} onChange={e => setCampus(e.target.value)}>
                  <option>University of Nairobi</option>
                  <option>Kenyatta University</option>
                  <option>Moi University</option>
                  <option>Jomo Kenyatta University</option>
                  <option>Daystar University</option>
                </select>
              </div>
              <div className="form-actions">
                <button className="save-settings-btn" onClick={handleSaveProfile} disabled={saving}>
                  {saving ? <Loader2 className="animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab !== 'profile' && (
          <div className="tab-pane empty">
            <Shield size={48} style={{opacity: 0.1, marginBottom: '20px'}} />
            <p>Advanced {activeTab} settings are coming soon to the React version.</p>
          </div>
        )}
      </div>

      <style>{`
        .settings-modal-inner { display: flex; width: 100%; height: 100%; max-height: 80vh; background: white; border-radius: 24px; overflow: hidden; }
        
        /* Sidebar */
        .settings-sidebar { width: 260px; border-right: 1px solid #efefef; background: #fafafa; display: flex; flex-direction: column; }
        .sidebar-header { padding: 32px 24px 20px; }
        .sidebar-header h2 { margin: 0; font-size: 1.5rem; font-weight: 800; }
        
        .settings-nav { flex: 1; padding: 10px 0; }
        .nav-item { width: 100%; display: flex; align-items: center; gap: 14px; padding: 14px 24px; border: none; background: none; cursor: pointer; color: #64748b; font-weight: 600; font-size: 0.95rem; text-align: left; transition: 0.2s; position: relative; }
        .nav-item:hover { background: #f1f5f9; color: var(--text-main); }
        .nav-item.active { background: white; color: var(--primary); }
        .nav-item.active::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--primary); }
        .nav-item .arrow { margin-left: auto; opacity: 0; transition: 0.2s; }
        .nav-item.active .arrow { opacity: 0.5; }
        
        .nav-divider { height: 1px; background: #efefef; margin: 10px 24px; }
        .nav-item.logout { color: #f43f5e; }
        
        /* Content */
        .settings-content { flex: 1; padding: 40px; overflow-y: auto; position: relative; }
        .mobile-close { display: none; position: absolute; top: 20px; right: 20px; background: none; border: none; color: #94a3b8; cursor: pointer; }
        
        .tab-pane h3 { margin: 0 0 32px; font-size: 1.8rem; font-weight: 300; }
        .avatar-section { display: flex; align-items: center; gap: 20px; margin-bottom: 40px; }
        .settings-avatar { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; }
        .avatar-actions { display: flex; flex-direction: column; }
        .avatar-actions .username { font-weight: 700; font-size: 1.1rem; }
        .change-photo-btn { background: none; border: none; color: #0095f6; font-weight: 800; cursor: pointer; padding: 0; font-size: 0.85rem; display: flex; align-items: center; gap: 4px; }

        .settings-form { display: flex; flex-direction: column; gap: 24px; max-width: 500px; }
        .form-row { display: flex; flex-direction: column; gap: 8px; }
        .form-row label { font-weight: 700; font-size: 0.9rem; color: #1e293b; }
        .form-row input, .form-row select, .form-row textarea { padding: 12px 16px; border-radius: 12px; border: 1px solid #e2e8f0; background: #f8fafc; font-family: inherit; font-size: 0.95rem; outline: none; transition: 0.2s; }
        .form-row input:focus, .form-row textarea:focus { border-color: var(--primary); background: white; }
        .field-hint { font-size: 0.75rem; color: #94a3b8; margin: 0; line-height: 1.5; }
        
        .save-settings-btn { padding: 12px 24px; border-radius: 12px; background: var(--primary); color: white; border: none; font-weight: 800; cursor: pointer; transition: 0.2s; margin-top: 20px; }
        .save-settings-btn:hover { opacity: 0.9; }
        .save-settings-btn:disabled { opacity: 0.5; }

        .tab-pane.empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #94a3b8; text-align: center; }

        @media (max-width: 768px) {
          .settings-modal-inner { flex-direction: column; height: 95vh; max-height: none; }
          .settings-sidebar { width: 100%; border-right: none; border-bottom: 1px solid #efefef; }
          .settings-nav { display: flex; overflow-x: auto; padding: 0; }
          .nav-item { width: auto; white-space: nowrap; padding: 16px 20px; }
          .nav-item.active::before { height: 4px; width: 100%; top: auto; bottom: 0; left: 0; }
          .nav-item .arrow { display: none; }
          .sidebar-header { display: none; }
          .mobile-close { display: block; }
          .settings-content { padding: 30px 20px; }
          .settings-form { max-width: none; }
        }
      `}</style>
    </div>
  );
}
