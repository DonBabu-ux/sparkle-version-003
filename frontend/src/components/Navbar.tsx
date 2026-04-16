import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../store/userStore';
import { useModalStore } from '../store/modalStore';

import PostModal from './modals/PostModal';
import PollModal from './modals/PollModal';
import EventModal from './modals/EventModal';
import ListingModal from './modals/ListingModal';
import ConfessionModal from './modals/ConfessionModal';
import SettingsModal from './modals/SettingsModal';
import ShareModal from './modals/ShareModal';
import FloatingAction from './FloatingAction';

export default function Navbar() {
  const { user, logout } = useUserStore();
  const { activeModal, setActiveModal, triggerSuccess } = useModalStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeHub, setActiveHub] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleHub = (hubName: string) => {
    setActiveHub(activeHub === hubName ? null : hubName);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="sidebar-column animate-slide-in">
        <div className="desktop-sidebar">
          <div className="sidebar-logo">
            <Link to="/dashboard" className="logo-icon-wrapper">
              <i className="fas fa-sparkles"></i>
            </Link>
            <Link to="/dashboard" className="logo-text">Sparkle</Link>
          </div>

          <nav className="sidebar-nav">
            <Link to="/dashboard" className={`sidebar-item ${isActive('/dashboard') ? 'active' : ''}`}>
              <div className="sidebar-icon-box"><i className="fas fa-house-chimney"></i></div>
              <span>Home</span>
            </Link>

            <Link to="/explore" className={`sidebar-item ${isActive('/explore') ? 'active' : ''}`}>
              <div className="sidebar-icon-box"><i className="fas fa-compass"></i></div>
              <span>Explore</span>
            </Link>

            <div className={`sidebar-hub-container ${activeHub === 'discover' ? 'active' : ''}`}>
              <div className="sidebar-item hub-trigger" onClick={() => toggleHub('discover')}>
                <div className="sidebar-icon-box"><i className="fas fa-user-friends"></i></div>
                <span>Discover</span>
                <i className="fas fa-chevron-right hub-chevron"></i>
              </div>
              {activeHub === 'discover' && (
                <div className="hub-dropdown glass-card animate-scale-in" style={{ display: 'block' }}>

                  <Link to="/connect" className="hub-sub-item">
                    <i className="fas fa-search"></i>
                    <span>Find Students</span>
                  </Link>
                  <Link to="/follow-requests" className="hub-sub-item">
                    <i className="fas fa-user-plus"></i>
                    <span>Requests</span>
                  </Link>
                </div>
              )}
            </div>

            <Link to="/moments" className={`sidebar-item ${isActive('/moments') ? 'active' : ''}`}>
              <div className="sidebar-icon-box"><i className="fas fa-play-circle"></i></div>
              <span>Moments</span>
            </Link>

            <Link to="/profile/me" className={`sidebar-item ${location.pathname.startsWith('/profile') ? 'active' : ''}`}>
              <div className="sidebar-icon-box">
                <img 
                  src={user?.avatar_url || '/uploads/avatars/default.png'} 
                  style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid currentColor' }} 
                  alt="Profile"
                />
              </div>
              <span>Profile</span>
            </Link>

            <Link to="/confessions" className={`sidebar-item ${isActive('/confessions') ? 'active' : ''}`}>
              <div className="sidebar-icon-box"><i className="fas fa-user-secret"></i></div>
              <span>Confessions</span>
            </Link>

            <Link to="/messages" className={`sidebar-item ${isActive('/messages') ? 'active' : ''}`}>
              <div className="sidebar-icon-box"><i className="fas fa-paper-plane"></i></div>
              <span>Messages</span>
            </Link>

            <div className="sidebar-spacer" style={{ height: '12px' }}></div>
            <div className="sidebar-hub-container" style={{ margin: '12px auto' }}>
              <button 
                className="premium-btn animate-scale-in" 
                onClick={() => toggleHub('create')}
                style={{ width: '44px', height: '44px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 15px rgba(255, 61, 109, 0.4)' }}>
                <i className="fas fa-plus" style={{ fontSize: '1.4rem' }}></i>
              </button>
              {activeHub === 'create' && (
                <div className="hub-dropdown glass-card animate-scale-in" style={{ display: 'block', position: 'absolute', top: '10px', left: '60px', width: '220px', zIndex: 1000, boxShadow: 'var(--shadow-lg)' }}>
                  <div onClick={() => { setActiveHub(null); setActiveModal('post'); }} className="hub-sub-item" style={{cursor: 'pointer'}}><i className="fas fa-pen"></i><span>Create Post</span></div>
                  <div onClick={() => { setActiveHub(null); setActiveModal('afterglow'); navigate('/afterglow/create'); }} className="hub-sub-item" style={{cursor: 'pointer'}}><i className="fas fa-history"></i><span>Create AfterGlow</span></div>
                  <div onClick={() => { setActiveHub(null); setActiveModal('moment'); navigate('/moments/create'); }} className="hub-sub-item" style={{cursor: 'pointer'}}><i className="fas fa-play-circle"></i><span>Create Moment</span></div>
                  <div className="hub-divider"></div>
                  <div onClick={() => { setActiveHub(null); setActiveModal('listing'); }} className="hub-sub-item" style={{cursor: 'pointer'}}><i className="fas fa-store"></i><span>Sell Item</span></div>
                  <div onClick={() => { setActiveHub(null); setActiveModal('poll'); }} className="hub-sub-item" style={{cursor: 'pointer'}}><i className="fas fa-poll"></i><span>Launch Poll</span></div>
                  <div onClick={() => { setActiveHub(null); setActiveModal('event'); }} className="hub-sub-item" style={{cursor: 'pointer'}}><i className="fas fa-calendar-plus"></i><span>Post Event</span></div>
                  <div onClick={() => { setActiveHub(null); setActiveModal('confession'); }} className="hub-sub-item" style={{cursor: 'pointer'}}><i className="fas fa-fire"></i><span>Share Confession</span></div>
                </div>
              )}
            </div>

            <div className={`sidebar-hub-container ${activeHub === 'shop' ? 'active' : ''}`}>
              <div className="sidebar-item hub-trigger" onClick={() => toggleHub('shop')}>
                <div className="sidebar-icon-box"><i className="fas fa-bag-shopping"></i></div>
                <span>Sparkle Shop</span>
                <i className="fas fa-chevron-right hub-chevron"></i>
              </div>
              {activeHub === 'shop' && (
                <div className="hub-dropdown glass-card animate-scale-in" style={{ display: 'block' }}>
                  <Link to="/marketplace" className="hub-sub-item">
                    <i className="fas fa-store"></i>
                    <span>Marketplace</span>
                  </Link>
                  <Link to="/skill-market" className="hub-sub-item">
                    <i className="fas fa-graduation-cap"></i>
                    <span>Skill Market</span>
                  </Link>
                </div>
              )}
            </div>

            <div className={`sidebar-hub-container ${activeHub === 'more' ? 'active' : ''}`} style={{ marginTop: 'auto', position: 'relative' }}>
              <div className="sidebar-item hub-trigger" onClick={() => toggleHub('more')}>
                <div className="sidebar-icon-box" style={{ fontSize: '1.4rem' }}><i className="fas fa-bars"></i></div>
                <span>More</span>
              </div>
              {activeHub === 'more' && (
                <div className="hub-dropdown up glass-card animate-scale-in" style={{ display: 'block', bottom: 'calc(100% + 12px)', left: '0', position: 'absolute', width: '250px', zIndex: 1000, boxShadow: 'var(--shadow-lg)', padding: '12px' }}>
                  <Link to="/groups" className="hub-sub-item">
                    <i className="fas fa-users"></i>
                    <span>Groups</span>
                  </Link>
                  <Link to="/settings" className="hub-sub-item">
                    <i className="fas fa-cog"></i>
                    <span>Settings</span>
                  </Link>
                  <div className="hub-divider"></div>
                  <div onClick={handleLogout} className="hub-sub-item logout" style={{ color: 'var(--accent)', cursor: 'pointer' }}>
                    <i className="fas fa-sign-out-alt"></i>
                    <span>Logout</span>
                  </div>
                </div>
              )}
            </div>
          </nav>
        </div>
      </div>

      {/* Mobile Top Navigation Bar */}
      <header className="mobile-top-bar">
        <Link to="/dashboard" className="mobile-top-logo">
          <div className="mobile-top-logo-icon"><i className="fas fa-sparkles"></i></div>
          <span className="mobile-top-logo-text">Sparkle</span>
        </Link>
        <div className="mobile-search-wrapper">
          <div className="mobile-search-bar">
            <i className="fas fa-search"></i>
            <input type="text" placeholder="Search Sparkle..." onClick={() => navigate('/search')} readOnly />
          </div>
        </div>
        <div className="mobile-top-actions">
          <NotificationBell />
          <Link to="/profile/me">
            <img 
              src={user?.avatar_url || '/uploads/avatars/default.png'} 
              className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm"
              alt="Profile"
            />
          </Link>
        </div>
      </header>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav">
        <Link to="/dashboard" className={`mobile-nav-item ${isActive('/dashboard') ? 'active' : ''}`}>
          <i className="fas fa-house-chimney"></i>
        </Link>
        <Link to="/explore" className={`mobile-nav-item ${isActive('/explore') ? 'active' : ''}`}>
          <i className="fas fa-compass"></i>
        </Link>
        <Link to="/connect" className={`mobile-nav-item ${isActive('/connect') ? 'active' : ''}`}>
          <i className="fas fa-search"></i>
        </Link>
        <div className="mobile-nav-item create-btn" style={{position: 'relative'}} onClick={() => toggleHub('create-mobile')}>
          <div className="mobile-create-icon">
            <i className="fas fa-plus"></i>
          </div>
          {activeHub === 'create-mobile' && (
            <div className="hub-dropdown glass-card animate-scale-in" style={{ display: 'flex', flexDirection: 'column', position: 'absolute', bottom: '80px', left: '50%', transform: 'translateX(-50%)', width: '220px', zIndex: 1000, boxShadow: 'var(--shadow-lg)' }}>
              <div onClick={(e) => { e.stopPropagation(); setActiveHub(null); setActiveModal('post'); }} className="hub-sub-item" style={{cursor: 'pointer', padding: '16px'}}><i className="fas fa-pen hover:text-white"></i><span>Create Post</span></div>
              <div onClick={(e) => { e.stopPropagation(); setActiveHub(null); navigate('/afterglow/create'); }} className="hub-sub-item" style={{cursor: 'pointer', padding: '16px'}}><i className="fas fa-history text-purple-500"></i><span>Create AfterGlow</span></div>
              <div onClick={(e) => { e.stopPropagation(); setActiveHub(null); navigate('/moments/create'); }} className="hub-sub-item" style={{cursor: 'pointer', padding: '16px'}}><i className="fas fa-play-circle text-rose-500"></i><span>Create Moment</span></div>
              <div className="hub-divider"></div>
              <div onClick={(e) => { e.stopPropagation(); setActiveHub(null); setActiveModal('listing'); }} className="hub-sub-item" style={{cursor: 'pointer', padding: '16px'}}><i className="fas fa-store text-emerald-500"></i><span>Sell Item</span></div>
              <div onClick={(e) => { e.stopPropagation(); setActiveHub(null); setActiveModal('poll'); }} className="hub-sub-item" style={{cursor: 'pointer', padding: '16px'}}><i className="fas fa-poll text-amber-500"></i><span>Launch Poll</span></div>
              <div onClick={(e) => { e.stopPropagation(); setActiveHub(null); setActiveModal('event'); }} className="hub-sub-item" style={{cursor: 'pointer', padding: '16px'}}><i className="fas fa-calendar-plus text-orange-500"></i><span>Post Event</span></div>
              <div onClick={(e) => { e.stopPropagation(); setActiveHub(null); setActiveModal('confession'); }} className="hub-sub-item" style={{cursor: 'pointer', padding: '16px'}}><i className="fas fa-fire text-red-500"></i><span>Share Confession</span></div>
            </div>
          )}
        </div>
        <Link to="/messages" className={`mobile-nav-item ${isActive('/messages') ? 'active' : ''}`}>
          <i className="fas fa-paper-plane"></i>
        </Link>
        <Link to="/moments" className={`mobile-nav-item ${isActive('/moments') ? 'active' : ''}`}>
          <i className="fas fa-play-circle"></i>
        </Link>
      </nav>

      {/* Global Modals */}
      {activeModal && (
        <div className="global-modal-overlay animate-fade-in" onClick={() => setActiveModal(null)}>
          <div className="global-modal-content animate-scale-in" onClick={(e) => e.stopPropagation()}>
            {activeModal === 'post' && <PostModal onClose={() => setActiveModal(null)} onSuccess={triggerSuccess} />}
            {activeModal === 'poll' && <PollModal onClose={() => setActiveModal(null)} onSuccess={triggerSuccess} />}
            {activeModal === 'event' && <EventModal onClose={() => setActiveModal(null)} onSuccess={triggerSuccess} />}
            {activeModal === 'listing' && <ListingModal onClose={() => setActiveModal(null)} onSuccess={triggerSuccess} />}
            {activeModal === 'confession' && <ConfessionModal onClose={() => setActiveModal(null)} onSuccess={triggerSuccess} />}
            {activeModal === 'settings' && <SettingsModal onClose={() => setActiveModal(null)} />}
            {activeModal === 'share' && <ShareModal onClose={() => setActiveModal(null)} />}
          </div>
        </div>
      )}

      <FloatingAction />

      <style>{`
        .sidebar-column { width: 250px; position: sticky; top: 0; height: 100vh; background: #ffffff; border-right: 1px solid var(--border-light); z-index: 100; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .desktop-sidebar { padding: 32px 12px; height: 100%; display: flex; flex-direction: column; }
        .sidebar-logo { display: flex; align-items: center; gap: 16px; padding: 0 10px; margin-bottom: 40px; text-decoration: none; }
        .logo-icon-wrapper { background: var(--primary-gradient); min-width: 40px; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; box-shadow: 0 4px 12px rgba(255, 61, 109, 0.3); transition: transform 0.2s; }
        .logo-text { font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 1.6rem; letter-spacing: -0.5px; background: var(--primary-gradient); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; text-decoration: none; }
        .sidebar-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
        .sidebar-item { display: flex; align-items: center; gap: 16px; padding: 14px 12px; border-radius: 10px; color: var(--text-main); font-weight: 500; font-size: 1.05rem; transition: background-color 0.2s; cursor: pointer; text-decoration: none; }
        .sidebar-item:hover { background-color: rgba(0,0,0,0.04); }
        .sidebar-item.active { font-weight: 800; }
        .sidebar-icon-box { min-width: 28px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: var(--text-main); transition: transform 0.2s; }
        .sidebar-item:hover .sidebar-icon-box { transform: scale(1.05); }
        .sidebar-item.active .sidebar-icon-box { color: var(--primary); }
        
        .sidebar-nav span, .logo-text, .hub-chevron { opacity: 1; visibility: visible; transition: opacity 0.2s; white-space: nowrap; }
        
        .hub-dropdown { padding: 8px; margin-top: 4px; border-radius: 16px; background: white; border: 1px solid var(--border-light); box-shadow: var(--shadow-md); }
        .hub-sub-item { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 10px; font-size: 0.95rem; font-weight: 600; color: var(--text-secondary); text-decoration: none; transition: background-color 0.2s; cursor: pointer; }
        .hub-sub-item:hover { background-color: rgba(0,0,0,0.04); color: var(--text-main); }
        .hub-divider { height: 1px; background: var(--border-light); margin: 8px 0; }

        .sidebar-hub-container { position: relative; }

        /* Responsive Sidebar for medium screens (like Instagram tablet view) */
        @media (min-width: 1025px) and (max-width: 1264px) {
          .sidebar-column { width: 80px; }
          .sidebar-nav span, .logo-text, .hub-chevron { display: none; }
          .sidebar-logo { padding: 0; justify-content: center; }
          .logo-icon-wrapper { margin: 0; }
          .sidebar-item { justify-content: center; padding: 14px 0; }
          .hub-dropdown:not(.up) { position: absolute; left: calc(100% + 10px); top: 0; width: 220px; z-index: 100; }
        }

        .mobile-top-bar { display: none; }
        .mobile-bottom-nav { display: none; }

        @media (max-width: 1024px) {
          .sidebar-column { display: none; }
          .mobile-top-bar {
            display: flex; position: fixed; top: 0; left: 0; width: 100%; height: 70px;
            background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
            border-bottom: 1px solid rgba(255, 255, 255, 0.1); justify-content: space-between; align-items: center;
            z-index: 1000; padding: 0 16px; padding-top: env(safe-area-inset-top); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.03);
          }
          .mobile-top-logo { display: flex; align-items: center; gap: 8px; text-decoration: none; }
          .mobile-top-logo-icon { background: var(--primary-gradient); width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; }
          .mobile-top-logo-text { font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 1.3rem; background: var(--primary-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
          .mobile-top-actions { display: flex; align-items: center; gap: 16px; }
          .mobile-search-wrapper { flex: 1; margin: 0 15px; }
          .mobile-search-bar { background: rgba(0,0,0,0.05); height: 40px; border-radius: 20px; display: flex; align-items: center; padding: 0 15px; gap: 10px; color: #64748b; }
          .mobile-search-bar input { background: none; border: none; outline: none; width: 100%; font-size: 0.9rem; color: #1e293b; }
          
          .mobile-bottom-nav {
            display: flex; position: fixed; bottom: 0; left: 0; width: 100%; height: 75px;
            background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(25px); border-top: 1px solid rgba(255, 255, 255, 0.1);
            justify-content: space-around; align-items: center; z-index: 1000; padding-bottom: env(safe-area-inset-bottom);
          }
          .mobile-nav-item { color: #94a3b8; font-size: 1.6rem; transition: 0.3s; }
          .mobile-nav-item.active { color: var(--primary); }
          .mobile-create-icon { width: 58px; height: 58px; background: var(--primary-gradient); border-radius: 20px; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.8rem; transform: translateY(-20px); border: 4px solid white; box-shadow: 0 10px 25px rgba(255, 61, 109, 0.4); }
        }

        .global-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(16px); z-index: 9999; display: flex; alignItems: center; justifyContent: center; padding: 20px; }
        .global-modal-content { width: 100%; maxWidth: 500px; max-height: 90vh; position: relative; overflow-y: auto; }
      `}</style>
    </>
  );
}

function NotificationBell() {
  return (
    <Link to="/notifications" className="relative text-xl text-slate-800">
      <i className="fas fa-bell"></i>
      <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
    </Link>
  );
}
