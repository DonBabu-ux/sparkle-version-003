import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import { 
  Home, Users, Plus, X, User, Ghost, 
  ShoppingBag, 
  LogOut, 
  Calendar,
  Pen, PlayCircle, History, Store, LayoutGrid,
  BarChart3, Sparkles, Compass,
  Search as SearchIcon, Bell, MessageSquare,
  Zap, Activity, Package, UserPlus, Image as ImageIcon, Send, CheckCircle2, LifeBuoy, HelpCircle, Briefcase, Settings
} from 'lucide-react';
import { useUserStore } from '../store/userStore';
import { useModalStore } from '../store/modalStore';
import { getAvatarUrl } from '../utils/imageUtils';

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
import MediaPreviewModal from './modals/MediaPreviewModal';
import CreateHighlightModal from './modals/CreateHighlightModal';
import HighlightPlayerModal from './modals/HighlightPlayerModal';
import ArchiveModal from './modals/ArchiveModal';
import PostOptionsModal from './modals/PostOptionsModal';
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
  const isMoments = location.pathname.startsWith('/moments');

  return (
    <>
      {/* Desktop Sidebar Shell */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile Top Navigation Bar — Glass Header */}
      {!['/search', '/moments', '/marketplace'].some(path => location.pathname.startsWith(path)) && (
        <header className="lg:hidden fixed top-0 left-0 w-full h-18 bg-white/60 backdrop-blur-3xl border-b border-white/40 flex justify-between items-center z-[1100] px-5 pt-4 pb-4 shadow-sm">
          <Link to="/dashboard" className="flex items-center gap-2.5 active:scale-95 transition-transform">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-[#fb7185] rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <Sparkles size={20} strokeWidth={2.5} />
            </div>
            <span className="font-heading font-black text-xl tracking-tighter text-black">Sparkle</span>
          </Link>
          
          <div className="flex-1 mx-4">
            <div 
              className="bg-black/5 h-10 rounded-2xl flex items-center px-4 gap-3 text-black/30 border border-black/5 transition-all active:bg-white"
              onClick={() => navigate('/search')}
            >
              <SearchIcon size={16} />
              <span className="text-[12px] font-bold">Search...</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button 
                onClick={() => setGridMenuOpen(!gridMenuOpen)}
                className="w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center text-black/40 hover:bg-black/10 transition-colors active:scale-90"
            >
                <LayoutGrid size={20} strokeWidth={2.5} />
            </button>
          </div>
        </header>
      )}


      {/* Mobile Bottom Navigation — 7-column grid guarantees Plus is dead center */}
      <nav
        className={clsx(
          "lg:hidden fixed bottom-0 left-0 right-0 w-full z-[1000] transition-all duration-500",
          isMoments 
            ? "h-12 bg-gradient-to-t from-black/80 to-transparent border-none shadow-none" 
            : "h-14 bg-white/70 backdrop-blur-3xl border-t border-black/[0.04] rounded-t-none shadow-[0_-1px_12px_rgba(0,0,0,0.03)]"
        )}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', alignItems: 'center' }}
      >
        {/* Col 1 — Home */}
        <div 
          onClick={() => {
            if (isActive('/dashboard')) {
              window.dispatchEvent(new CustomEvent('scrollDashboardToTop'));
            } else {
              navigate('/dashboard');
            }
          }} 
          className="relative flex items-center justify-center h-full cursor-pointer"
        >
          {isActive('/dashboard') && <motion.div layoutId="nav-notch" className="absolute inset-x-1 inset-y-1 bg-primary/10 rounded-2xl -z-10" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
          <Home size={22} strokeWidth={isActive('/dashboard') ? 2.5 : 1.8} className={isActive('/dashboard') ? 'text-primary' : (isMoments ? 'text-white/60' : 'text-slate-400')} />
        </div>

        {/* Col 2 — Connect */}
        <Link to="/connect" className="relative flex items-center justify-center h-full">
          {isActive('/connect') && <motion.div layoutId="nav-notch" className="absolute inset-x-1 inset-y-1 bg-primary/10 rounded-2xl -z-10" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
          <Users size={22} strokeWidth={isActive('/connect') ? 2.5 : 1.8} className={isActive('/connect') ? 'text-primary' : (isMoments ? 'text-white/60' : 'text-slate-400')} />
        </Link>

        {/* Col 3 — Moments */}
        <Link to="/moments" className="relative flex items-center justify-center h-full">
          {isActive('/moments') && <motion.div layoutId="nav-notch" className={clsx("absolute inset-x-1 inset-y-1 rounded-2xl -z-10", isMoments ? "bg-white/20" : "bg-primary/10")} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
          <PlayCircle size={22} strokeWidth={isActive('/moments') ? 2.5 : 1.8} className={isActive('/moments') ? (isMoments ? 'text-white' : 'text-primary') : (isMoments ? 'text-white/60' : 'text-slate-400')} />
        </Link>

        {/* Col 4 — Plus (column 4 of 7 = exact center) */}
        <div className="flex items-center justify-center h-full cursor-pointer" onClick={() => setShowMobileCreate(!showMobileCreate)}>
          <div className={clsx("w-11 h-11 bg-gradient-to-br from-primary to-[#fb7185] rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300", isMoments ? "shadow-primary/40 border border-white/20" : "shadow-primary/30", showMobileCreate ? 'rotate-45 scale-90' : 'active:scale-90')}>
            <Plus size={22} color="white" strokeWidth={2.5} />
          </div>
        </div>

        {/* Col 5 — Explore */}
        <Link to="/explore" className="relative flex items-center justify-center h-full">
          {isActive('/explore') && <motion.div layoutId="nav-notch" className="absolute inset-x-1 inset-y-1 bg-primary/10 rounded-2xl -z-10" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
          <Compass size={22} strokeWidth={isActive('/explore') ? 2.5 : 1.8} className={isActive('/explore') ? 'text-primary' : (isMoments ? 'text-white/60' : 'text-slate-400')} />
        </Link>

        {/* Col 6 — Messages */}
        <Link to="/messages" className="relative flex items-center justify-center h-full">
          {isActive('/messages') && <motion.div layoutId="nav-notch" className="absolute inset-x-1 inset-y-1 bg-primary/10 rounded-2xl -z-10" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className={isActive('/messages') ? 'text-primary' : (isMoments ? 'text-white/60' : 'text-slate-400')}>
            <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.906 1.404 5.5 3.6 7.22V22l3.193-1.755A10.86 10.86 0 0 0 12 20.486c5.523 0 10-4.145 10-9.243C22 6.145 17.523 2 12 2Z"
              fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeWidth={isActive('/messages') ? 2 : 1.8} strokeLinejoin="round" />
            <path d="m6.5 14 3.5-4 2.5 2.5L16 9" stroke="currentColor" strokeWidth={isActive('/messages') ? 2 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>

        {/* Col 7 — Profile */}
        <Link to={`/profile/${user?.username}`} className="relative flex items-center justify-center h-full">
          {isActive(`/profile/${user?.username}`) && <motion.div layoutId="nav-notch" className="absolute inset-x-1 inset-y-1 bg-primary/10 rounded-2xl -z-10" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
          <img
            src={getAvatarUrl(user?.avatar_url, user?.username)}
            className={clsx("w-7 h-7 rounded-full object-cover border-2 transition-all duration-300", isActive(`/profile/${user?.username}`) ? 'border-primary' : (isMoments ? 'border-white/40' : 'border-slate-200'))}
            alt="Profile"
          />
        </Link>

      </nav>


      {/* Mobile Vertical Creation List */}
      {showMobileCreate && (
        <div className="fixed inset-0 z-[1900] bg-black/10 backdrop-blur-sm animate-fade-in" onClick={() => setShowMobileCreate(false)}>
          <div 
            className="absolute bottom-28 left-1/2 -translate-x-1/2 w-[calc(100%-60px)] max-w-xs bg-white/95 backdrop-blur-3xl rounded-[40px] shadow-2xl p-2 flex flex-col animate-slide-up border border-white/65 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-2 border-b border-black/5 mb-2">
                <span className="text-[11px] font-bold text-black/30 uppercase tracking-widest">Create New</span>
            </div>

            <div className="flex flex-col gap-1">
            {[
                { name: 'Spark Post', icon: Pen, action: () => setActiveModal('post'), color: 'text-primary' },
                { name: 'Afterglow', icon: History, action: () => navigate('/afterglow/create'), color: 'text-rose-500' },
                { name: 'Moment', icon: PlayCircle, action: () => navigate('/moments/create'), color: 'text-sky-500' },
                { name: 'Listing', icon: Store, action: () => setActiveModal('listing'), color: 'text-amber-500' },
                { name: 'Campus Poll', icon: BarChart3, action: () => setActiveModal('poll'), color: 'text-emerald-500' },
                { name: 'Event', icon: Calendar, action: () => setActiveModal('event'), color: 'text-indigo-500' },
                { name: 'Confession', icon: Ghost, action: () => setActiveModal('confession'), color: 'text-slate-500', isNew: true },
            ].map((item, idx) => (
                <button 
                key={idx}
                onClick={() => { setShowMobileCreate(false); item.action(); }} 
                className="w-full p-4 flex items-center gap-4 hover:bg-primary/5 active:bg-primary/10 transition-all group rounded-2xl relative"
                >
                <div className={`w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform`}>
                    <item.icon size={18} strokeWidth={2.5} />
                </div>
                <span className="font-bold text-black text-sm">{item.name}</span>
                {item.isNew && <div className="absolute right-5 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full animate-pulse" />}
                </button>
            ))}
            </div>
          </div>
        </div>
      )}

      {/* Global Modals */}
      {activeModal && (
        <>
          {activeModal === 'media_preview' ? (
            <MediaPreviewModal />
          ) : activeModal === 'post_options' ? (
            <PostOptionsModal post={(modalData as any)?.post} onClose={() => setActiveModal(null)} />
          ) : (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 animate-fade-in bg-black/20 backdrop-blur-xl" onClick={() => setActiveModal(null)}>
              <div className="w-full max-w-lg animate-scale-in" onClick={(e) => e.stopPropagation()}>
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
                {activeModal === 'highlight' && (
                  <CreateHighlightModal 
                    isOpen={true} 
                    onClose={() => setActiveModal(null)} 
                    onCreated={(h) => {
                      setActiveModal(null);
                      triggerSuccess();
                    }} 
                  />
                )}
                {activeModal === 'highlight_player' && (
                  <HighlightPlayerModal
                    isOpen={true}
                    onClose={() => setActiveModal(null)}
                    title={modalData?.title}
                    stories={modalData?.stories}
                    ownerUsername={modalData?.ownerUsername}
                    ownerAvatar={modalData?.ownerAvatar}
                  />
                )}
                {activeModal === 'archive' && (
                  <ArchiveModal 
                    isOpen={true} 
                    onClose={() => setActiveModal(null)} 
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Grid Mega Menu */}
      {gridMenuOpen && (
        <div className="fixed inset-0 z-[2000] bg-black/10 backdrop-blur-sm animate-fade-in" onClick={() => setGridMenuOpen(false)}>
          <div 
            className="absolute top-20 right-5 w-[calc(100%-40px)] max-w-[460px] bg-white/95 backdrop-blur-3xl border border-white rounded-[40px] shadow-2xl p-6 flex flex-col animate-scale-in z-[2001] max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-8 px-4">
                <div>
                  <span className="text-3xl font-black text-black tracking-tight italic">Explore</span>
                  <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em] mt-1 italic">VILLAGE FREQUENCIES</p>
                </div>
                <button onClick={() => setGridMenuOpen(false)} className="w-10 h-10 rounded-2xl bg-black/5 flex items-center justify-center text-black/30 hover:text-primary transition-colors">
                  <X size={20} strokeWidth={3} />
                </button>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-8 overflow-y-auto no-scrollbar pr-1">
                {[
                { name: 'Market', icon: ShoppingBag, color: 'text-amber-500', path: '/marketplace' },
                { name: 'Groups', icon: Users, color: 'text-sky-500', path: '/groups' },
                { name: 'Clubs', icon: Sparkles, color: 'text-primary', path: '/clubs' },
                { name: 'Events', icon: Calendar, color: 'text-rose-500', path: '/events' },
                { name: 'Polls', icon: BarChart3, color: 'text-emerald-500', path: '/polls' },
                { name: 'Chat', icon: MessageSquare, color: 'text-indigo-500', path: '/messages' },
                { name: 'Moments', icon: PlayCircle, color: 'text-sky-400', path: '/moments' },
                { name: 'The Vault', icon: Ghost, color: 'text-slate-500', path: '/confessions' },
                { name: 'Skills', icon: Zap, color: 'text-yellow-500', path: '/skill-market' },
                { name: 'Streams', icon: Activity, color: 'text-red-500', path: '/streams' },
                { name: 'Search', icon: SearchIcon, color: 'text-black/40', path: '/search' },
                { name: 'Connect', icon: UserPlus, color: 'text-primary', path: '/connect' },
                { name: 'Lost Found', icon: Package, color: 'text-orange-500', path: '/lost-found' },
                { name: 'Memories', icon: History, color: 'text-indigo-400', path: '/memories' },
                { name: 'Gallery', icon: ImageIcon, color: 'text-pink-500', path: '/gallery' },
                { name: 'Invite', icon: Send, color: 'text-teal-500', path: '/invite' },
                { name: 'Verified', icon: CheckCircle2, color: 'text-blue-500', path: '/verified' },
                { name: 'Pro Hub', icon: Briefcase, color: 'text-orange-600', path: '/professional-dashboard' },
                { name: 'Chat Opts', icon: Settings, color: 'text-slate-400', path: '/messages/settings' },
                { name: 'Support', icon: LifeBuoy, color: 'text-gray-400', path: '/help' },
                ].map((item) => (
                <button 
                    key={item.name}
                    onClick={() => { setGridMenuOpen(false); navigate(item.path); }}
                    className="flex flex-col items-center gap-3 p-4 rounded-3xl bg-black/[0.02] hover:bg-white hover:border-black/5 hover:shadow-xl hover:shadow-primary/5 transition-all group active:scale-95 border border-transparent"
                >
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${item.color} transition-transform bg-white shadow-sm border border-black/5`}>
                        <item.icon size={22} strokeWidth={2.5} />
                    </div>
                    <span className="font-bold text-black text-[11px] tracking-tight uppercase italic">{item.name}</span>
                </button>
                ))}
            </div>

            <div className="flex flex-col gap-2 pt-6 border-t border-black/5">
                {[
                  { name: 'Account Settings', icon: User, path: '/settings' },
                  { name: 'Help Center', icon: HelpCircle, path: '/help' },
                ].map((item) => (
                  <button 
                    key={item.name}
                    onClick={() => { setGridMenuOpen(false); navigate(item.path); }}
                    className="w-full p-4 flex items-center gap-4 hover:bg-primary/5 rounded-2xl transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-black/30">
                      <item.icon size={18} strokeWidth={2.5} />
                    </div>
                    <span className="font-bold text-black text-sm">{item.name}</span>
                  </button>
                ))}
                
                <button 
                    onClick={() => { logout(); navigate('/login'); }}
                    className="w-full p-4 mt-4 bg-primary/10 text-primary font-bold text-sm rounded-2xl flex items-center justify-center gap-3 shadow-sm hover:shadow-lg transition-all"
                >
                    <LogOut size={18} strokeWidth={2.5} /> Logout
                </button>
            </div>
          </div>
        </div>
      )}

      <FloatingAction />
    </>
  );
}

function NotificationBell() {
  return (
    <Link to="/notifications" className="relative w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center text-black/30 hover:text-primary transition-all active:scale-90">
      <Bell size={20} strokeWidth={2.5} />
      <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full ring-2 ring-white"></span>
    </Link>
  );
}
