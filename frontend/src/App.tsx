import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useUserStore } from './store/userStore';

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
import Wishlist from './pages/Wishlist';
import SkillMarket from './pages/SkillMarket';

function App() {
  const { isAuthenticated } = useUserStore();

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" />} />
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
        <Route path="/groups/:id" element={isAuthenticated ? <GroupDetail /> : <Navigate to="/login" />} />
        <Route path="/groups/create" element={isAuthenticated ? <CreateGroup /> : <Navigate to="/login" />} />
        <Route path="/groups/:id/settings" element={isAuthenticated ? <GroupAdmin /> : <Navigate to="/login" />} />
        <Route path="/confessions" element={isAuthenticated ? <Confessions /> : <Navigate to="/login" />} />
        <Route path="/marketplace/listings/:id" element={isAuthenticated ? <ListingDetail /> : <Navigate to="/login" />} />
        <Route path="/marketplace/sell" element={isAuthenticated ? <SellItem /> : <Navigate to="/login" />} />
        <Route path="/wishlist" element={isAuthenticated ? <Wishlist /> : <Navigate to="/login" />} />
        <Route path="/skills" element={isAuthenticated ? <SkillMarket /> : <Navigate to="/login" />} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

export default App;
