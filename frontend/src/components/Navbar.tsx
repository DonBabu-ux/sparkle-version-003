import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Bell, Home, ShoppingBag, Users, MessageSquare, User, LogOut } from 'lucide-react';
import { useUserStore } from '../store/userStore';
import FollowRequestsOverlay from './FollowRequestsOverlay';

export default function Navbar() {
  const { user, logout } = useUserStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [showFollowRequests, setShowFollowRequests] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Feed', path: '/dashboard', icon: Home },
    { name: 'Marketplace', path: '/marketplace', icon: ShoppingBag },
    { name: 'Communities', path: '/groups', icon: Users },
    { name: 'Messages', path: '/messages', icon: MessageSquare },
    { name: 'Profile', path: '/profile/me', icon: User },
  ];

  return (
    <nav className="fixed left-0 top-0 h-screen w-20 lg:w-64 bg-white/80 border-r border-white/40 shadow-2xl backdrop-blur-3xl flex flex-col justify-between py-8 px-4 z-50 transition-all duration-300">
      
      <div>
        <Link to="/dashboard" className="flex items-center gap-3 group mb-12 px-2">
          <div className="w-10 h-10 lg:w-12 lg:h-12 flex-shrink-0 rounded-2xl flex items-center justify-center overflow-hidden shadow-pink-200/50 shadow-lg border border-pink-100 group-hover:scale-105 transition-transform bg-white">
            <img src="/logo.png" alt="Sparkle Logo" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-black bg-gradient-to-r from-pink-500 via-rose-400 to-orange-400 bg-clip-text text-transparent tracking-tight hidden lg:block">Sparkle</h1>
        </Link>
        
        <div className="flex flex-col gap-2">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <Link 
                key={item.name} 
                to={item.path} 
                className={`flex items-center gap-4 px-3 py-3 rounded-2xl transition-all group ${isActive ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'}`}
              >
                <Icon size={22} className={isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-600 transition-colors'} />
                <span className={`text-sm tracking-wide hidden lg:block ${isActive ? 'font-bold' : 'font-semibold'}`}>
                  {item.name}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <button 
          onClick={() => setShowFollowRequests(true)}
          className="flex items-center gap-4 px-3 py-3 rounded-2xl text-slate-500 hover:bg-slate-50 hover:text-indigo-600 transition-all group w-full"
        >
          <div className="relative">
             <Bell size={22} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
             {/* Add a notification badge if needed */}
          </div>
          <span className="text-sm font-semibold tracking-wide hidden lg:block">Notifications</span>
        </button>

        <div className="hidden lg:flex items-center gap-3 px-4 py-3 bg-slate-50/50 rounded-2xl border border-slate-100">
          <img src={user?.avatar_url || '/uploads/avatars/default.png'} className="w-8 h-8 rounded-full object-cover" alt="" />
          <div className="flex flex-col overflow-hidden">
             <span className="text-xs font-bold text-slate-800 truncate">{user?.name || 'Explorer'}</span>
             <span className="text-[10px] font-semibold text-slate-400 truncate">@{user?.username || 'user'}</span>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="flex items-center justify-center lg:justify-start gap-4 px-3 py-3 rounded-2xl text-rose-500 hover:bg-rose-50 transition-all group w-full mt-2"
        >
          <LogOut size={22} className="group-hover:scale-110 transition-transform" />
          <span className="text-sm font-bold tracking-wide hidden lg:block">Sign Out</span>
        </button>
      </div>

      {showFollowRequests && (
        <FollowRequestsOverlay onClose={() => setShowFollowRequests(false)} />
      )}
    </nav>
  );
}
