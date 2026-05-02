import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useUserStore } from './store/userStore';
import { authApi } from './api/api';

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
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Orders from './pages/Orders';
import MyListings from './pages/MyListings';
import ReportListing from './pages/ReportListing';
import MarketplaceOrder from './pages/MarketplaceOrder';
import MarketplaceSafety from './pages/MarketplaceSafety';
import MarketplaceModals from './components/modals/MarketplaceModals';

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

import BlockedUsers from './pages/BlockedUsers';

// Phase 5 — Public & Static
import About from './pages/About';
import NotFound from './pages/NotFound';

function App() {
  const { isAuthenticated, token, refreshToken } = useUserStore();
  const [hydrated, setHydrated] = useState(false);

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

  // Show a minimal spinner while the store rehydrates from storage
  if (!hydrated) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f0f2f5' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e0e0e0', borderTop: '3px solid #1877F2', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <Router>
      <div className="app">
        <LoadingBar />
        <GlobalEffects />
        <MarketplaceModals />
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
        <Route path="/post/:id" element={isAuthenticated ? <PostDetail /> : <Navigate to="/login" />} />
        <Route path="/stories/:userId" element={isAuthenticated ? <StoryViewer /> : <Navigate to="/login" />} />
        <Route path="/groups/create" element={isAuthenticated ? <CreateGroup /> : <Navigate to="/login" />} />
        <Route path="/groups/:id/settings" element={isAuthenticated ? <GroupAdmin /> : <Navigate to="/login" />} />
        <Route path="/groups/:id" element={isAuthenticated ? <GroupDetail /> : <Navigate to="/login" />} />
        <Route path="/confessions" element={isAuthenticated ? <Confessions /> : <Navigate to="/login" />} />
        <Route path="/marketplace" element={isAuthenticated ? <Marketplace /> : <Navigate to="/login" />} />
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
        <Route path="/profile/:id" element={isAuthenticated ? <SellerProfile /> : <Navigate to="/login" />} />
        <Route path="/wishlist" element={isAuthenticated ? <Wishlist /> : <Navigate to="/login" />} />
        <Route path="/skill-market" element={isAuthenticated ? <SkillMarket /> : <Navigate to="/login" />} />

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
  );
}

export default App;
