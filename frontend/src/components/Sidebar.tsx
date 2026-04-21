import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Home, 
  Compass, 
  PlayCircle, 
  UserPlus, 
  PlusCircle, 
  ShoppingBag, 
  GraduationCap, 
  Users, 
  BarChart3, 
  Calendar, 
  Settings, 
  LogOut,
  ChevronRight,
  Menu,
  Sparkles,
  Search,
  Ghost,
  Send,
  LayoutDashboard
} from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useModalStore } from '../store/modalStore';
import './Sidebar.css';

export default function Sidebar() {
  const { user, logout } = useUserStore();
  const { setActiveModal } = useModalStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeHub, setActiveHub] = useState<string | null>(null);

  const toggleHub = (hubName: string) => {
    setActiveHub(activeHub === hubName ? null : hubName);
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="fb-sidebar">
      {/* 1. Logo Section */}
      <div className="sidebar-logo animate-fade-in" onClick={() => navigate('/dashboard')}>
        <div className="logo-icon-wrapper">
          <Sparkles size={20} />
        </div>
        <span className="logo-text">Sparkle</span>
      </div>

      <nav className="sidebar-nav">
        <Link to="/dashboard" className={`sidebar-item ${isActive('/dashboard') ? 'active' : ''}`}>
          <div className="sidebar-icon-box"><Home size={22} /></div>
          <span>Home</span>
        </Link>

        {/* 3. Explore */}
        <Link to="/explore" className={`sidebar-item ${isActive('/explore') ? 'active' : ''}`}>
          <div className="sidebar-icon-box"><Compass size={22} /></div>
          <span>Explore</span>
        </Link>

        <div className={`sidebar-hub-container ${activeHub === 'discover' ? 'active' : ''}`}>
          <div className="sidebar-item hub-trigger" onClick={() => toggleHub('discover')}>
            <div className="sidebar-icon-box"><Users size={22} /></div>
            <span>Discover</span>
            <ChevronRight size={14} className="hub-chevron" />
          </div>
          {activeHub === 'discover' && (
            <div className="hub-dropdown glass-card animate-scale-in">
              <Link to="/connect" className="hub-sub-item">
                <Search size={18} />
                <span>Find Students</span>
              </Link>
              <Link to="/follow-requests" className="hub-sub-item">
                <UserPlus size={18} />
                <span>Requests</span>
              </Link>
            </div>
          )}
        </div>

        {/* 4. Moments */}
        <Link to="/moments" className={`sidebar-item ${isActive('/moments') ? 'active' : ''}`}>
          <div className="sidebar-icon-box"><PlayCircle size={22} /></div>
          <span>Moments</span>
        </Link>

        {/* 5. Profile */}
        <Link to={`/profile/${user?.username}`} className={`sidebar-item ${location.pathname.includes('/profile') ? 'active' : ''}`}>
          <div className="sidebar-icon-box">
            <img 
              src={user?.avatar_url || '/uploads/avatars/default.png'} 
              className="sidebar-avatar"
              alt="Profile"
            />
          </div>
          <span>Profile</span>
        </Link>

        <Link to="/confessions" className={`sidebar-item ${isActive('/confessions') ? 'active' : ''}`}>
          <div className="sidebar-icon-box"><Ghost size={22} /></div>
          <span>Confessions</span>
        </Link>

        <Link to="/messages" className={`sidebar-item ${isActive('/messages') ? 'active' : ''}`}>
          <div className="sidebar-icon-box"><Send size={22} /></div>
          <span>Messages</span>
        </Link>

        {/* 9. Create Button */}
        <div className="sidebar-spacer"></div>
        <button className="premium-btn create-trigger-large animate-scale-in" onClick={() => setActiveModal('creation_hub')}>
          <PlusCircle size={20} />
          <span>Create</span>
        </button>

        {/* 9. Sparkle Shop Hub */}
        <div className={`sidebar-hub-container ${activeHub === 'shop' ? 'active' : ''}`}>
          <div className="sidebar-item hub-trigger" onClick={() => toggleHub('shop')}>
            <div className="sidebar-icon-box"><ShoppingBag size={22} /></div>
            <span>Sparkle Shop</span>
            <ChevronRight size={14} className="hub-chevron" />
          </div>
          {activeHub === 'shop' && (
            <div className="hub-dropdown glass-card animate-scale-in">
              <Link to="/marketplace" className="hub-sub-item">
                <ShoppingBag size={18} />
                <span>Marketplace</span>
              </Link>
              <Link to="/skill-market" className="hub-sub-item">
                <GraduationCap size={18} />
                <span>Skill Market</span>
              </Link>
            </div>
          )}
        </div>

        {/* 10. More Menu (At bottom) */}
        <div className={`sidebar-hub-container mt-auto ${activeHub === 'more' ? 'active' : ''}`}>
          <div className="sidebar-item hub-trigger" onClick={() => toggleHub('more')}>
            <div className="sidebar-icon-box"><Menu size={22} /></div>
            <span>More</span>
          </div>
          {activeHub === 'more' && (
            <div className="hub-dropdown up glass-card animate-scale-in">
              <Link to="/groups" className="hub-sub-item">
                <Users size={18} />
                <span>Groups</span>
              </Link>
              <Link to="/polls" className="hub-sub-item">
                <i className="fas fa-poll-h" style={{ width: '18px' }}></i>
                <span>Polls</span>
              </Link>
              <Link to="/events" className="hub-sub-item">
                <Calendar size={18} />
                <span>Events</span>
              </Link>
              <Link to="/settings" className="hub-sub-item">
                <Settings size={18} />
                <span>Settings</span>
              </Link>
              {user?.role?.includes('admin') && (
                <Link to="/admin" className="hub-sub-item">
                  <BarChart3 size={18} />
                  <span>Admin Panel</span>
                </Link>
              )}
              <Link to="/professional-dashboard" className="hub-sub-item">
                <LayoutDashboard size={18} />
                <span>Analytics</span>
              </Link>
              <div className="hub-divider"></div>
              <button onClick={() => { logout(); navigate('/login'); }} className="hub-sub-item logout">
                <LogOut size={18} />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
