import { showInfo, showError, showSuccess } from '../utils/toast';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Eye, Video, ArrowLeft, Radio, Award, AlertCircle,
  Mic, MicOff, VideoOff, Users, Clock, WifiOff, X, PhoneOff,
  Heart, Send, Gift, Settings, Pin, Trash2, VolumeX,
  Search, Share2, Camera, Check, Sparkles, RefreshCw
} from 'lucide-react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import LockedLivePage from './LockedLivePage';
import Spinner from '../components/ui/Spinner';
import { useSocket } from '../hooks/useSocket';
import { TikTokHearts } from '../components/TikTokHearts';

interface LiveStream {
  id?: string;
  stream_id: string;
  title: string;
  username: string;
  avatar_url?: string;
  thumbnail_url?: string;
  viewer_count: number;
  category?: string;
  started_at: string;
  streamer_id: string;
}

interface StreamComment {
  id: string;
  streamId: string;
  userId: string;
  username: string;
  name?: string;
  avatar_url?: string;
  content: string;
  isHost?: boolean;
  isGuest?: boolean;
  isModerator?: boolean;
  timestamp: number;
}

interface LiveGift {
  id: string;
  name: string;
  coins: number;
  icon: string;
}

interface GuestRequest {
  guestSocketId: string;
  guestUserId: string;
  user: {
    username: string;
    name?: string;
    avatar_url?: string;
  };
}

interface StreamSummaryStats {
  duration: string;
  peakViewers: number;
  totalLikes: number;
  totalComments: number;
  totalGifts: number;
  totalCoins: number;
}

const GIFT_CATALOG: LiveGift[] = [
  { id: 'heart', name: 'Heart', coins: 10, icon: '💖' },
  { id: 'rose', name: 'Rose', coins: 25, icon: '🌹' },
  { id: 'sparkle', name: 'Sparkle', coins: 50, icon: '✨' },
  { id: 'crown', name: 'Crown', coins: 100, icon: '👑' },
  { id: 'diamond', name: 'Diamond', coins: 250, icon: '💎' },
  { id: 'rocket', name: 'Rocket', coins: 500, icon: '🚀' },
  { id: 'galaxy', name: 'Galaxy', coins: 1000, icon: '🌌' },
];

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'general', label: 'General' },
  { id: 'study', label: 'Study' },
  { id: 'music', label: 'Music' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'fitness', label: 'Fitness' },
  { id: 'art', label: 'Art' },
  { id: 'talk', label: 'Campus Talk' },
];

const QUICK_EMOJIS = ['🔥', '❤️', '👏', '😂', '💎', '🎉'];

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed' | 'ended';

