import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useUserStore } from './store/userStore';
import { authApi } from './api/api';
import { OtaService } from './services/OtaService';
const SparkleAIScreen = lazy(() => import('./pages/ai/SparkleAIScreen'));
// import StudyAssistantScreen from './pages/ai/StudyAssistantScreen';
// import CaptionGeneratorScreen from './pages/ai/CaptionGeneratorScreen';
// import BioGeneratorScreen from './pages/ai/BioGeneratorScreen';
const SearchSparkleScreen = lazy(() => import('./pages/ai/SearchSparkleScreen'));
const FriendDiscoveryScreen = lazy(() => import('./pages/ai/FriendDiscoveryScreen'));
import { OTAUpdateProvider } from './components/OTAUpdateProvider';
import { MotionConfig } from 'framer-motion';
import { GlobalThemeProvider } from './components/GlobalThemeProvider';
const LearnMorePage = lazy(() => import('./pages/LearnMorePage'));
import { CameraProvider } from './components/camera/CameraProvider';
import { NetworkStatusProvider } from './components/NetworkStatusProvider';
import { OfflineIndicator } from './components/OfflineIndicator';
import { DialogHost } from './components/ui/DialogHost';
import { MockCallProvider } from './components/MockCallProvider';
import { SocketProvider } from './context/SocketProvider';
import { SoundProvider, handleNotificationSound } from './context/SoundProvider';
import { CallOverlay } from './components/CallOverlay';
import { AppLockOverlay } from './components/security/AppLockOverlay';
import { UploadManager } from './services/UploadManager';
import UploadNotificationCenter from './components/notifications/UploadNotificationCenter';
import { useSocket } from './hooks/useSocket';
import { useFeedStore } from './store/feedStore';
import { useNotificationStore } from './store/notificationStore';
import api from './api/api';

