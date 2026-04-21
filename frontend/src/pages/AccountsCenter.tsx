import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, UserCircle, Lock, Smartphone, Mail, Key, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import Navbar from '../components/Navbar';

export default function AccountsCenter() {
  const navigate = useNavigate();
  const { user, accounts, removeAccount, switchAccount } = useUserStore();

  const sections = [
    {
      title: 'Profiles',
      items: [
        { label: 'Manage Profiles', icon: UserCircle, sub: 'Switch, add or remove accounts', path: '/settings/profiles' }
      ]
    },
    {
      title: 'Account Settings',
      items: [
        { label: 'Password and security', icon: Lock, sub: 'Change password, 2FA, saved logins', path: '/settings/security' },
        { label: 'Personal details', icon: UserCircle, sub: 'Contact info, identity verification', path: '/settings/details' },
        { label: 'Ad preferences', icon: Smartphone, sub: 'Manage what you see', path: '/settings/ads' }
      ]
    },
    {
      title: 'Login & Security',
      items: [
        { label: 'Recent emails', icon: Mail, sub: 'View communications from Sparkle', path: '/settings/emails' },
        { label: 'Devices', icon: Smartphone, sub: 'Where you are logged in', path: '/settings/devices' },
        { label: 'Recovery codes', icon: Key, sub: 'Generate or reset recovery keys', path: '/settings/recovery' }
      ]
    }
  ];

  return (
    <div className="accounts-center-root">
      <Navbar />
      
      <div className="ac-content">
        <div className="ac-container">
          <header className="ac-header">
            <button onClick={() => navigate(-1)} className="ac-back-btn">
              <ArrowLeft size={24} />
            </button>
            <div className="ac-header-info">
              <h1>Accounts Center</h1>
              <p>Manage your connected experiences and account settings across Sparkle.</p>
            </div>
          </header>

          <div className="ac-main">
            {/* Meta-style Hero Section */}
            <div className="ac-hero-card">
              <div className="ac-hero-icon">
                <ShieldCheck size={48} className="text-white" />
              </div>
              <div className="ac-hero-text">
                <h3>One place for everything</h3>
                <p>Manage your account settings and connected experiences centrally.</p>
              </div>
            </div>

            <div className="ac-sections space-y-6">
              {sections.map(section => (
                <div key={section.title} className="ac-section">
                  <h2 className="ac-section-title">{section.title}</h2>
                  <div className="ac-items-card">
                    {section.items.map(item => (
                      <button key={item.label} className="ac-item-row group">
                        <div className="flex items-center gap-4">
                          <div className="ac-item-icon">
                            <item.icon size={20} />
                          </div>
                          <div className="text-left">
                            <div className="ac-item-label">{item.label}</div>
                            <div className="ac-item-sub">{item.sub}</div>
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-slate-300 group-hover:translate-x-1 transition-transform" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Profiles Management (Directly here for convenience) */}
              <div className="ac-section">
                <h2 className="ac-section-title">Your Profiles</h2>
                <div className="ac-items-card space-y-2 p-2">
                  {accounts.map(acc => (
                    <div key={acc.user.user_id} className="ac-profile-row">
                      <div className="flex items-center gap-3">
                        <img src={acc.user.avatar_url || '/uploads/avatars/default.png'} className="ac-profile-avatar" alt="" />
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{acc.user.name}</span>
                          <span className="text-xs text-slate-500">@{acc.user.username}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {acc.user.user_id === user?.user_id ? (
                          <span className="text-[10px] font-extrabold bg-blue-50 text-blue-500 px-2 py-1 rounded-full uppercase">Active</span>
                        ) : (
                          <>
                            <button 
                              onClick={() => { switchAccount(acc.user.user_id); navigate('/dashboard'); }}
                              className="text-xs font-bold text-blue-500 hover:underline"
                            >
                              Switch
                            </button>
                            <button 
                              onClick={() => removeAccount(acc.user.user_id)}
                              className="p-2 text-slate-400 hover:text-rose-500"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                  <button onClick={() => navigate('/login')} className="ac-add-btn">
                    <Plus size={18} />
                    <span>Add another account</span>
                  </button>
                </div>
              </div>
            </div>
            
            <div className="ac-footer text-center py-8 text-slate-400 text-sm">
              <div className="flex justify-center gap-4 mb-2">
                <span>About</span><span>•</span><span>Privacy</span><span>•</span><span>Terms</span>
              </div>
              <p>© 2026 Sparkle by DonBabu Tech</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .accounts-center-root {
          display: flex;
          background: #F0F2F5;
          min-height: 100vh;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        .ac-content {
          flex: 1;
          height: 100vh;
          overflow-y: auto;
          padding: 20px;
        }
        .ac-container {
          max-width: 600px;
          margin: 40px auto;
        }
        .ac-header {
          display: flex;
          gap: 20px;
          margin-bottom: 30px;
          align-items: flex-start;
        }
        .ac-back-btn {
          background: white;
          border: none;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #1e293b;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          cursor: pointer;
          transition: transform 0.2s;
        }
        .ac-back-btn:active { transform: scale(0.9); }
        .ac-header-info h1 { font-size: 2rem; font-weight: 800; color: #0f172a; margin-bottom: 8px; }
        .ac-header-info p { color: #64748b; font-size: 1rem; line-height: 1.5; }

        .ac-hero-card {
          background: linear-gradient(135deg, #1877F2 0%, #0056b3 100%);
          border-radius: 24px;
          padding: 30px;
          display: flex;
          align-items: center;
          gap: 24px;
          color: white;
          margin-bottom: 40px;
          box-shadow: 0 20px 40px rgba(24, 119, 242, 0.2);
        }
        .ac-hero-text h3 { font-size: 1.25rem; font-weight: 800; margin-bottom: 4px; }
        .ac-hero-text p { font-size: 0.9rem; opacity: 0.9; }

        .ac-section-title {
          font-size: 0.75rem;
          font-weight: 800;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 12px;
          padding-left: 8px;
        }
        .ac-items-card {
          background: white;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
          border: 1px solid rgba(0,0,0,0.05);
        }
        .ac-item-row {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: transparent;
          border: none;
          cursor: pointer;
          border-bottom: 1px solid #f1f5f9;
          transition: background 0.2s;
        }
        .ac-item-row:last-child { border-bottom: none; }
        .ac-item-row:hover { background: #f8fafc; }
        
        .ac-item-icon {
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
        }
        .ac-item-label { font-size: 1rem; font-weight: 700; color: #1e293b; }
        .ac-item-sub { font-size: 0.8rem; color: #64748b; }

        .ac-profile-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-radius: 16px;
          background: #f8fafc;
        }
        .ac-profile-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
        .ac-add-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px;
          border: 1px dashed #e2e8f0;
          background: transparent;
          border-radius: 16px;
          color: #1877F2;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s;
        }
        .ac-add-btn:hover { background: #f0f7ff; border-color: #1877F2; }

        @media (max-width: 768px) {
          .ac-container { margin: 20px auto; padding-bottom: 100px; }
          .ac-header-info h1 { font-size: 1.5rem; }
          .ac-hero-card { flex-direction: column; text-align: center; padding: 20px; }
        }
      `}</style>
    </div>
  );
}