function formatDuration(startedAt: string | number): string {
  const startMs = typeof startedAt === 'string' ? new Date(startedAt).getTime() : startedAt;
  const seconds = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function Streams() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useUserStore(state => state.user);
  const socket = useSocket();

  // Streams Listing State
  const [loading, setLoading] = useState(true);
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Eligibility State
  const [isEligibleToGoLive, setIsEligibleToGoLive] = useState(false);
  const [followers, setFollowers] = useState(() => user?.followers_count ?? 0);
  const [showLockedModal, setShowLockedModal] = useState(false);

  // Broadcaster State
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [liveTitle, setLiveTitle] = useState('');
  const [liveCategory, setLiveCategory] = useState('general');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastState, setBroadcastState] = useState<ConnectionState>('idle');
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  const [broadcastViewerCount, setBroadcastViewerCount] = useState(0);
  const [peakViewerCount, setPeakViewerCount] = useState(0);
  const [broadcastDuration, setBroadcastDuration] = useState('0:00');
  const [broadcastStartTime, setBroadcastStartTime] = useState<number | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Viewer State
  const [watchingStream, setWatchingStream] = useState<LiveStream | null>(null);
  const [viewerState, setViewerState] = useState<ConnectionState>('idle');
  const [viewerCount, setViewerCount] = useState(0);

  // Engagement: Comments, Likes, Gifts
  const [comments, setComments] = useState<StreamComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [pinnedComment, setPinnedComment] = useState<StreamComment | null>(null);
  const [likesCount, setLikesCount] = useState(0);
  const [recentGiftAnnouncement, setRecentGiftAnnouncement] = useState<{
    senderName: string;
    giftName: string;
    icon: string;
    coins: number;
  } | null>(null);
  const [totalCoinsEarned, setTotalCoinsEarned] = useState(0);
  const [selectedCommentForMod, setSelectedCommentForMod] = useState<StreamComment | null>(null);

  // Drawers & Modals
  const [showGiftsDrawer, setShowGiftsDrawer] = useState(false);
  const [selectedGift, setSelectedGift] = useState<LiveGift>(GIFT_CATALOG[0]);
  const [userCoinsBalance, setUserCoinsBalance] = useState<number>(0);
  const [sendingGift, setSendingGift] = useState(false);
  const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryStats, setSummaryStats] = useState<StreamSummaryStats | null>(null);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [allowGuestRequests, setAllowGuestRequests] = useState(true);

  // Multi-Guest State
  const [guestRequests, setGuestRequests] = useState<GuestRequest[]>([]);
  const [showGuestManagerDrawer, setShowGuestManagerDrawer] = useState(false);
  const [activeGuest, setActiveGuest] = useState<{
    socketId: string;
    userId: string;
    username: string;
  } | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [guestRequestPending, setGuestRequestPending] = useState(false);

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const guestVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const guestStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const viewerPeerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const guestPeerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const autoJoinedRef = useRef(false);

  // Standard STUN servers configuration
  const iceConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ]
  };

  // ── 1. Check Live Eligibility & Wallet Balance ───────────────────────────────
  useEffect(() => {
    let cancelled = false;

    // Check Eligibility
    api.get('/streams/eligibility')
      .then(res => {
        if (!cancelled && res.data) {
          setIsEligibleToGoLive(Boolean(res.data.eligible));
          if (res.data.followers_count !== undefined) {
            setFollowers(res.data.followers_count);
          }
        }
      })
      .catch(() => {
        if (!cancelled && (user?.followers_count ?? 0) >= 1000) {
          setIsEligibleToGoLive(true);
        }
      });

    // Fetch Wallet balance for gifts
    api.get('/wallet')
      .then(res => {
        if (!cancelled && res.data?.wallet) {
          const cents = Number(res.data.wallet.available_balance) || 0;
          setUserCoinsBalance(Math.floor(cents / 100));
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [user?.followers_count]);

  // ── 2. Load Active Streams ──────────────────────────────────────────────────
  const loadStreams = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const { data } = await api.get('/streams');
      const streamList = Array.isArray(data) ? data : (data.streams || []);
      setStreams(streamList);
    } catch {
      setLoadError(true);
      showError('Could not load live streams.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStreams();
  }, [loadStreams]);

  // ── 3. Handle Auto-join from URL parameter ?streamId=... ────────────────────
  useEffect(() => {
    const targetStreamId = searchParams.get('streamId');
    if (!targetStreamId || autoJoinedRef.current || loading || streams.length === 0) return;

    const matchedStream = streams.find(s => (s.stream_id || s.id) === targetStreamId);
    if (matchedStream) {
      autoJoinedRef.current = true;
      joinStream(matchedStream);
    }
  }, [searchParams, loading, streams]);

  // ── 4. Broadcast Duration & Peak Viewers Tracker ────────────────────────────
  useEffect(() => {
    if (broadcastStartTime && isBroadcasting) {
      durationIntervalRef.current = setInterval(() => {
        setBroadcastDuration(formatDuration(broadcastStartTime));
      }, 1000);
    } else {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    }
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current);
    };
  }, [broadcastStartTime, isBroadcasting]);

  useEffect(() => {
    if (broadcastViewerCount > peakViewerCount) {
      setPeakViewerCount(broadcastViewerCount);
    }
  }, [broadcastViewerCount, peakViewerCount]);

  // ── 5. Auto Scroll Comments ─────────────────────────────────────────────────
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  // ── 6. Socket.IO Real-Time WebRTC & Engagement Listeners ────────────────────
  useEffect(() => {
    if (!socket) return;

    // --- Broadcaster WebRTC Handlers ---
    const handleViewerJoined = async (data: { viewerSocketId: string; streamId: string; viewerCount?: number }) => {
      if (data.streamId !== currentStreamId) return;

      const pc = new RTCPeerConnection(iceConfig);
      peerConnectionsRef.current.set(data.viewerSocketId, pc);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('stream:ice-candidate', {
            targetSocketId: data.viewerSocketId,
            candidate: event.candidate,
          });
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('stream:offer', {
          streamId: currentStreamId,
          viewerSocketId: data.viewerSocketId,
          sdp: offer,
        });
      } catch (err) {
        console.error('Error creating offer for viewer:', err);
      }

      if (data.viewerCount !== undefined) {
        setBroadcastViewerCount(data.viewerCount);
      } else {
        setBroadcastViewerCount(c => c + 1);
      }
    };

    const handleAnswerFromViewer = async (data: { viewerSocketId: string; sdp: RTCSessionDescriptionInit }) => {
      const pc = peerConnectionsRef.current.get(data.viewerSocketId);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } catch (err) {
        console.error('Error setting remote description from answer:', err);
      }
    };

    const handleViewerLeft = (data: { viewerSocketId: string; viewerCount?: number }) => {
      const pc = peerConnectionsRef.current.get(data.viewerSocketId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(data.viewerSocketId);
      }
      if (data.viewerCount !== undefined) {
        setBroadcastViewerCount(data.viewerCount);
      } else {
        setBroadcastViewerCount(c => Math.max(0, c - 1));
      }
    };

    // --- Viewer WebRTC Handlers ---
    const handleOfferFromBroadcaster = async (data: { broadcasterSocketId: string; streamId: string; sdp: RTCSessionDescriptionInit }) => {
      if (!watchingStream) return;

      const pc = new RTCPeerConnection(iceConfig);
      viewerPeerConnectionRef.current = pc;

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setViewerState('connected');
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('stream:ice-candidate', {
            targetSocketId: data.broadcasterSocketId,
            candidate: event.candidate,
          });
        }
      };

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('stream:answer', {
          streamId: data.streamId,
          broadcasterSocketId: data.broadcasterSocketId,
          sdp: answer,
        });
      } catch (err) {
        console.error('Error handling offer from broadcaster:', err);
        setViewerState('failed');
      }
    };

    const handleIceCandidate = async (data: { fromSocketId: string; candidate: RTCIceCandidateInit }) => {
      const pcBroadcaster = peerConnectionsRef.current.get(data.fromSocketId);
      if (pcBroadcaster) {
        try {
          await pcBroadcaster.addIceCandidate(new RTCIceCandidate(data.candidate));
          return;
        } catch (_) {}
      }
      if (viewerPeerConnectionRef.current) {
        try {
          await viewerPeerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (_) {}
      }
      if (guestPeerConnectionRef.current) {
        try {
          await guestPeerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (_) {}
      }
    };

    const handleStreamEnded = (data: { streamId: string }) => {
      const activeId = watchingStream?.stream_id || watchingStream?.id;
      if (activeId === data.streamId) {
        setViewerState('ended');
        cleanupViewer();
      }
    };

    const handleViewerCountUpdate = (data: { streamId: string; viewerCount: number }) => {
      if (data.streamId === currentStreamId) {
        setBroadcastViewerCount(data.viewerCount);
      }
      const activeId = watchingStream?.stream_id || watchingStream?.id;
      if (data.streamId === activeId) {
        setViewerCount(data.viewerCount);
      }
    };

    // --- Interactive Comments ---
    const handleComment = (comment: StreamComment) => {
      const activeId = currentStreamId || watchingStream?.stream_id || watchingStream?.id;
      if (comment.streamId === activeId) {
        setComments(prev => [...prev.slice(-100), comment]);
      }
    };

    const handleCommentDeleted = ({ commentId }: { commentId: string }) => {
      setComments(prev => prev.filter(c => c.id !== commentId));
      if (pinnedComment?.id === commentId) {
        setPinnedComment(null);
      }
    };

    const handleCommentPinned = ({ comment }: { comment: StreamComment }) => {
      setPinnedComment(comment);
    };

    const handleCommentUnpinned = () => {
      setPinnedComment(null);
    };

    // --- Likes & Floating Hearts ---
    const handleLike = (data: { likesCount: number; userId: string; increment?: number }) => {
      setLikesCount(data.likesCount);
      // Spawn floating heart animation
      window.dispatchEvent(new CustomEvent('spawn-tiktok-heart', {
        detail: {
          x: window.innerWidth - 60 - Math.random() * 40,
          y: window.innerHeight - 150 - Math.random() * 50,
          pattern: 'burst'
        }
      }));
    };

    // --- Gifts Celebration ---
    const handleGiftReceived = (data: {
      streamId: string;
      giftName: string;
      coins: number;
      icon: string;
      sender: { userId: string; username: string; name?: string };
    }) => {
      const activeId = currentStreamId || watchingStream?.stream_id || watchingStream?.id;
      if (data.streamId === activeId) {
        setTotalCoinsEarned(c => c + data.coins);
        setRecentGiftAnnouncement({
          senderName: data.sender?.username || 'Supporter',
          giftName: data.giftName,
          icon: data.icon,
          coins: data.coins,
        });

        // Trigger hearts burst for gift
        window.dispatchEvent(new CustomEvent('spawn-tiktok-heart', {
          detail: {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            pattern: 'v'
          }
        }));

        setTimeout(() => {
          setRecentGiftAnnouncement(null);
        }, 4000);
      }
    };

    // --- Multi-Guest Signalling ---
    const handleGuestRequest = (data: GuestRequest) => {
      if (isBroadcasting) {
        setGuestRequests(prev => {
          if (prev.some(r => r.guestSocketId === data.guestSocketId)) return prev;
          return [...prev, data];
        });
        showInfo(`${data.user.username} requested to join your live!`);
      }
    };

    const handleGuestAccepted = async () => {
      setIsGuest(true);
      setGuestRequestPending(false);
      showSuccess('Your guest request was accepted! Starting your camera...');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
          audio: true,
        });
        guestStreamRef.current = stream;
        if (guestVideoRef.current) {
          guestVideoRef.current.srcObject = stream;
        }

        const activeId = watchingStream?.stream_id || watchingStream?.id;
        socket.emit('stream:guest-status-change', { streamId: activeId, status: 'active' });
      } catch (err: any) {
        showError('Could not access camera/mic: ' + err.message);
        setIsGuest(false);
      }
    };

    const handleGuestDeclined = () => {
      setGuestRequestPending(false);
      showInfo('The host declined your guest request.');
    };

    const handleGuestRemoved = () => {
      if (guestStreamRef.current) {
        guestStreamRef.current.getTracks().forEach(t => t.stop());
        guestStreamRef.current = null;
      }
      setIsGuest(false);
      showInfo('You were removed from the guest session.');
    };

    socket.on('stream:viewer-joined', handleViewerJoined);
    socket.on('stream:answer', handleAnswerFromViewer);
    socket.on('stream:viewer-left', handleViewerLeft);
    socket.on('stream:offer', handleOfferFromBroadcaster);
    socket.on('stream:ice-candidate', handleIceCandidate);
    socket.on('stream:ended', handleStreamEnded);
    socket.on('stream:viewer-count', handleViewerCountUpdate);
    socket.on('stream:comment', handleComment);
    socket.on('stream:comment-deleted', handleCommentDeleted);
    socket.on('stream:comment-pinned', handleCommentPinned);
    socket.on('stream:comment-unpinned', handleCommentUnpinned);
    socket.on('stream:like', handleLike);
    socket.on('stream:gift-received', handleGiftReceived);
    socket.on('stream:guest-request', handleGuestRequest);
    socket.on('stream:guest-accepted', handleGuestAccepted);
    socket.on('stream:guest-declined', handleGuestDeclined);
    socket.on('stream:guest-removed', handleGuestRemoved);

    return () => {
      socket.off('stream:viewer-joined', handleViewerJoined);
      socket.off('stream:answer', handleAnswerFromViewer);
      socket.off('stream:viewer-left', handleViewerLeft);
      socket.off('stream:offer', handleOfferFromBroadcaster);
      socket.off('stream:ice-candidate', handleIceCandidate);
      socket.off('stream:ended', handleStreamEnded);
      socket.off('stream:viewer-count', handleViewerCountUpdate);
      socket.off('stream:comment', handleComment);
      socket.off('stream:comment-deleted', handleCommentDeleted);
      socket.off('stream:comment-pinned', handleCommentPinned);
      socket.off('stream:comment-unpinned', handleCommentUnpinned);
      socket.off('stream:like', handleLike);
      socket.off('stream:gift-received', handleGiftReceived);
      socket.off('stream:guest-request', handleGuestRequest);
      socket.off('stream:guest-accepted', handleGuestAccepted);
      socket.off('stream:guest-declined', handleGuestDeclined);
      socket.off('stream:guest-removed', handleGuestRemoved);
    };
  }, [socket, currentStreamId, watchingStream, isBroadcasting, pinnedComment]);

  // ── 7. Camera & Microphone Helpers ──────────────────────────────────────────
  const requestMediaPermissions = async (facing: 'user' | 'environment'): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: facing },
        audio: true
      });
      return stream;
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        showError('Camera and microphone permissions were denied. Please enable them in your settings.');
      } else if (err.name === 'NotFoundError') {
        showError('No camera or microphone found on this device.');
      } else {
        showError('Could not start media: ' + (err.message || 'unknown error'));
      }
      return null;
    }
  };

  const flipCamera = async () => {
    if (!localStreamRef.current) return;
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: nextFacing },
        audio: false
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];

      if (oldVideoTrack) {
        localStreamRef.current.removeTrack(oldVideoTrack);
        oldVideoTrack.stop();
      }

      localStreamRef.current.addTrack(newVideoTrack);
      setFacingMode(nextFacing);

      // Replace track on all viewer peer connections
      peerConnectionsRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        }
      });

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      showInfo(`Flipped to ${nextFacing === 'user' ? 'front' : 'back'} camera`);
    } catch {
      showError('Could not flip camera on this device.');
    }
  };

  // ── 8. Broadcast Lifecycle ──────────────────────────────────────────────────
  const startBroadcast = async () => {
    if (!liveTitle.trim()) {
      showError('Please enter a title for your stream.');
      return;
    }

    setBroadcastState('connecting');
    const stream = await requestMediaPermissions(facingMode);
    if (!stream) {
      setBroadcastState('idle');
      return;
    }

    localStreamRef.current = stream;

    try {
      const { data } = await api.post('/streams', {
        title: liveTitle.trim(),
        category: liveCategory,
      });

      const streamId = data.stream_id || data.id;
      if (!streamId) throw new Error('No stream identifier returned.');

      setCurrentStreamId(streamId);
      setBroadcastStartTime(Date.now());
      setIsBroadcasting(true);
      setBroadcastState('connected');
      setGoLiveOpen(false);
      setComments([]);
      setLikesCount(0);
      setTotalCoinsEarned(0);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      socket?.emit('stream:broadcaster-join', { streamId });
      loadStreams();
      showSuccess('You are now live!');
    } catch (err: any) {
      showError(err?.response?.data?.error || err.message || 'Could not start live stream.');
      stream.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      setBroadcastState('idle');
    }
  };

  const endBroadcast = async () => {
    if (!currentStreamId) return;

    // Fetch stats for summary modal
    try {
      const { data: stats } = await api.get(`/streams/${currentStreamId}/stats`);
      setSummaryStats({
        duration: broadcastDuration,
        peakViewers: Math.max(peakViewerCount, broadcastViewerCount, stats.viewer_count || 0),
        totalLikes: likesCount,
        totalComments: comments.length,
        totalGifts: stats.total_gifts || 0,
        totalCoins: totalCoinsEarned || stats.total_coins || 0,
      });
    } catch {
      setSummaryStats({
        duration: broadcastDuration,
        peakViewers: Math.max(peakViewerCount, broadcastViewerCount),
        totalLikes: likesCount,
        totalComments: comments.length,
        totalGifts: 0,
        totalCoins: totalCoinsEarned,
      });
    }

    try {
      await api.post(`/streams/${currentStreamId}/end`);
    } catch {}

    socket?.emit('stream:end', { streamId: currentStreamId });

    // Release all WebRTC peer connections
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();

    // Stop media hardware tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    setIsBroadcasting(false);
    setBroadcastState('idle');
    setCurrentStreamId(null);
    setBroadcastViewerCount(0);
    setBroadcastStartTime(null);
    setShowEndConfirmModal(false);
    setShowSummaryModal(true);
    loadStreams();
  };

  // ── 9. Viewer Lifecycle ─────────────────────────────────────────────────────
  const joinStream = async (stream: LiveStream) => {
    const streamId = stream.stream_id || stream.id;
    if (!streamId) return;

    setWatchingStream(stream);
    setViewerState('connecting');
    setViewerCount(stream.viewer_count || 0);
    setComments([]);
    setPinnedComment(null);
    setIsGuest(false);
    setGuestRequestPending(false);

    // Load recent comments
    try {
      const { data } = await api.get(`/streams/${streamId}/comments`);
      if (Array.isArray(data)) {
        setComments(data);
      }
    } catch {}

    try {
      await api.post(`/streams/${streamId}/join`);
      socket?.emit('stream:viewer-join', { streamId });
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Could not join stream.');
      setWatchingStream(null);
      setViewerState('idle');
    }
  };

  const cleanupViewer = () => {
    if (viewerPeerConnectionRef.current) {
      viewerPeerConnectionRef.current.close();
      viewerPeerConnectionRef.current = null;
    }
    if (guestStreamRef.current) {
      guestStreamRef.current.getTracks().forEach(t => t.stop());
      guestStreamRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    setIsGuest(false);
    setGuestRequestPending(false);
  };

  const leaveStream = async () => {
    if (!watchingStream) return;
    const streamId = watchingStream.stream_id || watchingStream.id;
    try {
      socket?.emit('stream:viewer-leave', { streamId });
      await api.post(`/streams/${streamId}/leave`);
    } catch {}
    cleanupViewer();
    setWatchingStream(null);
    setViewerState('idle');
  };

  // ── 10. Engagement Actions ──────────────────────────────────────────────────
  const sendComment = (overrideText?: string) => {
    const content = (overrideText || newCommentText).trim();
    if (!content) return;

    const streamId = currentStreamId || watchingStream?.stream_id || watchingStream?.id;
    if (!streamId) return;

    socket?.emit('stream:comment', {
      streamId,
      content,
      user: {
        username: user?.username || 'user',
        name: user?.name || user?.username || 'User',
        avatar_url: user?.avatar_url || user?.profile_image,
        isHost: isBroadcasting,
        isGuest: isGuest,
      }
    });

    setNewCommentText('');
  };

  const sendLike = () => {
    const streamId = currentStreamId || watchingStream?.stream_id || watchingStream?.id;
    if (!streamId) return;

    socket?.emit('stream:like', { streamId, count: 1 });
    window.dispatchEvent(new CustomEvent('spawn-tiktok-heart', {
      detail: {
        x: window.innerWidth - 70,
        y: window.innerHeight - 180,
        pattern: 'burst'
      }
    }));
  };

  const handleSendGift = async () => {
    const streamId = currentStreamId || watchingStream?.stream_id || watchingStream?.id;
    if (!streamId || !selectedGift) return;

    if (userCoinsBalance < selectedGift.coins) {
      showError(`Insufficient Sparkle Coins! You need ${selectedGift.coins} coins.`);
      return;
    }

    setSendingGift(true);
    try {
      await api.post(`/streams/${streamId}/gift`, {
        giftName: selectedGift.name,
        coins: selectedGift.coins,
        icon: selectedGift.icon,
      });

      setUserCoinsBalance(prev => Math.max(0, prev - selectedGift.coins));
      setShowGiftsDrawer(false);
      showSuccess(`Sent ${selectedGift.name}!`);

      socket?.emit('stream:gift', {
        streamId,
        giftName: selectedGift.name,
        coins: selectedGift.coins,
        icon: selectedGift.icon,
        sender: {
          username: user?.username || 'Supporter',
          name: user?.name || user?.username || 'Supporter',
          avatar_url: user?.avatar_url || user?.profile_image
        }
      });
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Failed to send gift.');
    } finally {
      setSendingGift(false);
    }
  };

  // ── 11. Multi-Guest Actions ─────────────────────────────────────────────────
  const requestToJoinAsGuest = () => {
    const streamId = watchingStream?.stream_id || watchingStream?.id;
    if (!streamId) return;

    socket?.emit('stream:guest-request', {
      streamId,
      user: {
        username: user?.username || 'Viewer',
        name: user?.name || user?.username,
        avatar_url: user?.avatar_url || user?.profile_image,
      }
    });
    setGuestRequestPending(true);
    showInfo('Request sent to the host!');
  };

  const acceptGuestRequest = (req: GuestRequest) => {
    if (!currentStreamId) return;
    socket?.emit('stream:guest-accept', {
      streamId: currentStreamId,
      guestSocketId: req.guestSocketId,
      guestUserId: req.guestUserId,
    });
    setActiveGuest({
      socketId: req.guestSocketId,
      userId: req.guestUserId,
      username: req.user.username,
    });
    setGuestRequests(prev => prev.filter(r => r.guestSocketId !== req.guestSocketId));
    setShowGuestManagerDrawer(false);
    showSuccess(`Accepted ${req.user.username} as guest!`);
  };

  const declineGuestRequest = (req: GuestRequest) => {
    if (!currentStreamId) return;
    socket?.emit('stream:guest-decline', {
      streamId: currentStreamId,
      guestSocketId: req.guestSocketId,
    });
    setGuestRequests(prev => prev.filter(r => r.guestSocketId !== req.guestSocketId));
  };

  const removeActiveGuest = () => {
    if (!currentStreamId || !activeGuest) return;
    socket?.emit('stream:guest-remove', {
      streamId: currentStreamId,
      guestSocketId: activeGuest.socketId,
      guestUserId: activeGuest.userId,
    });
    setActiveGuest(null);
    showInfo('Guest was removed.');
  };

  // ── 12. Moderation Actions ──────────────────────────────────────────────────
  const pinCommentAction = (comment: StreamComment) => {
    const streamId = currentStreamId || watchingStream?.stream_id || watchingStream?.id;
    if (!streamId) return;
    socket?.emit('stream:pin-comment', { streamId, comment });
    setSelectedCommentForMod(null);
    showSuccess('Comment pinned!');
  };

  const deleteCommentAction = (commentId: string) => {
    const streamId = currentStreamId || watchingStream?.stream_id || watchingStream?.id;
    if (!streamId) return;
    socket?.emit('stream:delete-comment', { streamId, commentId });
    setSelectedCommentForMod(null);
    showSuccess('Comment deleted');
  };

  const muteUserAction = (targetUserId: string) => {
    const streamId = currentStreamId || watchingStream?.stream_id || watchingStream?.id;
    if (!streamId) return;
    socket?.emit('stream:mute-user', { streamId, targetUserId, durationMinutes: 15 });
    setSelectedCommentForMod(null);
    showSuccess('User muted for 15 minutes.');
  };

  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const audioTracks = localStreamRef.current.getAudioTracks();
    audioTracks.forEach(t => { t.enabled = !t.enabled; });
    setMicOn(prev => !prev);
  };

  const toggleCam = () => {
    if (!localStreamRef.current) return;
    const videoTracks = localStreamRef.current.getVideoTracks();
    videoTracks.forEach(t => { t.enabled = !t.enabled; });
    setCamOn(prev => !prev);
  };

  // Share Stream
  const shareStream = async () => {
    const activeStream = watchingStream || { title: liveTitle, stream_id: currentStreamId };
    const url = `${window.location.origin}/streams?streamId=${activeStream.stream_id || (activeStream as any).id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Watch ${activeStream.title} on Sparkle LIVE`,
          url,
        });
      } catch {}
    } else {
      navigator.clipboard.writeText(url);
      showSuccess('Live stream link copied to clipboard!');
    }
  };

  // Filtered streams list
  const filteredStreams = streams.filter(s => {
    const matchCat = selectedCategory === 'all' || (s.category || 'general').toLowerCase() === selectedCategory.toLowerCase();
    const matchSearch = !searchQuery.trim() ||
      s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.username?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: LOADING STATE
  // ═══════════════════════════════════════════════════════════════════════════
  if (loading && streams.length === 0) {
    return (
      <div className="min-h-dvh bg-[#0a0a0f] flex flex-col items-center justify-center text-white">
        <Spinner size="large" color="text-[#ff1493]" />
        <p className="text-xs font-bold uppercase tracking-widest text-[#ff1493] mt-4 animate-pulse">
          Loading Sparkle LIVE...
        </p>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: VIEWER VIEW (Full Screen TikTok-LIVE Experience)
  // ═══════════════════════════════════════════════════════════════════════════
  if (watchingStream) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0f] text-white flex flex-col z-50 overflow-hidden font-sans select-none">
        <TikTokHearts />

        {/* Video Surface & Tap Handler */}
        <div
          className="relative flex-1 bg-black flex items-center justify-center overflow-hidden"
          onClick={(e) => {
            // Only trigger like if tapped directly on background or video
            if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'VIDEO') {
              sendLike();
            }
          }}
        >
          {/* Main Broadcaster Video */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Guest Video Tile (Split Screen PiP if Guest is active) */}
          {isGuest && (
            <div className="absolute top-20 right-4 w-32 h-44 rounded-2xl overflow-hidden border-2 border-[#ff1493] shadow-2xl bg-zinc-900 z-20">
              <video
                ref={guestVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1 left-2 right-2 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-bold text-center text-white truncate">
                You (Guest)
              </div>
            </div>
          )}

          {/* Connection State Overlays */}
          {viewerState === 'connecting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 z-30">
              <Spinner size="large" color="text-[#ff1493]" />
              <p className="text-sm font-semibold text-white/90">Connecting to live feed...</p>
            </div>
          )}

          {viewerState === 'ended' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0a0a0f] z-30 p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                <Radio size={36} className="text-[#ff1493]" />
              </div>
              <div>
                <p className="text-xl font-black text-white">Stream Ended</p>
                <p className="text-xs text-white/50 mt-1">The host has ended this live broadcast.</p>
              </div>
              <button
                onClick={() => { cleanupViewer(); setWatchingStream(null); setViewerState('idle'); loadStreams(); }}
                className="px-6 py-3 rounded-full bg-[#ff1493] hover:bg-[#ff2d87] text-white font-bold text-sm transition-colors active:scale-95"
              >
                Back to Streams
              </button>
            </div>
          )}

          {viewerState === 'failed' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0a0a0f] z-30 p-6 text-center">
              <WifiOff size={44} className="text-red-400" />
              <div>
                <p className="text-lg font-bold text-white">Connection Interrupted</p>
                <p className="text-xs text-white/50 mt-1 max-w-xs">Direct WebRTC video link could not be maintained.</p>
              </div>
              <button
                onClick={() => { cleanupViewer(); setWatchingStream(null); setViewerState('idle'); }}
                className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-colors"
              >
                Exit Stream
              </button>
            </div>
          )}

          {/* Big Animated Gift Toast Celebration Overlay */}
          {recentGiftAnnouncement && (
            <div className="absolute top-24 inset-x-4 z-40 flex justify-center animate-bounce">
              <div className="bg-[#141420]/95 border-2 border-[#ff1493] px-5 py-3 rounded-full flex items-center gap-3 shadow-2xl backdrop-blur-md">
                <span className="text-3xl">{recentGiftAnnouncement.icon}</span>
                <div>
                  <p className="text-xs font-black text-[#ff1493] uppercase tracking-wider">
                    {recentGiftAnnouncement.senderName} sent a {recentGiftAnnouncement.giftName}!
                  </p>
                  <p className="text-[10px] font-bold text-white/70">
                    +{recentGiftAnnouncement.coins} Sparkle Coins
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TOP BAR: Host Info, Live Badge, Viewer Count, Likes, Close */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-30 pt-[var(--safe-area-inset-top,0px)]">
            {/* Host pill */}
            <div className="flex items-center gap-2 bg-black/50 backdrop-blur-md border border-white/10 rounded-full pl-1 pr-3 py-1">
              <img
                src={watchingStream.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(watchingStream.username)}&background=ff1493&color=fff`}
                className="w-8 h-8 rounded-full object-cover border border-[#ff1493]"
                alt=""
              />
              <div className="min-w-0 pr-1">
                <p className="text-xs font-bold text-white truncate max-w-[110px]">@{watchingStream.username}</p>
                <p className="text-[9px] text-[#ff1493] font-black uppercase tracking-wider">Host</p>
              </div>
            </div>

            {/* Right badges & controls */}
            <div className="flex items-center gap-2">
              <span className="bg-[#ff1493] text-white px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-1 shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
              <span className="bg-black/50 backdrop-blur-md border border-white/10 text-white px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1">
                <Eye size={12} className="text-[#ff1493]" />
                {viewerCount}
              </span>
              <button
                onClick={shareStream}
                className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:text-[#ff1493] transition-colors"
                title="Share"
              >
                <Share2 size={14} />
              </button>
              <button
                onClick={leaveStream}
                className="w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:text-red-400 transition-colors"
                title="Leave"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* OVERLAID CHAT COMMENTS (TikTok Style Bottom-Left) */}
          <div className="absolute bottom-20 left-4 right-16 max-h-[260px] overflow-y-auto no-scrollbar flex flex-col gap-1.5 z-20 pointer-events-auto">
            {/* Pinned Comment Banner */}
            {pinnedComment && (
              <div className="bg-[#141420]/90 border border-[#ff1493]/60 rounded-xl px-3 py-2 backdrop-blur-md flex items-start gap-2 max-w-sm mb-1 shadow-lg">
                <Pin size={14} className="text-[#ff1493] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-black text-[#ff1493] uppercase tracking-wider">Pinned Comment</span>
                    <span className="text-[10px] font-bold text-white/50">@{pinnedComment.username}</span>
                  </div>
                  <p className="text-xs text-white font-medium break-words mt-0.5">{pinnedComment.content}</p>
                </div>
              </div>
            )}

            {/* Comment Items */}
            {comments.slice(-40).map(c => (
              <div
                key={c.id}
                onClick={() => setSelectedCommentForMod(c)}
                className="bg-black/45 backdrop-blur-md rounded-2xl px-3 py-1.5 self-start max-w-[85%] text-left border border-white/5 hover:border-white/20 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-white/70">@{c.username}</span>
                  {c.isHost && (
                    <span className="bg-[#ff1493] text-white px-1.5 py-0.2 rounded text-[8px] font-black uppercase">Host</span>
                  )}
                  {c.isGuest && (
                    <span className="bg-cyan-500 text-black px-1.5 py-0.2 rounded text-[8px] font-black uppercase">Guest</span>
                  )}
                  {c.isModerator && (
                    <span className="bg-emerald-500 text-black px-1.5 py-0.2 rounded text-[8px] font-black uppercase">Mod</span>
                  )}
                  <span className="text-xs text-white font-normal break-words">{c.content}</span>
                </div>
              </div>
            ))}
            <div ref={commentsEndRef} />
          </div>

          {/* Quick Emoji Bar (Above Bottom Bar) */}
          <div className="absolute bottom-14 left-4 flex items-center gap-2 z-20">
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                onClick={() => sendComment(emoji)}
                className="w-7 h-7 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center text-sm hover:scale-125 active:scale-95 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>

          {/* BOTTOM BAR: Input Field, Gift Drawer Button, Like Button, Guest Button */}
          <div className="absolute bottom-2 left-3 right-3 flex items-center gap-2 z-30 pb-[var(--safe-area-inset-bottom,0px)]">
            <div className="flex-1 bg-black/60 backdrop-blur-md border border-white/15 rounded-full flex items-center px-3 py-1.5">
              <input
                value={newCommentText}
                onChange={e => setNewCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendComment(); }}
                placeholder="Add a comment..."
                className="flex-1 bg-transparent text-xs text-white placeholder-white/40 outline-none"
              />
              {newCommentText.trim() && (
                <button onClick={() => sendComment()} className="text-[#ff1493] p-1 active:scale-90">
                  <Send size={14} />
                </button>
              )}
            </div>

            {/* Request Guest Button */}
            {!isGuest && (
              <button
                onClick={requestToJoinAsGuest}
                disabled={guestRequestPending}
                className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
                  guestRequestPending
                    ? 'bg-white/10 border-white/20 text-white/50'
                    : 'bg-black/60 backdrop-blur-md border-white/15 text-white hover:text-[#ff1493]'
                }`}
                title={guestRequestPending ? 'Guest Request Pending' : 'Request to join as Guest'}
              >
                <Users size={16} />
              </button>
            )}

            {/* Gift Button */}
            <button
              onClick={() => setShowGiftsDrawer(true)}
              className="w-10 h-10 rounded-full bg-[#ff1493] text-white flex items-center justify-center shadow-lg shadow-[#ff1493]/30 active:scale-95 transition-transform"
              title="Send Gift"
            >
              <Gift size={18} />
            </button>

            {/* Floating Like Button */}
            <button
              onClick={sendLike}
              className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[#ff1493] flex items-center justify-center active:scale-125 transition-transform"
              title="Like"
            >
              <Heart size={20} fill="#ff1493" />
            </button>
          </div>
        </div>

        {/* ── GIFTS DRAWER SHEET ── */}
        {showGiftsDrawer && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center p-0">
            <div className="bg-[#141420] border-t border-white/10 rounded-t-3xl w-full max-w-lg p-5 space-y-4 animate-in slide-in-from-bottom duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    Sparkle Live Gifts <Sparkles size={16} className="text-[#ff1493]" />
                  </h3>
                  <p className="text-[11px] text-white/50">Support the creator with real-time gifts</p>
                </div>
                <button
                  onClick={() => setShowGiftsDrawer(false)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Wallet Balance Strip */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#ff1493]/20 flex items-center justify-center text-[#ff1493] font-bold text-xs">
                    🪙
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase font-bold tracking-wider">Your Balance</p>
                    <p className="text-sm font-black text-white">{userCoinsBalance.toLocaleString()} Coins</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/wallet')}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors"
                >
                  Top Up
                </button>
              </div>

              {/* Gifts Grid */}
              <div className="grid grid-cols-4 gap-2.5">
                {GIFT_CATALOG.map(gift => {
                  const isSelected = selectedGift.id === gift.id;
                  return (
                    <button
                      key={gift.id}
                      onClick={() => setSelectedGift(gift)}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
                        isSelected
                          ? 'bg-[#ff1493]/15 border-[#ff1493] scale-105'
                          : 'bg-white/5 border-white/5 hover:border-white/15'
                      }`}
                    >
                      <span className="text-2xl mb-1">{gift.icon}</span>
                      <span className="text-[11px] font-bold text-white truncate w-full text-center">{gift.name}</span>
                      <span className="text-[10px] font-black text-[#ff1493]">{gift.coins} Coins</span>
                    </button>
                  );
                })}
              </div>

              {/* Send Button */}
              <button
                onClick={handleSendGift}
                disabled={sendingGift || userCoinsBalance < selectedGift.coins}
                className="w-full py-3.5 rounded-2xl bg-[#ff1493] hover:bg-[#ff2d87] disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#ff1493]/20 active:scale-95 transition-all"
              >
                {sendingGift ? (
                  <Spinner size="small" />
                ) : (
                  <>Send {selectedGift.name} ({selectedGift.coins} Coins)</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── COMMENT MODERATION MODAL ── */}
        {selectedCommentForMod && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-[#141420] border border-white/10 rounded-2xl p-5 w-full max-w-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/50">Comment by @{selectedCommentForMod.username}</span>
                <button onClick={() => setSelectedCommentForMod(null)} className="text-white/60 hover:text-white">
                  <X size={16} />
                </button>
              </div>
              <p className="text-sm font-semibold text-white bg-white/5 p-3 rounded-xl break-words">
                "{selectedCommentForMod.content}"
              </p>
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => pinCommentAction(selectedCommentForMod)}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2"
                >
                  <Pin size={14} className="text-[#ff1493]" />
                  Pin Comment
                </button>
                <button
                  onClick={() => deleteCommentAction(selectedCommentForMod.id)}
                  className="w-full py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold text-xs flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} />
                  Delete Comment
                </button>
                <button
                  onClick={() => muteUserAction(selectedCommentForMod.userId)}
                  className="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center gap-2"
                >
                  <VolumeX size={14} />
                  Mute User (15m)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: BROADCASTER VIEW (Active Live Stream Dashboard)
  // ═══════════════════════════════════════════════════════════════════════════
  if (isBroadcasting) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0f] text-white flex flex-col z-50 overflow-hidden font-sans select-none">
        <TikTokHearts />

        {/* Video Surface */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />

          {!camOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 gap-2 z-10">
              <VideoOff size={48} className="text-white/30" />
              <p className="text-xs text-white/50">Camera is turned off</p>
            </div>
          )}

          {/* Active Guest Video Tile (PiP) */}
          {activeGuest && (
            <div className="absolute top-20 right-4 w-32 h-44 rounded-2xl overflow-hidden border-2 border-[#ff1493] shadow-2xl bg-zinc-900 z-20">
              <video
                ref={guestVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-1 left-2 right-2 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-bold text-center text-white truncate">
                @{activeGuest.username}
              </div>
            </div>
          )}

          {/* Big Animated Gift Toast Celebration Overlay */}
          {recentGiftAnnouncement && (
            <div className="absolute top-24 inset-x-4 z-40 flex justify-center animate-bounce">
              <div className="bg-[#141420]/95 border-2 border-[#ff1493] px-5 py-3 rounded-full flex items-center gap-3 shadow-2xl backdrop-blur-md">
                <span className="text-3xl">{recentGiftAnnouncement.icon}</span>
                <div>
                  <p className="text-xs font-black text-[#ff1493] uppercase tracking-wider">
                    {recentGiftAnnouncement.senderName} sent a {recentGiftAnnouncement.giftName}!
                  </p>
                  <p className="text-[10px] font-bold text-white/70">
                    +{recentGiftAnnouncement.coins} Coins
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TOP BAR: Duration, Viewers, Coins, Settings */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-30 pt-[var(--safe-area-inset-top,0px)]">
            <div className="flex items-center gap-2">
              <span className="bg-[#ff1493] text-white px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
              <span className="bg-black/60 backdrop-blur-md border border-white/10 text-white px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5">
                <Clock size={11} />
                {broadcastDuration}
              </span>
              <span className="bg-black/60 backdrop-blur-md border border-white/10 text-white px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5">
                <Eye size={12} className="text-[#ff1493]" />
                {broadcastViewerCount}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="bg-black/60 backdrop-blur-md border border-white/10 text-[#ff1493] px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1">
                🪙 {totalCoinsEarned} Coins
              </span>
              <button
                onClick={() => setShowSettingsDrawer(true)}
                className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white"
                title="Settings"
              >
                <Settings size={14} />
              </button>
            </div>
          </div>

          {/* OVERLAID CHAT COMMENTS (TikTok Style Bottom-Left) */}
          <div className="absolute bottom-24 left-4 right-20 max-h-[260px] overflow-y-auto no-scrollbar flex flex-col gap-1.5 z-20 pointer-events-auto">
            {/* Pinned Comment Banner */}
            {pinnedComment && (
              <div className="bg-[#141420]/90 border border-[#ff1493]/60 rounded-xl px-3 py-2 backdrop-blur-md flex items-start gap-2 max-w-sm mb-1 shadow-lg">
                <Pin size={14} className="text-[#ff1493] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-black text-[#ff1493] uppercase tracking-wider">Pinned Comment</span>
                    <span className="text-[10px] font-bold text-white/50">@{pinnedComment.username}</span>
                  </div>
                  <p className="text-xs text-white font-medium break-words mt-0.5">{pinnedComment.content}</p>
                </div>
              </div>
            )}

            {/* Comment Items */}
            {comments.slice(-40).map(c => (
              <div
                key={c.id}
                onClick={() => setSelectedCommentForMod(c)}
                className="bg-black/45 backdrop-blur-md rounded-2xl px-3 py-1.5 self-start max-w-[85%] text-left border border-white/5 hover:border-white/20 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-white/70">@{c.username}</span>
                  {c.isHost && (
                    <span className="bg-[#ff1493] text-white px-1.5 py-0.2 rounded text-[8px] font-black uppercase">Host</span>
                  )}
                  {c.isGuest && (
                    <span className="bg-cyan-500 text-black px-1.5 py-0.2 rounded text-[8px] font-black uppercase">Guest</span>
                  )}
                  <span className="text-xs text-white font-normal break-words">{c.content}</span>
                </div>
              </div>
            ))}
            <div ref={commentsEndRef} />
          </div>

          {/* BOTTOM CONTROLS BAR: Flip Cam, Mic, End Live, Guests, Cam Off */}
          <div className="absolute bottom-4 left-4 right-4 z-30 pb-[var(--safe-area-inset-bottom,0px)]">
            <div className="bg-[#141420]/90 backdrop-blur-md border border-white/10 rounded-3xl p-3 flex items-center justify-around max-w-md mx-auto shadow-2xl">
              {/* Flip Camera */}
              <button
                onClick={flipCamera}
                className="flex flex-col items-center gap-1 text-white/80 hover:text-white"
                title="Flip Camera"
              >
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <Camera size={18} />
                </div>
                <span className="text-[9px] font-bold">Flip</span>
              </button>

              {/* Toggle Mic */}
              <button
                onClick={toggleMic}
                className={`flex flex-col items-center gap-1 ${micOn ? 'text-white/80 hover:text-white' : 'text-red-400'}`}
                title="Toggle Mic"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${micOn ? 'bg-white/10' : 'bg-red-500/20'}`}>
                  {micOn ? <Mic size={18} /> : <MicOff size={18} />}
                </div>
                <span className="text-[9px] font-bold">{micOn ? 'Mute' : 'Unmuted'}</span>
              </button>

              {/* End Live Button */}
              <button
                onClick={() => setShowEndConfirmModal(true)}
                className="flex flex-col items-center gap-1 text-red-500 hover:text-red-400 active:scale-95 transition-transform"
                title="End Live"
              >
                <div className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-500/30">
                  <PhoneOff size={22} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-red-400">End</span>
              </button>

              {/* Guest Management */}
              <button
                onClick={() => setShowGuestManagerDrawer(true)}
                className="relative flex flex-col items-center gap-1 text-white/80 hover:text-white"
                title="Guests"
              >
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <Users size={18} />
                </div>
                {guestRequests.length > 0 && (
                  <span className="absolute -top-1 right-1 w-4 h-4 rounded-full bg-[#ff1493] text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                    {guestRequests.length}
                  </span>
                )}
                <span className="text-[9px] font-bold">Guests</span>
              </button>

              {/* Toggle Cam */}
              <button
                onClick={toggleCam}
                className={`flex flex-col items-center gap-1 ${camOn ? 'text-white/80 hover:text-white' : 'text-red-400'}`}
                title="Toggle Video"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${camOn ? 'bg-white/10' : 'bg-red-500/20'}`}>
                  {camOn ? <Video size={18} /> : <VideoOff size={18} />}
                </div>
                <span className="text-[9px] font-bold">{camOn ? 'Cam Off' : 'Cam On'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── GUEST MANAGEMENT DRAWER ── */}
        {showGuestManagerDrawer && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center p-0">
            <div className="bg-[#141420] border-t border-white/10 rounded-t-3xl w-full max-w-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  Live Guest Management <Users size={18} className="text-[#ff1493]" />
                </h3>
                <button onClick={() => setShowGuestManagerDrawer(false)} className="text-white/60 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              {/* Active Guest Section */}
              {activeGuest && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest">Active Co-Host</span>
                    <p className="text-sm font-bold text-white">@{activeGuest.username}</p>
                  </div>
                  <button
                    onClick={removeActiveGuest}
                    className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold"
                  >
                    Remove Guest
                  </button>
                </div>
              )}

              {/* Pending Requests List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-white/50 uppercase tracking-wider">
                  Pending Join Requests ({guestRequests.length})
                </span>
                {guestRequests.length === 0 ? (
                  <p className="text-xs text-white/40 py-4 text-center">No pending guest requests.</p>
                ) : (
                  guestRequests.map(req => (
                    <div key={req.guestSocketId} className="bg-white/5 border border-white/5 rounded-2xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={req.user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.user.username)}&background=ff1493&color=fff`}
                          className="w-9 h-9 rounded-full object-cover border border-[#ff1493]"
                          alt=""
                        />
                        <span className="text-sm font-bold text-white">@{req.user.username}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => declineGuestRequest(req)}
                          className="px-3 py-1.5 rounded-xl bg-white/10 text-white/60 hover:text-white text-xs font-bold"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => acceptGuestRequest(req)}
                          className="px-3 py-1.5 rounded-xl bg-[#ff1493] text-white text-xs font-bold flex items-center gap-1 shadow-md"
                        >
                          <Check size={12} /> Accept
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── BROADCAST SETTINGS DRAWER ── */}
        {showSettingsDrawer && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end justify-center p-0">
            <div className="bg-[#141420] border-t border-white/10 rounded-t-3xl w-full max-w-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  Broadcast Settings <Settings size={18} className="text-[#ff1493]" />
                </h3>
                <button onClick={() => setShowSettingsDrawer(false)} className="text-white/60 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-3 pt-2">
                <label className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 cursor-pointer">
                  <div>
                    <p className="text-sm font-bold text-white">Allow Live Comments</p>
                    <p className="text-[11px] text-white/40">Viewers can send live comments in chat</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowComments}
                    onChange={e => setAllowComments(e.target.checked)}
                    className="w-5 h-5 accent-[#ff1493]"
                  />
                </label>
                <label className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 cursor-pointer">
                  <div>
                    <p className="text-sm font-bold text-white">Allow Guest Requests</p>
                    <p className="text-[11px] text-white/40">Viewers can request to co-host as guests</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowGuestRequests}
                    onChange={e => setAllowGuestRequests(e.target.checked)}
                    className="w-5 h-5 accent-[#ff1493]"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* ── END LIVE CONFIRMATION MODAL ── */}
        {showEndConfirmModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#141420] border border-white/10 rounded-3xl p-6 w-full max-w-sm text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mx-auto">
                <PhoneOff size={28} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">End Broadcast?</h3>
                <p className="text-xs text-white/50 mt-1">
                  Are you sure you want to end this live stream session? Your viewers will be notified.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowEndConfirmModal(false)}
                  className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/15"
                >
                  Cancel
                </button>
                <button
                  onClick={endBroadcast}
                  className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs shadow-lg shadow-red-500/30"
                >
                  End Stream
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── COMMENT MODERATION MODAL (FOR HOST) ── */}
        {selectedCommentForMod && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-[#141420] border border-white/10 rounded-2xl p-5 w-full max-w-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white/50">Comment by @{selectedCommentForMod.username}</span>
                <button onClick={() => setSelectedCommentForMod(null)} className="text-white/60 hover:text-white">
                  <X size={16} />
                </button>
              </div>
              <p className="text-sm font-semibold text-white bg-white/5 p-3 rounded-xl break-words">
                "{selectedCommentForMod.content}"
              </p>
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => pinCommentAction(selectedCommentForMod)}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs flex items-center justify-center gap-2"
                >
                  <Pin size={14} className="text-[#ff1493]" />
                  Pin Comment
                </button>
                <button
                  onClick={() => deleteCommentAction(selectedCommentForMod.id)}
                  className="w-full py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold text-xs flex items-center justify-center gap-2"
                >
                  <Trash2 size={14} />
                  Delete Comment
                </button>
                <button
                  onClick={() => muteUserAction(selectedCommentForMod.userId)}
                  className="w-full py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-bold text-xs flex items-center justify-center gap-2"
                >
                  <VolumeX size={14} />
                  Mute User (15m)
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: POST-LIVE SUMMARY MODAL
  // ═══════════════════════════════════════════════════════════════════════════
  if (showSummaryModal && summaryStats) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-6 z-50">
        <div className="bg-[#141420] border border-white/10 rounded-3xl p-6 sm:p-8 w-full max-w-md text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-[#ff1493]/20 flex items-center justify-center text-[#ff1493] mx-auto">
            <Award size={36} />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Broadcast Ended</h2>
            <p className="text-xs text-white/50 mt-1">Here is how your Sparkle LIVE broadcast performed!</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 text-left">
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Duration</span>
              <p className="text-xl font-black text-white mt-0.5">{summaryStats.duration}</p>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Peak Viewers</span>
              <p className="text-xl font-black text-white mt-0.5">{summaryStats.peakViewers.toLocaleString()}</p>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Total Likes</span>
              <p className="text-xl font-black text-[#ff1493] mt-0.5">{summaryStats.totalLikes.toLocaleString()}</p>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Coins Earned</span>
              <p className="text-xl font-black text-amber-400 mt-0.5">🪙 {summaryStats.totalCoins.toLocaleString()}</p>
            </div>
          </div>

          <button
            onClick={() => { setShowSummaryModal(false); setSummaryStats(null); }}
            className="w-full py-3.5 rounded-2xl bg-[#ff1493] hover:bg-[#ff2d87] text-white font-bold text-sm shadow-lg shadow-[#ff1493]/30 active:scale-95 transition-all"
          >
            Back to Streams
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: MAIN STREAMS DISCOVERY & LISTING
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-dvh bg-[#0a0a0f] text-white overflow-hidden relative pb-28 font-sans pt-[var(--safe-area-inset-top,0px)]">
      {/* Top Navigation Bar */}
      <div className="sticky top-[var(--safe-area-inset-top,0px)] z-40 bg-[#0a0a0f]/95 backdrop-blur-md border-b border-white/5 px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
          </button>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight" style={{ fontFamily: 'Outfit' }}>
              Sparkle <span className="text-[#ff1493]">LIVE</span>
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1 text-[9px] font-black text-[#ff1493] uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff1493] animate-pulse" />
                On Air
              </span>
              <span className="bg-white/5 border border-white/10 px-2 py-0.2 rounded-full text-[9px] font-bold text-white/50">
                {streams.length} live
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadStreams}
            className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>

          {/* Go Live Button */}
          <button
            onClick={() => {
              if (isEligibleToGoLive) {
                setGoLiveOpen(true);
              } else {
                setShowLockedModal(true);
              }
            }}
            className="bg-[#ff1493] hover:bg-[#ff2d87] text-white px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-[#ff1493]/20 active:scale-95 transition-all"
          >
            <Video size={14} />
            <span>Go Live</span>
          </button>
        </div>
      </div>

      {/* Categories & Search Filter Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search active streams or creators..."
            className="w-full bg-[#141420] border border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-medium text-white placeholder-white/40 outline-none focus:border-[#ff1493] transition-colors"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {CATEGORIES.map(cat => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-[#ff1493] text-white shadow-md shadow-[#ff1493]/30'
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/5'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content: Live Streams Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 space-y-6">
        {filteredStreams.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredStreams.map(stream => {
              const streamId = stream.stream_id || stream.id;
              return (
                <div
                  key={streamId}
                  className="bg-[#141420] border border-white/5 rounded-2xl overflow-hidden flex flex-col hover:border-[#ff1493]/50 transition-all duration-300 cursor-pointer group shadow-lg"
                  onClick={() => joinStream(stream)}
                >
                  {/* Thumbnail / Preview Surface */}
                  <div className="relative h-44 overflow-hidden bg-zinc-900 flex items-center justify-center">
                    {stream.thumbnail_url ? (
                      <img
                        src={stream.thumbnail_url}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        alt={stream.title}
                      />
                    ) : (
                      <Radio size={40} className="text-white/10 group-hover:text-[#ff1493]/40 transition-colors" />
                    )}

                    {/* LIVE Badge */}
                    <div className="absolute top-2.5 left-2.5 bg-[#ff1493] text-white px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase flex items-center gap-1 shadow-md">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      LIVE
                    </div>

                    {/* Viewer Count */}
                    <div className="absolute top-2.5 right-2.5 bg-black/70 backdrop-blur-md text-white px-2 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 border border-white/10">
                      <Eye size={10} className="text-[#ff1493]" />
                      {(stream.viewer_count ?? 0).toLocaleString()}
                    </div>
                  </div>

                  {/* Info Area */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between">
                    <div className="flex items-center gap-2.5 mb-2">
                      <img
                        src={stream.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(stream.username || 'User')}&background=ff1493&color=fff`}
                        className="w-8 h-8 rounded-full object-cover border-2 border-[#ff1493]/50"
                        alt=""
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-white text-xs truncate leading-snug">{stream.title}</h3>
                        <p className="text-[10px] text-white/50 truncate">@{stream.username}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-[8px] font-black text-[#ff1493] bg-[#ff1493]/10 px-2 py-0.5 rounded uppercase tracking-wider">
                        {stream.category || 'general'}
                      </span>
                      <span className="text-[9px] font-bold text-white/40 uppercase flex items-center gap-1 group-hover:text-white transition-colors">
                        Tune In <Video size={10} className="text-[#ff1493]" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-red-500/5 border border-red-500/10 rounded-3xl">
            <AlertCircle size={44} className="text-red-400 mb-3" />
            <h4 className="text-base font-bold text-white mb-1">Couldn't load live streams</h4>
            <p className="text-white/45 text-xs max-w-sm leading-relaxed mb-4">
              Unable to reach the live streams server. Check your connection and try again.
            </p>
            <button
              onClick={loadStreams}
              className="px-5 py-2 rounded-full bg-[#ff1493] hover:bg-[#ff2d87] text-white text-xs font-bold transition-colors"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center bg-[#141420] border border-white/5 border-dashed rounded-3xl">
            <Radio size={48} className="text-white/20 mb-3 animate-pulse" />
            <h4 className="text-base font-bold text-white mb-1">No active live streams</h4>
            <p className="text-white/45 text-xs max-w-sm leading-relaxed">
              No one is broadcasting right now. Be the first to start a stream and share live moments with your campus!
            </p>
          </div>
        )}
      </div>

      {/* ── GO LIVE COMPOSER MODAL ── */}
      {goLiveOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#141420] border border-white/10 rounded-3xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                Start Live Broadcast <Sparkles size={16} className="text-[#ff1493]" />
              </h3>
              <button
                onClick={() => setGoLiveOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-white/50">
              Your camera and microphone will start broadcasting real-time video to your followers.
            </p>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">Stream Title</label>
              <input
                autoFocus
                value={liveTitle}
                onChange={e => setLiveTitle(e.target.value)}
                placeholder="What are you live about?"
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm font-medium text-white placeholder-white/40 outline-none focus:border-[#ff1493] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-white/60 mb-1.5">Category</label>
              <select
                value={liveCategory}
                onChange={e => setLiveCategory(e.target.value)}
                className="w-full bg-[#181824] border border-white/10 rounded-xl py-3 px-4 text-sm text-white outline-none focus:border-[#ff1493]"
              >
                <option value="general">General</option>
                <option value="study">Study / Academic</option>
                <option value="music">Music</option>
                <option value="gaming">Gaming</option>
                <option value="fitness">Fitness</option>
                <option value="art">Art & Creativity</option>
                <option value="talk">Campus Talk</option>
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setGoLiveOpen(false)}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white/60 hover:text-white bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={startBroadcast}
                disabled={broadcastState === 'connecting' || !liveTitle.trim()}
                className="flex-1 py-3 rounded-xl bg-[#ff1493] hover:bg-[#ff2d87] text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                {broadcastState === 'connecting' ? <Spinner size="small" /> : <><Video size={16} /> Go Live</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LOCKED LIVE MODAL (FOR USERS < 1,000 FOLLOWERS) ── */}
      {showLockedModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141420] border border-white/10 rounded-3xl p-6 w-full max-w-md space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-[#ff1493]/15 text-[#ff1493] flex items-center justify-center mx-auto">
              <Award size={28} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">Creator Live Access Locked</h3>
              <p className="text-xs text-white/50 mt-1 max-w-xs mx-auto">
                Broadcasting on Sparkle requires 1,000+ followers or an official creator exemption.
              </p>
            </div>
            {/* Progress Bar */}
            <div className="bg-white/5 rounded-2xl p-4 text-left border border-white/5">
              <div className="flex justify-between text-xs font-bold mb-2">
                <span className="text-white/60">Your Followers</span>
                <span className="text-[#ff1493]">{followers} / 1,000</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#ff1493] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.round((followers / 1000) * 100))}%` }}
                />
              </div>
              <p className="text-[10px] text-white/40 mt-2">
                Keep posting and engaging on Sparkle to unlock live broadcasting!
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowLockedModal(false)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/15"
              >
                Got It
              </button>
              <button
                onClick={() => { setShowLockedModal(false); navigate('/locked-live'); }}
                className="flex-1 py-3 rounded-xl bg-[#ff1493] hover:bg-[#ff2d87] text-white font-bold text-xs"
              >
                Learn More
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
