import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useUserStore } from './store/userStore';
import { authApi } from './api/api';
import { OtaService } from './services/OtaService';
import { OTAUpdateProvider } from './components/OTAUpdateProvider';
import { GlobalThemeProvider } from './components/GlobalThemeProvider';
import { CameraProvider } from './components/camera/CameraProvider';
import { NetworkStatusProvider } from './components/NetworkStatusProvider';
import { OfflineIndicator } from './components/OfflineIndicator';
import { MockCallProvider } from './components/MockCallProvider';
import { CallOverlay } from './components/CallOverlay';

// Phase 1 — Core
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Marketplace from './pages/Marketplace';
import Groups from './pages/Groups';
import Messages from './pages/Messages';
import MessagesSettings from './pages/MessagesSettings';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import Search from './pages/Search';
import SearchHistory from './pages/SearchHistory';
import AdminDashboard from './pages/AdminDashboard';
import StorageIntelligencePanel from './pages/StorageIntelligencePanel';
import PostDetail from './pages/PostDetail';
import StoryViewer from './pages/StoryViewer';
import GroupDetail from './pages/GroupDetail';
import CreateGroup from './pages/CreateGroup';
import GroupAdmin from './pages/GroupAdmin';
import Confessions from './pages/Confessions';
import ListingDetail from './pages/ListingDetail';
import SellItem from './pages/SellItem';
import SellerProfile from './pages/SellerProfile';
import Wishlist from './pages/Wishlist';
import SkillMarket from './pages/SkillMarket';
import SkillHub from './pages/SkillHub';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Orders from './pages/Orders';
import MyListings from './pages/MyListings';
import ReportListing from './pages/ReportListing';
import MarketplaceOrder from './pages/MarketplaceOrder';
import MarketplaceSafety from './pages/MarketplaceSafety';
import MarketplaceModals from './components/modals/MarketplaceModals';
import MarketplaceChat from './pages/MarketplaceChat';
import MarketplaceSettings from './pages/MarketplaceSettings';

// Phase 2 — Social & Community
import Clubs from './pages/Clubs';
import ClubDetail from './pages/ClubDetail';
import Events from './pages/Events';
import EventsAdmin from './pages/EventsAdmin';
import Connect from './pages/Connect';
import FollowRequests from './pages/FollowRequests';

// Phase 3 — Content & Discovery
import Polls from './pages/Polls';
import PollDetail from './pages/PollDetail';
import Hashtag from './pages/Hashtag';
import Explore from './pages/Explore';
import Moments from './pages/Moments';
import CreateMoment from './pages/CreateMoment';
import CreateStory from './pages/CreateStory';
import StorySnapshot from './pages/StorySnapshot';
import Streams from './pages/Streams';
import ProfessionalDashboard from './pages/ProfessionalDashboard';
import GlobalEffects from './components/GlobalEffects';
import LoadingBar from './components/LoadingBar';
import { TikTokHearts } from './components/TikTokHearts';
import PresenceManager from './components/PresenceManager';

// Phase 4 — Utility
import LostFound from './pages/LostFound';
import Support from './pages/Support';
import TicketDetail from './pages/Support/TicketDetail';
import AccountsCenter from './pages/AccountsCenter';
import Memories from './pages/Memories';
import Gallery from './pages/Gallery';
import Verified from './pages/Verified';
import Invite from './pages/Invite';
import Help from './pages/Help';
import Onboarding from './pages/Onboarding';
import Ecosystem from './pages/Ecosystem';

import BlockedUsers from './pages/BlockedUsers';

// Phase 5 — Public & Static
import About from './pages/About';
import NotFound from './pages/NotFound';