// Phase 1 — Core
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const Profile = lazy(() => import('./pages/Profile'));
const Marketplace = lazy(() => import('./pages/Marketplace'));
const Groups = lazy(() => import('./pages/Groups'));
const Messages = lazy(() => import('./pages/Messages'));
const MessagesSettings = lazy(() => import('./pages/MessagesSettings'));
const Settings = lazy(() => import('./pages/Settings'));
const SecurityCentre = lazy(() => import('./pages/SecurityCentre'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
import CrossDeviceSecurityAlertOverlay from './components/security/CrossDeviceSecurityAlertOverlay';
const AdvancedSettings = lazy(() => import('./pages/AdvancedSettings'));
const AdvancedSettingsDetail = lazy(() => import('./pages/AdvancedSettingsDetail'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Search = lazy(() => import('./pages/Search'));
const SearchHistory = lazy(() => import('./pages/SearchHistory'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const StorageIntelligencePanel = lazy(() => import('./pages/StorageIntelligencePanel'));
const PostDetail = lazy(() => import('./pages/PostDetail'));
const StoryViewer = lazy(() => import('./pages/StoryViewer'));
const GroupDetail = lazy(() => import('./pages/GroupDetail'));
const CreateGroup = lazy(() => import('./pages/CreateGroup'));
const GroupAdmin = lazy(() => import('./pages/GroupAdmin'));
const Confessions = lazy(() => import('./pages/Confessions'));
const ListingDetail = lazy(() => import('./pages/ListingDetail'));
const SellItem = lazy(() => import('./pages/SellItem'));
const SellerProfile = lazy(() => import('./pages/SellerProfile'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const SkillMarket = lazy(() => import('./pages/SkillMarket'));
const SkillHub = lazy(() => import('./pages/SkillHub'));
const Signup = lazy(() => import('./pages/Signup'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Orders = lazy(() => import('./pages/Orders'));
const MyListings = lazy(() => import('./pages/MyListings'));
const ReportListing = lazy(() => import('./pages/ReportListing'));
const MarketplaceOrder = lazy(() => import('./pages/MarketplaceOrder'));
const MarketplaceSafety = lazy(() => import('./pages/MarketplaceSafety'));
import MarketplaceModals from './components/modals/MarketplaceModals';
const MarketplaceChat = lazy(() => import('./pages/MarketplaceChat'));
const MarketplaceSettings = lazy(() => import('./pages/MarketplaceSettings'));
const SparklyBot = lazy(() => import('./pages/SparklyBot'));

// Phase 2 — Social & Community
const Clubs = lazy(() => import('./pages/Clubs'));
const ClubDetail = lazy(() => import('./pages/ClubDetail'));
const Events = lazy(() => import('./pages/Events'));
const EventsAdmin = lazy(() => import('./pages/EventsAdmin'));
const Connect = lazy(() => import('./pages/Connect'));
const FollowRequests = lazy(() => import('./pages/FollowRequests'));

// Phase 3 — Content & Discovery
const Polls = lazy(() => import('./pages/Polls'));
const PollDetail = lazy(() => import('./pages/PollDetail'));
const Hashtag = lazy(() => import('./pages/Hashtag'));
const Explore = lazy(() => import('./pages/Explore'));
const Moments = lazy(() => import('./pages/Moments'));
const CreateMoment = lazy(() => import('./pages/CreateMoment'));
const CreateStory = lazy(() => import('./pages/CreateStory'));
const StorySnapshot = lazy(() => import('./pages/StorySnapshot'));
const Streams = lazy(() => import('./pages/Streams'));
const ProfessionalDashboard = lazy(() => import('./pages/ProfessionalDashboard'));
import GlobalEffects from './components/GlobalEffects';
import LoadingBar from './components/LoadingBar';
import { TikTokHearts } from './components/TikTokHearts';
import PresenceManager from './components/PresenceManager';

// Phase 4 — Utility
const LostFound = lazy(() => import('./pages/LostFound'));
const Support = lazy(() => import('./pages/Support'));
const TicketDetail = lazy(() => import('./pages/Support/TicketDetail'));
const AccountsCenter = lazy(() => import('./pages/AccountsCenter'));
const Memories = lazy(() => import('./pages/Memories'));
const Gallery = lazy(() => import('./pages/Gallery'));
const Verified = lazy(() => import('./pages/Verified'));
const Invite = lazy(() => import('./pages/Invite'));
const Help = lazy(() => import('./pages/Help'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
import OnboardingSheet from './components/onboarding/OnboardingSheet';
const Ecosystem = lazy(() => import('./pages/Ecosystem'));

const BlockedUsers = lazy(() => import('./pages/BlockedUsers'));
import AudioDiagnostics from './audio/diagnostics/AudioDiagnostics';

// Phase 5 — Public & Static
const About = lazy(() => import('./pages/About'));
const LegalViewer = lazy(() => import('./pages/LegalViewer'));
const NotFound = lazy(() => import('./pages/NotFound'));

// New Creator Dashboard Sub-Routes
const Ads = lazy(() => import('./pages/Ads'));
const CreatorStudio = lazy(() => import('./pages/CreatorStudio'));
const CreatorAnalytics = lazy(() => import('./pages/CreatorAnalytics'));
const WalletHistory = lazy(() => import('./pages/WalletHistory'));
import { getRoleFromToken } from './utils/tokenUtils';
import { getPostLoginRoute, resolveAdminAccess } from './utils/adminRoute';
import { ensureFreshAccessToken } from './services/tokenRefresh';
import { isDefinitiveAuthFailure } from './utils/startupAuth';
import { installGlobalImageFallback } from './utils/imageFallback';
import { logger } from './utils/logger';
import PageShell from './components/PageShell';
import SparkleHubPage from './pages/SparkleHubPage';
import InviteLandingPage from './pages/InviteLandingPage';

function App() {
  const { isAuthenticated, token, refreshToken } = useUserStore();
  const [hydrated, setHydrated] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [navigationCompleted, setNavigationCompleted] = useState(false);
  const navigate = useNavigate();
  const uploadManagerInitRef = useRef(false);
  const socket = useSocket();
  const { setStories } = useFeedStore();

  // Any <img> whose load fails (dead CDN/link) swaps to the no-image placeholder
  useEffect(() => installGlobalImageFallback(), []);

  // Helper function to manage safe navigation decision
  const performStartupNavigation = (target: string) => {
    if (navigationCompleted) return;

    const currentPath = window.location.pathname;
    const isPublic = ['/signup', '/forgot-password', '/reset-password', '/about', '/ai', '/legal'].some(
      p => currentPath.startsWith(p)
    ) || Boolean(currentPath.match(/^\/invite\/.+/));

    logger.log(`[Navigation] Target: ${target}, Current: ${currentPath}, isPublic: ${isPublic}`);

    // Ensure state transitions occur so component renders fully
    setHydrated(true);
    setShowSplash(false);
    logger.log('SPLASH HIDDEN');

    if (isPublic) {
      logger.log(`[Navigation] Preserving public path: ${currentPath}`);
      if (currentPath.startsWith('/signup')) {
        logger.log('NAVIGATING TO SIGNUP');
      }
      setNavigationCompleted(true);
      return;
    }

    if (target === '/dashboard') {
      logger.log('NAVIGATING TO DASHBOARD');
      navigate('/dashboard');
    } else {
      logger.log('NAVIGATING TO LOGIN');
      navigate('/login');
    }
    setNavigationCompleted(true);
  };

  // 1️⃣ Splash Mounted Log
  useEffect(() => {
    logger.log('SPLASH MOUNTED');
  }, []);

  // 2️⃣ Hard Fail-safe Watchdog Timer
  useEffect(() => {
    logger.log('[Failsafe] Starting 5s startup watchdog');
    const watchdog = setTimeout(() => {
      if (!navigationCompleted) {
        // H24: a slow boot (DB blip → 5s+ validate) must not bounce a valid
        // session to /login — navigate by the session we actually have.
        logger.warn("Startup timeout reached — navigating by session state");
        performStartupNavigation(useUserStore.getState().isAuthenticated ? '/dashboard' : '/login');
      }
    }, 5000);
    return () => clearTimeout(watchdog);
  }, [navigationCompleted]);

  // 3️⃣ Unified Startup Initialization Sequence
  useEffect(() => {
    logger.log('[Startup] Beginning unified init');
    const runInit = async () => {
      // 1. Hydration Phase
      try {
        if (useUserStore.persist.hasHydrated()) {
          logger.log('[Startup] Persist already hydrated');
          setHydrated(true);
        } else {
          logger.log('[Startup] Waiting for persist hydration');
          await Promise.race([
            new Promise<void>((resolve) => {
              const unsub = useUserStore.persist.onFinishHydration(() => {
                logger.log('[Startup] Persist hydration finished');
                setHydrated(true);
                resolve();
              });
            }),
            new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error('Zustand hydration timeout')), 2000)
            )
          ]);
        }
      } catch (hydrationError) {
        logger.warn('⚠️ Hydration validation failed (falling back):', hydrationError);
        setHydrated(true);
      }

      // Read current values directly from store state to ensure we have post-hydration values
      const currentStoreState = useUserStore.getState();
      const currentToken = currentStoreState.token;
      const currentRefreshToken = currentStoreState.refreshToken;

      // 2. Authentication Check Phase
      logger.log('AUTH CHECK STARTED');
      if (currentToken || currentRefreshToken) {
        logger.log('TOKEN FOUND');
        try {
          logger.log('API REQUEST STARTED');
          // H21: rotate the token BEFORE validate + mount effects fire, so a
          // stale session doesn't produce a 401 burst (and a slow refresh can't
          // trip the validation timeout → login bounce while still authenticated).
          await ensureFreshAccessToken(30_000);
          async function runWithTimeout<T>(p: Promise<T>, timeoutMs: number): Promise<T> {
            return Promise.race([
              p,
              new Promise<T>((_, reject) =>
                setTimeout(() => reject(new Error('Auth validation timeout')), timeoutMs)
              ),
            ]);
          }
          await runWithTimeout(authApi.validateToken(), 5000);
          logger.log('API REQUEST COMPLETED');
          
          performStartupNavigation('/dashboard');
        } catch (err) {
          // H23: only a definitive rejection ends the session. A timeout,
          // 503 (DB outage) or network failure must NOT bounce a valid
          // session to the login screen — boot optimistically instead;
          // later 401s run the normal refresh → logout flow.
          if (isDefinitiveAuthFailure(err) || !useUserStore.getState().isAuthenticated) {
            logger.warn('⚠️ Initial auth validation failed (fallback to Login):', err);
            logger.log('TOKEN NOT FOUND');
            performStartupNavigation('/login');
          } else {
            logger.warn('⚠️ Initial auth validation transient failure (continuing boot):', err);
            performStartupNavigation('/dashboard');
          }
        }
      } else {
        logger.log('TOKEN NOT FOUND');
        performStartupNavigation('/login');
      }
    };

    runInit().catch(err => {
      logger.error('Fatal initialization exception:', err);
      performStartupNavigation('/login');
    });
  }, []); // Run exactly once on component mount

  // OTA check (still after hydration)
  useEffect(() => {
    if (!hydrated) return;
    logger.log('[OTA] Checking for updates');
    OtaService.checkAndDownloadUpdate().catch(err => {
      logger.warn('OTA Background trigger warning:', err);
    });
  }, [hydrated]);

  // ── Upload Manager: Initialize once after hydration ──
  useEffect(() => {
    if (!hydrated || !isAuthenticated || uploadManagerInitRef.current) return;
    uploadManagerInitRef.current = true;
    logger.log('[App] Initializing UploadManager...');
    UploadManager.init();
  }, [hydrated, isAuthenticated]);

  // ── Socket: Listen for story:published to auto-refresh stories bar ──
  useEffect(() => {
    if (!socket) return;
    const handleStoryPublished = (data: any) => {
      logger.log('[App] story:published received, refreshing stories...', data);
      
      // Re-fetch active stories to reflect the newly published story
      api.get('/stories/active').then((res: any) => {
        if (Array.isArray(res.data)) {
          setStories(res.data);
        }
      }).catch((err: any) => {
        logger.warn('[App] Failed to refresh stories after publish event:', err);
      });

      // If the current user published the story, reload notifications to show the top success notification
      const currentUserId = useUserStore.getState().user?.id || useUserStore.getState().user?.user_id;
      if (data && data.user_id === currentUserId) {
        useNotificationStore.getState().fetchNotifications(true);
      }
    };
    socket.on('story:published', handleStoryPublished);
    return () => {
      socket.off('story:published', handleStoryPublished);
    };
  }, [socket, setStories]);

  // ── Socket: Route incoming notifications to the audio engine ──
  useEffect(() => {
    if (!socket) return;
    const onNotification = (data: any) => {
      handleNotificationSound(data);
    };
    socket.on('new-notification', onNotification);
    return () => {
      socket.off('new-notification', onNotification);
    };
  }, [socket]);

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
      <div className="flex flex-col items-center justify-center min-h-dvh bg-[#ffe6f2] transition-colors duration-500">
        <div className="flex flex-col items-center justify-center p-8 text-center animate-fade-in">
          {/* Logo container with soft shadow and pulsing animations */}
          <div className="w-64 h-64 md:w-96 md:h-96 mb-6 rounded-3xl bg-[#ffe6f2] shadow-[0_12px_40px_rgba(255,20,147,0.15)] border border-pink-500/10 flex items-center justify-center p-6 transition-all duration-500 scale-100 animate-pulse-slow">
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
          <div className="mt-12 flex items-center justify-center relative w-10 h-10">
            <span className="w-2 h-2 bg-[#ff1493] rounded-full animate-dot-pulse absolute top-0 left-1/2 transform -translate-x-1/2" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-[#fb7185] rounded-full animate-dot-pulse absolute right-0 top-1/2 transform -translate-y-1/2" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-[#ff1493] rounded-full animate-dot-pulse absolute bottom-0 left-1/2 transform -translate-x-1/2" style={{ animationDelay: '300ms' }} />
            <span className="w-2 h-2 bg-[#fb7185] rounded-full animate-dot-pulse absolute left-0 top-1/2 transform -translate-y-1/2" style={{ animationDelay: '450ms' }} />
          </div>
        </div>
        <style>{`
          @          .animate-pulse-slow {
            animation: pulse-slow 3s infinite ease-in-out;
          }
          @          .animate-shimmer {
            background-size: 200% auto;
            animation: shimmer 4s infinite linear;
          }
          /* Loading dot pulse: fade in/out */
          
          .animate-dot-pulse {
            animation: dotPulse 1.2s infinite;
          }
        `}</style>
      </div>
    );
  }

  return (
    <OTAUpdateProvider>
      <MotionConfig reducedMotion="user">
      <SoundProvider>
      <CameraProvider>
        <NetworkStatusProvider>
          <OfflineIndicator />
          <DialogHost />
          <GlobalThemeProvider>
            <MockCallProvider>
              <div className="app no-scrollbar">
                  <LoadingBar />
                  <GlobalEffects />
                  <MarketplaceModals />
                  <TikTokHearts />
                  {/* PresenceManager — mounted once globally. Keeps the socket alive and
                      updates online/offline state regardless of which page is active. */}
                  <PresenceManager />
                  <CallOverlay />
                  <AppLockOverlay />
                  <CrossDeviceSecurityAlertOverlay />
                  <UploadNotificationCenter />
                  <Suspense fallback={
                        <div className="flex items-center justify-center h-full py-20">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
                        </div>
                      }>
                    <Routes>
                    {/* ── Phase 1: Auth & Core ── */}
                    <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
                    <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to={getPostLoginRoute(getRoleFromToken(token))} />} />
                    <Route path="/signup" element={!isAuthenticated ? <Signup /> : <Navigate to={getPostLoginRoute(getRoleFromToken(token))} />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
                    <Route path="/home" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/messages" element={isAuthenticated ? <Messages /> : <Navigate to="/login" />} />
                    <Route path="/messages/:targetId" element={isAuthenticated ? <Messages /> : <Navigate to="/login" />} />
                    <Route path="/messages/settings" element={isAuthenticated ? <MessagesSettings /> : <Navigate to="/login" />} />
                    <Route path="/stories/:userId" element={isAuthenticated ? <StoryViewer /> : <Navigate to="/login" />} />


                    {/* ── Phase 2: Social & Community ── */}

                    {/* ── Phase 3: Content & Discovery ── */}
                    <Route path="/moments" element={isAuthenticated ? <Moments /> : <Navigate to="/login" />} />
                    <Route path="/moments/:id" element={isAuthenticated ? <Moments /> : <Navigate to="/login" />} />
                    <Route path="/story/:storyId" element={isAuthenticated ? <StorySnapshot /> : <Navigate to="/login" />} />
                    <Route path="/afterglow/create" element={isAuthenticated ? <CreateStory /> : <Navigate to="/login" />} />
                    <Route path="/moments/create" element={isAuthenticated ? <CreateMoment /> : <Navigate to="/login" />} />
                    <Route path="/streams" element={isAuthenticated ? <Streams /> : <Navigate to="/login" />} />
                    {/* Convenience alias routes */}
                    <Route path="/live" element={<Navigate to="/streams" replace />} />
                    <Route path="/upload" element={<Navigate to="/moments/create" replace />} />
                    <Route path="/shop" element={<Navigate to="/marketplace/my-shop" replace />} />

                    {/* ── Phase 4: Utility & Features ── */}
                    <Route path="/onboarding" element={isAuthenticated ? <Onboarding /> : <Navigate to="/login" />} />
                    <Route path="/onboarding/about" element={<OnboardingSheet />} />
                    <Route path="/onboarding/sheets" element={<OnboardingSheet />} />
                    <Route path="/onboarding/sheet" element={<OnboardingSheet />} />
                    <Route path="/onboarding-sheet" element={<OnboardingSheet />} />

                    {/* ── Phase 5: Public & Static ── */}
                    <Route path="/about" element={<About />} />
                    <Route path="/legal" element={<LegalViewer />} />
                    <Route path="/legal/:documentId" element={<LegalViewer />} />
                    <Route path="/ai" element={<SparkleAIScreen />} />
                    {/* <Route path="/ai/study" element={<StudyAssistantScreen />} /> */}
                    {/* <Route path="/ai/caption" element={<CaptionGeneratorScreen />} /> */}
                    {/* <Route path="/ai/bio" element={<BioGeneratorScreen />} /> */}
                    <Route path="/ai/search" element={<SearchSparkleScreen />} />
                    <Route path="/ai/friend" element={<FriendDiscoveryScreen />} />
                    <Route path="*" element={<NotFound />} />

                    {/* ── Shell-routed pages: PageShell owns Navbar/sidebar + header/rail offsets (S1 / §3 P2-1) ── */}
                    <Route element={<PageShell />}>
                    <Route path="/profile/:username" element={isAuthenticated ? <Profile /> : <Navigate to="/login" />} />
                    <Route path="/marketplace" element={isAuthenticated ? <Marketplace /> : <Navigate to="/login" />} />
                    <Route path="/groups" element={isAuthenticated ? <Groups /> : <Navigate to="/login" />} />
                    <Route path="/settings" element={isAuthenticated ? <Settings /> : <Navigate to="/login" />} />
                    <Route path="/settings/security" element={isAuthenticated ? <SecurityCentre /> : <Navigate to="/login" />} />
                    <Route path="/settings/change-password" element={isAuthenticated ? <ChangePassword /> : <Navigate to="/login" />} />
                    <Route path="/settings/advanced" element={isAuthenticated ? <AdvancedSettings /> : <Navigate to="/login" />} />
                    <Route path="/settings/advanced/:section" element={isAuthenticated ? <AdvancedSettingsDetail /> : <Navigate to="/login" />} />
                    <Route path="/settings/blocked" element={isAuthenticated ? <BlockedUsers /> : <Navigate to="/login" />} />
                    <Route path="/settings/audio-diagnostics" element={isAuthenticated ? <AudioDiagnostics /> : <Navigate to="/login" />} />
                    <Route path="/notifications" element={isAuthenticated ? <Notifications /> : <Navigate to="/login" />} />
                    <Route path="/search" element={isAuthenticated ? <Search /> : <Navigate to="/login" />} />
                    <Route path="/search/history" element={isAuthenticated ? <SearchHistory /> : <Navigate to="/login" />} />
                    <Route path="/admin" element={isAuthenticated ? (resolveAdminAccess(getRoleFromToken(token)) === 'deny' ? <Navigate to="/dashboard" replace /> : <AdminDashboard />) : <Navigate to="/login" />} />
                    <Route path="/admin/storage" element={isAuthenticated ? <StorageIntelligencePanel /> : <Navigate to="/login" />} />
                    <Route path="/post/:id" element={isAuthenticated ? <PostDetail /> : <Navigate to="/login" />} />
                    <Route path="/groups/create" element={isAuthenticated ? <CreateGroup /> : <Navigate to="/login" />} />
                    <Route path="/groups/:id/settings" element={isAuthenticated ? <GroupAdmin /> : <Navigate to="/login" />} />
                    <Route path="/groups/:id" element={isAuthenticated ? <GroupDetail /> : <Navigate to="/login" />} />
                    <Route path="/confessions" element={isAuthenticated ? <Confessions /> : <Navigate to="/login" />} />
                    <Route path="/confessions/:id" element={isAuthenticated ? <Confessions /> : <Navigate to="/login" />} />
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
                    <Route path="/sparkly-bot" element={isAuthenticated ? <SparklyBot /> : <Navigate to="/login" />} />
                    <Route path="/sparkly-bot/*" element={isAuthenticated ? <SparklyBot /> : <Navigate to="/login" />} />
                    <Route path="/sparkly" element={isAuthenticated ? <SparklyBot /> : <Navigate to="/login" />} />
                    <Route path="/sparkly/*" element={isAuthenticated ? <SparklyBot /> : <Navigate to="/login" />} />
                    <Route path="/sparklybot" element={isAuthenticated ? <SparklyBot /> : <Navigate to="/login" />} />
                    <Route path="/marketplace/sparkly" element={isAuthenticated ? <SparklyBot /> : <Navigate to="/login" />} />
                    <Route path="/ai/sparkly" element={isAuthenticated ? <SparklyBot /> : <Navigate to="/login" />} />
                    <Route path="/ai/sparkly-bot" element={isAuthenticated ? <SparklyBot /> : <Navigate to="/login" />} />
                    <Route path="/wishlist" element={isAuthenticated ? <Wishlist /> : <Navigate to="/login" />} />
                    <Route path="/skill-market" element={isAuthenticated ? <SkillMarket /> : <Navigate to="/login" />} />
                    <Route path="/skill-market/hub" element={isAuthenticated ? <SkillHub /> : <Navigate to="/login" />} />
                    <Route path="/clubs" element={isAuthenticated ? <Clubs /> : <Navigate to="/login" />} />
                    <Route path="/clubs/:id" element={isAuthenticated ? <ClubDetail /> : <Navigate to="/login" />} />
                    <Route
                      path="/learn-more"
                      element={
                        isAuthenticated ? (
                          <Suspense
                            fallback={
                              <div className="flex items-center justify-center h-full">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
                              </div>
                            }
                          >
                            <LearnMorePage />
                          </Suspense>
                        ) : (
                          <Navigate to="/login" />
                        )
                      }
                    />
                    <Route path="/events" element={isAuthenticated ? <Events /> : <Navigate to="/login" />} />
                    <Route path="/events/admin" element={isAuthenticated ? <EventsAdmin /> : <Navigate to="/login" />} />
                    <Route path="/connect" element={isAuthenticated ? <Connect /> : <Navigate to="/login" />} />
                    <Route path="/follow-requests" element={isAuthenticated ? <FollowRequests /> : <Navigate to="/login" />} />
                    <Route path="/polls" element={isAuthenticated ? <Polls /> : <Navigate to="/login" />} />
                    <Route path="/polls/:id" element={isAuthenticated ? <PollDetail /> : <Navigate to="/login" />} />
                    <Route path="/hashtag/:tag" element={isAuthenticated ? <Hashtag /> : <Navigate to="/login" />} />
                    <Route path="/explore" element={isAuthenticated ? <Explore /> : <Navigate to="/login" />} />
                    <Route path="/professional-dashboard" element={isAuthenticated ? <ProfessionalDashboard /> : <Navigate to="/login" />} />
                    <Route path="/ads" element={isAuthenticated ? <Ads /> : <Navigate to="/login" />} />
                    <Route path="/studio" element={isAuthenticated ? <CreatorStudio /> : <Navigate to="/login" />} />
                    <Route path="/analytics" element={isAuthenticated ? <CreatorAnalytics /> : <Navigate to="/login" />} />
                    <Route path="/wallet/history" element={isAuthenticated ? <WalletHistory /> : <Navigate to="/login" />} />

                    {/* ── Phase 4: Utility & Features ── */}
                    <Route path="/hub" element={isAuthenticated ? <SparkleHubPage /> : <Navigate to="/login" />} />
                    <Route path="/ecosystem" element={isAuthenticated ? <Ecosystem /> : <Navigate to="/login" />} />
                    <Route path="/lost-found" element={isAuthenticated ? <LostFound /> : <Navigate to="/login" />} />
                    <Route path="/support" element={isAuthenticated ? <Support /> : <Navigate to="/login" />} />
                    <Route path="/support/ticket/:ticketId" element={isAuthenticated ? <TicketDetail /> : <Navigate to="/login" />} />
                    <Route path="/settings/accounts" element={isAuthenticated ? <AccountsCenter /> : <Navigate to="/login" />} />
                    <Route path="/memories" element={isAuthenticated ? <Memories /> : <Navigate to="/login" />} />
                    <Route path="/gallery" element={isAuthenticated ? <Gallery /> : <Navigate to="/login" />} />
                    <Route path="/verified" element={isAuthenticated ? <Verified /> : <Navigate to="/login" />} />
                    <Route path="/invite" element={isAuthenticated ? <Invite /> : <Navigate to="/login" />} />
                    <Route path="/invite/:code" element={<InviteLandingPage />} />
                    <Route path="/help" element={isAuthenticated ? <Help /> : <Navigate to="/login" />} />
                    </Route>

                    </Routes>
                  </Suspense>
                </div>
            </MockCallProvider>
          </GlobalThemeProvider>
        </NetworkStatusProvider>
      </CameraProvider>
      </SoundProvider>
    </MotionConfig>
    </OTAUpdateProvider>

  );
}

export default App;
