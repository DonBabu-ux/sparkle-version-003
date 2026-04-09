import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useUserStore } from './store/userStore';

// Phase 1 — Core
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Marketplace from './pages/Marketplace';
import Groups from './pages/Groups';
import Messages from './pages/Messages';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import Search from './pages/Search';
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
import Landing from './pages/Landing';
import Signup from './pages/Signup';
import Orders from './pages/Orders';
import MyListings from './pages/MyListings';

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
import Moments from './pages/Moments';
import MomentDetail from './pages/MomentDetail';
import CreateMoment from './pages/CreateMoment';
import CreateStory from './pages/CreateStory';
import Streams from './pages/Streams';
import ProfessionalDashboard from './pages/ProfessionalDashboard';
import GlobalEffects from './components/GlobalEffects';
import LoadingBar from './components/LoadingBar';

// Phase 4 — Utility
import LostFound from './pages/LostFound';
import Support from './pages/Support';

// Phase 5 — Public & Static
import About from './pages/About';
import NotFound from './pages/NotFound';

function App() {
  const { isAuthenticated } = useUserStore();

  return (
    <Router>
      <div className="app">
        <LoadingBar />
        <GlobalEffects />
        <Routes>
          {/* ── Phase 1: Auth & Core ── */}
          <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Landing />} />
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/signup" element={!isAuthenticated ? <Signup /> : <Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
          <Route path="/profile/:username" element={isAuthenticated ? <Profile /> : <Navigate to="/login" />} />
          <Route path="/marketplace" element={isAuthenticated ? <Marketplace /> : <Navigate to="/login" />} />
        <Route path="/groups" element={isAuthenticated ? <Groups /> : <Navigate to="/login" />} />
        <Route path="/messages" element={isAuthenticated ? <Messages /> : <Navigate to="/login" />} />
        <Route path="/settings" element={isAuthenticated ? <Settings /> : <Navigate to="/login" />} />
        <Route path="/notifications" element={isAuthenticated ? <Notifications /> : <Navigate to="/login" />} />
        <Route path="/search" element={isAuthenticated ? <Search /> : <Navigate to="/login" />} />
        <Route path="/admin" element={isAuthenticated ? <AdminDashboard /> : <Navigate to="/login" />} />
        <Route path="/post/:id" element={isAuthenticated ? <PostDetail /> : <Navigate to="/login" />} />
        <Route path="/stories/:userId" element={isAuthenticated ? <StoryViewer /> : <Navigate to="/login" />} />
        <Route path="/groups/create" element={isAuthenticated ? <CreateGroup /> : <Navigate to="/login" />} />
        <Route path="/groups/:id/settings" element={isAuthenticated ? <GroupAdmin /> : <Navigate to="/login" />} />
        <Route path="/groups/:id" element={isAuthenticated ? <GroupDetail /> : <Navigate to="/login" />} />
        <Route path="/confessions" element={isAuthenticated ? <Confessions /> : <Navigate to="/login" />} />
        <Route path="/marketplace/sell" element={isAuthenticated ? <SellItem /> : <Navigate to="/login" />} />
        <Route path="/marketplace/orders" element={isAuthenticated ? <Orders /> : <Navigate to="/login" />} />
        <Route path="/marketplace/my-listings" element={isAuthenticated ? <MyListings /> : <Navigate to="/login" />} />
        <Route path="/marketplace/listings/:id" element={isAuthenticated ? <ListingDetail /> : <Navigate to="/login" />} />
        <Route path="/marketplace/seller/:id" element={isAuthenticated ? <SellerProfile /> : <Navigate to="/login" />} />
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
        <Route path="/moments" element={isAuthenticated ? <Moments /> : <Navigate to="/login" />} />
        <Route path="/afterglow/create" element={isAuthenticated ? <CreateStory /> : <Navigate to="/login" />} />
        <Route path="/moments/create" element={isAuthenticated ? <CreateMoment /> : <Navigate to="/login" />} />
        <Route path="/moments/:id" element={isAuthenticated ? <MomentDetail /> : <Navigate to="/login" />} />
        <Route path="/streams" element={isAuthenticated ? <Streams /> : <Navigate to="/login" />} />
        <Route path="/professional-dashboard" element={isAuthenticated ? <ProfessionalDashboard /> : <Navigate to="/login" />} />

        {/* ── Phase 4: Utility & Features ── */}
        <Route path="/lost-found" element={isAuthenticated ? <LostFound /> : <Navigate to="/login" />} />
        <Route path="/support" element={<Support />} />

        {/* ── Phase 5: Public & Static ── */}
        <Route path="/about" element={<About />} />
        <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