function App() {
  const { isAuthenticated, token, refreshToken } = useUserStore();
  const [hydrated, setHydrated] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500); // 2.5 second splash screen
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Wait for Zustand persist to finish loading from async Capacitor storage.
    // Without this, token is null on first render → 401 on every protected request.
    if (useUserStore.persist.hasHydrated()) {
      setHydrated(true);
    } else {
      const unsub = useUserStore.persist.onFinishHydration(() => {
        setHydrated(true);
      });
      return () => unsub();
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // Trigger background check for OTA updates once layout rehydrates
    OtaService.checkAndDownloadUpdate().catch(err => {
      console.warn('OTA Background trigger warning:', err);
    });
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    const initAuth = async () => {
      if (token || refreshToken) {
        try {
          await authApi.validateToken();
        } catch (err) {
          console.error('Initial auth validation failed:', err);
        }
      }
    };
    initAuth();
  }, [hydrated]);

  const theme = useUserStore(state => state.theme);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Show a premium, responsive, centered splash screen while the store rehydrates or during initial launch
  if (!hydrated || showSplash) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-white to-slate-50 dark:from-zinc-950 dark:to-black transition-colors duration-500">
        <div className="flex flex-col items-center justify-center p-8 text-center animate-fade-in">
          {/* Logo container with soft shadow and pulsing animations */}
          <div className="w-32 h-32 md:w-44 md:h-44 mb-6 rounded-3xl bg-white dark:bg-zinc-900 shadow-[0_12px_40px_rgba(255,20,147,0.15)] dark:shadow-[0_12px_40px_rgba(255,20,147,0.05)] border border-pink-500/10 flex items-center justify-center p-6 transition-all duration-500 scale-100 animate-pulse-slow">
            <img 
              src="/sparklelogo.png" 
              alt="Sparkle" 
              className="w-full h-full object-contain filter drop-shadow-[0_4px_12px_rgba(255,20,147,0.25)]" 
            />
          </div>
          
          {/* Premium Brand Text */}
          <div className="relative mt-2">
            <h1 className="font-heading text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-[#ff1493] via-[#fb7185] to-[#ff1493] -webkit-background-clip: text-webkit-text-fill-color bg-clip-text text-transparent italic animate-shimmer">
              Sparkle
            </h1>
            <p className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-zinc-500 mt-2">
              Connect. Share. Shine.
            </p>
          </div>
          
          {/* Centered micro-animation indicator */}
          <div className="mt-12 flex items-center justify-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#ff1493] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2.5 h-2.5 bg-[#fb7185] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2.5 h-2.5 bg-[#ff1493] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
        <style>{`
          @keyframes pulse-slow {
            0%, 100% { transform: scale(1); filter: brightness(1); }
            50% { transform: scale(1.03); filter: brightness(1.05); }
          }
          .animate-pulse-slow {
            animation: pulse-slow 3s infinite ease-in-out;
          }
          @keyframes shimmer {
            0% { background-position: -200% center; }
            100% { background-position: 200% center; }
          }
          .animate-shimmer {
            background-size: 200% auto;
            animation: shimmer 4s infinite linear;
          }
        `}</style>
      </div>
    );
  }

  return (
    <OTAUpdateProvider>
      <CameraProvider>
        <NetworkStatusProvider>
          <OfflineIndicator />
          <GlobalThemeProvider>
            <MockCallProvider>
              <Router>
                <div className="app no-scrollbar">
                  <LoadingBar />
                  <GlobalEffects />
                  <MarketplaceModals />
                  <TikTokHearts />
                  {/* PresenceManager — mounted once globally. Keeps the socket alive and
                      updates online/offline state regardless of which page is active. */}
                  <PresenceManager />
                  <CallOverlay />
                  <Routes>
                    {/* ── Phase 1: Auth & Core ── */}
                    <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
                    <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
                    <Route path="/signup" element={!isAuthenticated ? <Signup /> : <Navigate to="/dashboard" />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
                    <Route path="/profile/:username" element={isAuthenticated ? <Profile /> : <Navigate to="/login" />} />
                    <Route path="/marketplace" element={isAuthenticated ? <Marketplace /> : <Navigate to="/login" />} />
                    <Route path="/groups" element={isAuthenticated ? <Groups /> : <Navigate to="/login" />} />
                    <Route path="/messages" element={isAuthenticated ? <Messages /> : <Navigate to="/login" />} />
                    <Route path="/messages/settings" element={isAuthenticated ? <MessagesSettings /> : <Navigate to="/login" />} />
                    <Route path="/settings" element={isAuthenticated ? <Settings /> : <Navigate to="/login" />} />
                    <Route path="/settings/blocked" element={isAuthenticated ? <BlockedUsers /> : <Navigate to="/login" />} />
                    <Route path="/notifications" element={isAuthenticated ? <Notifications /> : <Navigate to="/login" />} />
                    <Route path="/search" element={isAuthenticated ? <Search /> : <Navigate to="/login" />} />
                    <Route path="/search/history" element={isAuthenticated ? <SearchHistory /> : <Navigate to="/login" />} />
                    <Route path="/admin" element={isAuthenticated ? <AdminDashboard /> : <Navigate to="/login" />} />
                    <Route path="/admin/storage" element={isAuthenticated ? <StorageIntelligencePanel /> : <Navigate to="/login" />} />
                    <Route path="/post/:id" element={isAuthenticated ? <PostDetail /> : <Navigate to="/login" />} />
                    <Route path="/stories/:userId" element={isAuthenticated ? <StoryViewer /> : <Navigate to="/login" />} />
                    <Route path="/groups/create" element={isAuthenticated ? <CreateGroup /> : <Navigate to="/login" />} />
                    <Route path="/groups/:id/settings" element={isAuthenticated ? <GroupAdmin /> : <Navigate to="/login" />} />
                    <Route path="/groups/:id" element={isAuthenticated ? <GroupDetail /> : <Navigate to="/login" />} />
                    <Route path="/confessions" element={isAuthenticated ? <Confessions /> : <Navigate to="/login" />} />

                    <Route path="/marketplace/category/:categoryId" element={isAuthenticated ? <Marketplace /> : <Navigate to="/login" />} />
                    <Route path="/marketplace/inbox" element={isAuthenticated ? <Marketplace /> : <Navigate to="/login" />} />
                    <Route path="/marketplace/sell" element={isAuthenticated ? <SellItem /> : <Navigate to="/login" />} />
                    <Route path="/marketplace/report/:id" element={isAuthenticated ? <ReportListing /> : <Navigate to="/login" />} />
                    <Route path="/marketplace/my-shop" element={isAuthenticated ? <SellerProfile /> : <Navigate to="/login" />} />
                    <Route path="/marketplace/orders" element={isAuthenticated ? <Orders /> : <Navigate to="/login" />} />
                    <Route path="/marketplace/my-listings" element={isAuthenticated ? <MyListings /> : <Navigate to="/login" />} />
                    <Route path="/marketplace/listings/:id" element={isAuthenticated ? <ListingDetail /> : <Navigate to="/login" />} />
                    <Route path="/marketplace/order" element={isAuthenticated ? <MarketplaceOrder /> : <Navigate to="/login" />} />
                    <Route path="/marketplace/safety" element={isAuthenticated ? <MarketplaceSafety /> : <Navigate to="/login" />} />
                    <Route path="/marketplace/seller/:id" element={isAuthenticated ? <SellerProfile /> : <Navigate to="/login" />} />
                    <Route path="/marketplace/messages/:conversationId" element={isAuthenticated ? <MarketplaceChat /> : <Navigate to="/login" />} />
                    <Route path="/marketplace/settings" element={isAuthenticated ? <MarketplaceSettings /> : <Navigate to="/login" />} />
                    <Route path="/profile/:id" element={isAuthenticated ? <SellerProfile /> : <Navigate to="/login" />} />
                    <Route path="/wishlist" element={isAuthenticated ? <Wishlist /> : <Navigate to="/login" />} />
                    <Route path="/skill-market" element={isAuthenticated ? <SkillMarket /> : <Navigate to="/login" />} />
                    <Route path="/skill-market/hub" element={isAuthenticated ? <SkillHub /> : <Navigate to="/login" />} />

                    {/* ── Phase 2: Social & Community ── */}
                    <Route path="/clubs" element={isAuthenticated ? <Clubs /> : <Navigate to="/login" />} />
                    <Route path="/clubs/:id" element={isAuthenticated ? <ClubDetail /> : <Navigate to="/login" />} />
                    <Route path="/events" element={isAuthenticated ? <Events /> : <Navigate to="/login" />} />
                    <Route path="/events/admin" element={isAuthenticated ? <EventsAdmin /> : <Navigate to="/login" />} />
                    <Route path="/connect" element={isAuthenticated ? <Connect /> : <Navigate to="/login" />} />
                    <Route path="/follow-requests" element={isAuthenticated ? <FollowRequests /> : <Navigate to="/login" />} />

                    {/* ── Phase 3: Content & Discovery ── */}
                    <Route path="/polls" element={isAuthenticated ? <Polls /> : <Navigate to="/login" />} />
                    <Route path="/polls/:id" element={isAuthenticated ? <PollDetail /> : <Navigate to="/login" />} />
                    <Route path="/hashtag/:tag" element={isAuthenticated ? <Hashtag /> : <Navigate to="/login" />} />
                    <Route path="/explore" element={isAuthenticated ? <Explore /> : <Navigate to="/login" />} />
                    <Route path="/moments" element={isAuthenticated ? <Moments /> : <Navigate to="/login" />} />
                    <Route path="/moments/:id" element={isAuthenticated ? <Moments /> : <Navigate to="/login" />} />
                    <Route path="/story/:storyId" element={isAuthenticated ? <StorySnapshot /> : <Navigate to="/login" />} />
                    <Route path="/afterglow/create" element={isAuthenticated ? <CreateStory /> : <Navigate to="/login" />} />
                    <Route path="/moments/create" element={isAuthenticated ? <CreateMoment /> : <Navigate to="/login" />} />
                    <Route path="/streams" element={isAuthenticated ? <Streams /> : <Navigate to="/login" />} />
                    <Route path="/professional-dashboard" element={isAuthenticated ? <ProfessionalDashboard /> : <Navigate to="/login" />} />

                    {/* ── Phase 4: Utility & Features ── */}
                    <Route path="/ecosystem" element={isAuthenticated ? <Ecosystem /> : <Navigate to="/login" />} />
                    <Route path="/lost-found" element={isAuthenticated ? <LostFound /> : <Navigate to="/login" />} />
                    <Route path="/support" element={isAuthenticated ? <Support /> : <Navigate to="/login" />} />
                    <Route path="/support/ticket/:ticketId" element={isAuthenticated ? <TicketDetail /> : <Navigate to="/login" />} />
                    <Route path="/settings/accounts" element={isAuthenticated ? <AccountsCenter /> : <Navigate to="/login" />} />
                    <Route path="/memories" element={isAuthenticated ? <Memories /> : <Navigate to="/login" />} />
                    <Route path="/gallery" element={isAuthenticated ? <Gallery /> : <Navigate to="/login" />} />
                    <Route path="/verified" element={isAuthenticated ? <Verified /> : <Navigate to="/login" />} />
                    <Route path="/invite" element={isAuthenticated ? <Invite /> : <Navigate to="/login" />} />
                    <Route path="/help" element={isAuthenticated ? <Help /> : <Navigate to="/login" />} />
                    <Route path="/onboarding/about" element={isAuthenticated ? <Onboarding /> : <Navigate to="/login" />} />

                    {/* ── Phase 5: Public & Static ── */}
                    <Route path="/about" element={<About />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </div>
              </Router>
            </MockCallProvider>
            </GlobalThemeProvider>
          </NetworkStatusProvider>
        </CameraProvider>
      </OTAUpdateProvider>

  );
}

export default App;
