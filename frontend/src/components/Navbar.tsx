import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, Users, Plus, ChevronDown, X, User, Compass, Ghost, 
  ShoppingBag, Settings as SettingsIcon, 
  LogOut, UserPlus, 
  Calendar, HelpCircle,
  Pen, PlayCircle, History, Store, LayoutGrid,
  Heart, BarChart3, Sparkles, CheckCircle, GraduationCap,
  Search as SearchIcon, ShieldCheck
} from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useModalStore } from '../store/modalStore';

import PostModal from './modals/PostModal';
import PollModal from './modals/PollModal';
import EventModal from './modals/EventModal';
import ListingModal from './modals/ListingModal';
import ConfessionModal from './modals/ConfessionModal';
import SettingsModal from './modals/SettingsModal';
import ShareModal from './modals/ShareModal';
import ReshareModal from './modals/ReshareModal';
import PostCommentsModal from './modals/PostCommentsModal';
import CreationHubModal from './modals/CreationHubModal';
import FloatingAction from './FloatingAction';
import Sidebar from './Sidebar';

export default function Navbar() {
  const { user, logout } = useUserStore();
  const { activeModal, setActiveModal, modalData, triggerSuccess } = useModalStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [gridMenuOpen, setGridMenuOpen] = useState(false);
  const [showMobileCreate, setShowMobileCreate] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Desktop Sidebar (Facebook Style) */}
      <Sidebar />

      {/* Mobile Top Navigation Bar */}
      {location.pathname !== '/search' && (
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
            <div className="relative">
              <button 
                onClick={() => setGridMenuOpen(!gridMenuOpen)}
                className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-800 hover:bg-slate-200 transition-colors focus:outline-none shadow-sm"
              >
                <LayoutGrid size={20} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </header>
      )}


      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav">
        <Link to="/dashboard" className={`mobile-nav-item ${isActive('/dashboard') ? 'active' : ''}`}>
          <Home size={26} />
        </Link>
        <Link to="/connect" className={`mobile-nav-item ${isActive('/connect') ? 'active' : ''}`}>
          <Users size={26} />
        </Link>
        
        <div className="mobile-nav-item" onClick={() => {
          if (window.innerWidth < 1024) {
            setShowMobileCreate(!showMobileCreate);
          } else {
            setActiveModal('creation_hub');
          }
        }}>
          <div className={`mobile-plus-compact transition-transform ${showMobileCreate ? 'rotate-45 bg-slate-800' : ''}`}>
            <Plus size={22} color="white" strokeWidth={2.5} />
          </div>
        </div>

        <Link to="/moments" className={`mobile-nav-item ${isActive('/moments') ? 'active' : ''}`}>
          <PlayCircle size={26} />
        </Link>
        <Link to="/messages" className={`mobile-nav-item ${isActive('/messages') ? 'active' : ''}`}>
          <i className="fab fa-facebook-messenger" style={{ fontSize: '1.5rem' }}></i>
        </Link>
        <Link to={`/profile/${user?.username}`} className={`mobile-nav-item ${isActive(`/profile/${user?.username}`) ? 'active' : ''}`}>
          <div className={`p-[2px] rounded-full ${isActive(`/profile/${user?.username}`) ? 'bg-gradient-to-tr from-[#FF3D6D] to-[#FF8E53]' : 'bg-transparent'}`}>
            <img 
              src={user?.avatar_url || '/uploads/avatars/default.png'} 
              className="w-7 h-7 rounded-full object-cover border border-white"
              alt="Profile"
            />
          </div>
        </Link>
      </nav>

      {/* Mobile Vertical Creation List (Right Edge) */}
      {showMobileCreate && (
        <div className="fixed inset-0 z-[1900]" onClick={() => setShowMobileCreate(false)}>
          <div 
            className="absolute bottom-[85px] right-4 w-[260px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col animate-slide-up border border-slate-100 z-[1901]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-2 flex flex-col">
              {/* Header */}
              <div className="px-4 pt-4 pb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Create New</span>
              </div>

              {/* Main Actions */}
              <div className="flex flex-col gap-1">
                {[
                  { name: 'Create Post', icon: Pen, action: () => setActiveModal('post') },
                  { name: 'Create AfterGlow', icon: History, action: () => navigate('/afterglow/create') },
                  { name: 'Create Moment', icon: PlayCircle, action: () => navigate('/moments/create') },
                  { name: 'Sell Item', icon: Store, action: () => setActiveModal('listing') },
                  { name: 'Launch Poll', icon: BarChart3, action: () => setActiveModal('poll') },
                  { name: 'Post Event', icon: Calendar, action: () => setActiveModal('event') },
                  { name: 'Share Confession', icon: Ghost, action: () => setActiveModal('confession'), isNew: true },
                ].map((item, idx) => (
                  <button 
                    key={idx}
                    onClick={() => { setShowMobileCreate(false); item.action(); }} 
                    className="w-full p-3.5 flex items-center gap-3.5 hover:bg-slate-50 active:bg-slate-100 transition-all group rounded-2xl relative"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-900 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm">
                      <item.icon size={18} strokeWidth={2.5} />
                    </div>
                    <span className="font-bold text-slate-700 text-[13px] tracking-tight">{item.name}</span>
                    {item.isNew && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
            {activeModal === 'reshare' && <ReshareModal onClose={() => setActiveModal(null)} onSuccess={triggerSuccess} />}
            {activeModal === 'post_comments' && <PostCommentsModal post={modalData?.post} onClose={() => setActiveModal(null)} />}
            {activeModal === 'creation_hub' && <CreationHubModal onClose={() => setActiveModal(null)} />}
          </div>
        </div>
      )}



      {/* Grid Mega Menu (Facebook Style) */}
      {gridMenuOpen && (
        <div className="fixed inset-0 z-[2000]" onClick={() => setGridMenuOpen(false)}>
          <div 
            className="absolute top-[85px] right-4 w-[340px] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col animate-scale-in border border-slate-100 z-[2001]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 flex-1 overflow-y-auto max-h-[80vh] custom-scrollbar">
              <div className="flex items-center justify-between mb-6 px-1">
                <span className="font-black text-slate-900 text-xl tracking-tight">Menu</span>
                <button onClick={() => setGridMenuOpen(false)} className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={18} strokeWidth={3} />
                </button>
              </div>

              {/* Primary Features Grid */}
              <div className="mb-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-1">Social & Discovery</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { name: 'Home', icon: Home, color: 'bg-blue-500', path: '/dashboard' },
                    { name: 'Profile', icon: User, color: 'bg-rose-500', path: `/profile/${user?.username}` },
                    { name: 'Explore', icon: Compass, color: 'bg-indigo-500', path: '/explore' },
                    { name: 'Connect', icon: UserPlus, color: 'bg-violet-500', path: '/connect' },
                    { name: 'Moments', icon: PlayCircle, color: 'bg-amber-500', path: '/moments' },
                    { name: 'Streams', icon: PlayCircle, color: 'bg-red-500', path: '/streams' },
                    { name: 'Memories', icon: Heart, color: 'bg-pink-500', path: '/memories' },
                  ].map((item) => (
                    <button 
                      key={item.name}
                      onClick={() => { setGridMenuOpen(false); navigate(item.path); }}
                      className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col items-center gap-2 active:scale-95 transition-all hover:bg-slate-50 shadow-sm"
                    >
                      <div className={`w-9 h-9 ${item.color} rounded-lg flex items-center justify-center text-white shadow-md`}>
                        <item.icon size={18} strokeWidth={2.5} />
                      </div>
                      <span className="font-bold text-slate-800 text-[10px] tracking-tight">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Community Section */}
              <div className="mb-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-1">Community</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { name: 'Groups', icon: Users, color: 'bg-cyan-500', path: '/groups' },
                    { name: 'Clubs', icon: Sparkles, color: 'bg-fuchsia-500', path: '/clubs' },
                    { name: 'Events', icon: Calendar, color: 'bg-orange-500', path: '/events' },
                    { name: 'Polls', icon: BarChart3, color: 'bg-slate-700', path: '/polls' },
                    { name: 'Confessions', icon: Ghost, color: 'bg-indigo-600', path: '/confessions' },
                    { name: 'Requests', icon: UserPlus, color: 'bg-violet-500', path: '/follow-requests' },
                  ].map((item) => (
                    <button 
                      key={item.name}
                      onClick={() => { setGridMenuOpen(false); navigate(item.path); }}
                      className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col items-center gap-2 active:scale-95 transition-all hover:bg-slate-50 shadow-sm"
                    >
                      <div className={`w-9 h-9 ${item.color} rounded-lg flex items-center justify-center text-white shadow-md`}>
                        <item.icon size={18} strokeWidth={2.5} />
                      </div>
                      <span className="font-bold text-slate-800 text-[10px] tracking-tight">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Tools & Professional Section */}
              <div className="mb-6">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-1">Tools & Professional</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { name: 'Professional', icon: BarChart3, color: 'bg-slate-900', path: '/professional-dashboard' },
                    { name: 'Verified', icon: CheckCircle, color: 'bg-blue-600', path: '/verified' },
                    { name: 'Gallery', icon: History, color: 'bg-rose-600', path: '/gallery' },
                    { name: 'Invite', icon: UserPlus, color: 'bg-emerald-600', path: '/invite' },
                    { name: 'Accounts', icon: SettingsIcon, color: 'bg-slate-500', path: '/settings/accounts' },
                    { name: 'Admin', icon: ShieldCheck, color: 'bg-red-600', path: '/admin', adminOnly: true },
                  ].filter(item => !item.adminOnly || user?.role === 'admin' || user?.is_admin).map((item) => (
                    <button 
                      key={item.name}
                      onClick={() => { setGridMenuOpen(false); navigate(item.path); }}
                      className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col items-center gap-2 active:scale-95 transition-all hover:bg-slate-50 shadow-sm"
                    >
                      <div className={`w-9 h-9 ${item.color} rounded-lg flex items-center justify-center text-white shadow-md`}>
                        <item.icon size={18} strokeWidth={2.5} />
                      </div>
                      <span className="font-bold text-slate-800 text-[10px] tracking-tight">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Services Section */}
              <div className="mb-8">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 px-1">Services</h3>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { name: 'Shop', icon: ShoppingBag, color: 'bg-emerald-500', path: '/marketplace' },
                    { name: 'Skills', icon: GraduationCap, color: 'bg-teal-600', path: '/skill-market' },
                    { name: 'Lost & Found', icon: SearchIcon, color: 'bg-amber-600', path: '/lost-found' },
                  ].map((item) => (
                    <button 
                      key={item.name}
                      onClick={() => { setGridMenuOpen(false); navigate(item.path); }}
                      className="bg-white p-3 rounded-xl border border-slate-100 flex flex-col items-center gap-2 active:scale-95 transition-all hover:bg-slate-50 shadow-sm"
                    >
                      <div className={`w-9 h-9 ${item.color} rounded-lg flex items-center justify-center text-white shadow-md`}>
                        <item.icon size={18} strokeWidth={2.5} />
                      </div>
                      <span className="font-bold text-slate-800 text-[10px] tracking-tight">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Utility List */}
              <div className="flex flex-col gap-2">
                {[
                  { name: 'Message Settings', icon: SettingsIcon, path: '/messages/settings' },
                  { name: 'General Settings', icon: SettingsIcon, path: '/settings' },
                  { name: 'Help & Support', icon: HelpCircle, path: '/help' },
                ].map((item) => (
                  <button 
                    key={item.name}
                    onClick={() => { setGridMenuOpen(false); navigate(item.path); }}
                    className="w-full p-3 flex items-center gap-4 hover:bg-slate-50 rounded-xl transition-colors border border-transparent hover:border-slate-100"
                  >
                    <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                      <item.icon size={18} strokeWidth={2.5} />
                    </div>
                    <span className="font-bold text-slate-800 text-sm">{item.name}</span>
                  </button>
                ))}
              </div>

              {/* Account Actions in Grid Menu */}
              <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col gap-3">
                <button 
                  onClick={() => { setGridMenuOpen(false); navigate('/login'); }}
                  className="w-full p-4 bg-slate-50 text-slate-700 font-black text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-3 hover:bg-slate-100 transition-colors"
                >
                  <Plus size={16} strokeWidth={3} />
                  Add Account
                </button>
                <button 
                  onClick={() => { logout(); navigate('/login'); }}
                  className="w-full p-4 bg-rose-50 text-rose-600 font-black text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-3 hover:bg-rose-100 transition-colors"
                >
                  <LogOut size={16} strokeWidth={3} />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <FloatingAction />

      <style>{`
        .mobile-top-bar { display: none; }
        .mobile-bottom-nav { display: none; }

        @media (max-width: 1024px) {
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
            display: flex; position: fixed; bottom: 0; left: 0; width: 100%; height: 65px;
            background: rgba(255, 255, 255, 0.95); backdrop-filter: blur(25px); border-top: 1px solid rgba(0, 0, 0, 0.05);
            justify-content: space-around; align-items: center; z-index: 1000; padding: 0 10px;
            padding-bottom: env(safe-area-inset-bottom);
          }
          .mobile-nav-item { color: #64748b; display: flex; align-items: center; justify-content: center; transition: 0.3s; flex: 1; }
          .mobile-nav-item.active { color: var(--primary); }
          
          .mobile-plus-compact {
            width: 38px; height: 38px; background: var(--primary-gradient); border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 12px rgba(255, 61, 109, 0.25); transition: transform 0.2s;
          }
          .mobile-plus-compact:active { transform: scale(0.9); }
        }

        .global-modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(16px); z-index: 9999; display: flex; alignItems: center; justifyContent: center; padding: 20px; }
        .global-modal-content { width: 100%; maxWidth: 500px; max-height: 90vh; position: relative; overflow-y: auto; }

        @keyframes slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }

        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }

        @keyframes scale-in {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-scale-in { animation: scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1); }
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
