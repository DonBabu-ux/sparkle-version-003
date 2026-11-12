import { showInfo, showError, showSuccess } from '../utils/toast';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye, Video, ArrowLeft, Radio, Award, AlertCircle,
  Mic, MicOff, VideoOff, Users, Clock, WifiOff, X, PhoneOff
} from 'lucide-react';
import { useUserStore } from '../store/userStore';
import api from '../api/api';
import LockedLivePage from './LockedLivePage';
import Spinner from '../components/ui/Spinner';
import { useSocket } from '../hooks/useSocket';

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
  const user = useUserStore(state => state.user);
  const socket = useSocket();
  const [followers, setFollowers] = useState(() => user?.followers_count ?? 0);
  const [loading, setLoading] = useState(true);
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [loadError, setLoadError] = useState(false);

  // Broadcaster state
  const [goLiveOpen, setGoLiveOpen] = useState(false);
  const [liveTitle, setLiveTitle] = useState('');
  const [liveCategory, setLiveCategory] = useState('general');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastState, setBroadcastState] = useState<ConnectionState>('idle');
  const [currentStreamId, setCurrentStreamId] = useState<string | null>(null);
  const [broadcastViewerCount, setBroadcastViewerCount] = useState(0);
  const [broadcastDuration, setBroadcastDuration] = useState('0:00');
  const [broadcastStartTime, setBroadcastStartTime] = useState<number | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  // Viewer state
  const [watchingStream, setWatchingStream] = useState<LiveStream | null>(null);
  const [viewerState, setViewerState] = useState<ConnectionState>('idle');
  const [viewerCount, setViewerCount] = useState(0);

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const viewerPeerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Standard STUN servers configuration
  const iceConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ]
  };

  useEffect(() => {
    let cancelled = false;
    if (user?.followers_count !== undefined) {
      setFollowers(user.followers_count);
    } else {
      api.get('/users/me')
        .then(res => {
          if (!cancelled && res.data?.followers_count !== undefined) {
            setFollowers(res.data.followers_count);
          }
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [user?.followers_count]);

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

  // Duration tracker
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

  // WebRTC Signalling Handlers
  useEffect(() => {
    if (!socket) return;

    // --- Broadcaster handlers ---
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

    // --- Viewer handlers ---
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
      // If we are broadcaster:
      const pcBroadcaster = peerConnectionsRef.current.get(data.fromSocketId);
      if (pcBroadcaster) {
        try {
          await pcBroadcaster.addIceCandidate(new RTCIceCandidate(data.candidate));
          return;
        } catch (_) {}
      }
      // If we are viewer:
      if (viewerPeerConnectionRef.current) {
        try {
          await viewerPeerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
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

    socket.on('stream:viewer-joined', handleViewerJoined);
    socket.on('stream:answer', handleAnswerFromViewer);
    socket.on('stream:viewer-left', handleViewerLeft);
    socket.on('stream:offer', handleOfferFromBroadcaster);
    socket.on('stream:ice-candidate', handleIceCandidate);
    socket.on('stream:ended', handleStreamEnded);
    socket.on('stream:viewer-count', handleViewerCountUpdate);

    return () => {
      socket.off('stream:viewer-joined', handleViewerJoined);
      socket.off('stream:answer', handleAnswerFromViewer);
      socket.off('stream:viewer-left', handleViewerLeft);
      socket.off('stream:offer', handleOfferFromBroadcaster);
      socket.off('stream:ice-candidate', handleIceCandidate);
      socket.off('stream:ended', handleStreamEnded);
      socket.off('stream:viewer-count', handleViewerCountUpdate);
    };
  }, [socket, currentStreamId, watchingStream]);

  // Request camera and microphone access with descriptive permissions prompt
  const requestMediaPermissions = async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: true
      });
      return stream;
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        showError('Camera and microphone permissions were denied. Please enable them in your browser or device settings.');
      } else if (err.name === 'NotFoundError') {
        showError('No camera or microphone found on this device.');
      } else {
        showError('Could not start media capture: ' + (err.message || 'unknown error'));
      }
      return null;
    }
  };

  const startBroadcast = async () => {
    if (!liveTitle.trim()) {
      showError('Please enter a title for your stream.');
      return;
    }

    setBroadcastState('connecting');

    const stream = await requestMediaPermissions();
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
    setLiveTitle('');
    loadStreams();
    showInfo('Your live stream has ended.');
  };

  const joinStream = async (stream: LiveStream) => {
    const streamId = stream.stream_id || stream.id;
    if (!streamId) return;

    setWatchingStream(stream);
    setViewerState('connecting');
    setViewerCount(stream.viewer_count || 0);

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
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
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

  if (loading) {
    return (
      <div className="min-h-dvh bg-[#0a0a0f] flex flex-col items-center justify-center text-white">
        <Spinner size="large" color="text-primary" />
        <p className="text-xs font-bold uppercase tracking-widest text-[#ff1493] mt-4 animate-pulse">
          Loading live streams...
        </p>
      </div>
    );
  }

  const hasLiveAccess = followers >= 1000;

  if (!hasLiveAccess) {
    return <LockedLivePage />;
  }

  // ── VIEWER VIEW ──
  if (watchingStream) {
    return (
      <div className="min-h-dvh bg-[#0a0a0f] text-white flex flex-col pt-[var(--safe-area-inset-top)] pb-[var(--safe-area-inset-bottom)]">
        {/* Stream Video Container */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          {viewerState === 'connecting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 z-20">
              <Spinner size="large" color="text-primary" />
              <p className="text-sm font-semibold text-white/80">Connecting to broadcaster...</p>
            </div>
          )}

          {viewerState === 'ended' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0a0a0f] z-20 p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                <Radio size={36} className="text-[#ff1493]" />
              </div>
              <div>
                <p className="text-xl font-black text-white">Stream Ended</p>
                <p className="text-xs text-white/50 mt-1">The broadcaster has ended this live broadcast.</p>
              </div>
              <button
                onClick={() => { cleanupViewer(); setWatchingStream(null); setViewerState('idle'); loadStreams(); }}
                className="px-6 py-3 rounded-full bg-[#ff1493] hover:bg-[#ff2d87] text-white font-bold text-sm transition-colors"
              >
                Back to Streams
              </button>
            </div>
          )}

          {viewerState === 'failed' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#0a0a0f] z-20 p-6 text-center">
              <WifiOff size={44} className="text-red-400" />
              <div>
                <p className="text-lg font-bold text-white">Connection Failed</p>
                <p className="text-xs text-white/50 mt-1 max-w-xs">Could not establish direct media transmission with the broadcaster.</p>
              </div>
              <button
                onClick={() => { cleanupViewer(); setWatchingStream(null); setViewerState('idle'); }}
                className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-sm transition-colors"
              >
                Go Back
              </button>
            </div>
          )}

          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
          />

          {/* Top Bar with Live Tag, Viewer Count, Close */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <span className="bg-[#ff1493] text-white px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
              <span className="bg-black/60 backdrop-blur-md border border-white/10 text-white px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5">
                <Eye size={12} className="text-[#ff1493]" />
                {viewerCount.toLocaleString()}
              </span>
            </div>
            <button
              onClick={leaveStream}
              className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white transition-colors"
              title="Leave Stream"
            >
              <X size={18} />
            </button>
          </div>

          {/* Bottom Stream Details */}
          <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-10">
            <div className="flex items-center gap-3">
              <img
                src={watchingStream.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(watchingStream.username)}&background=ff1493&color=fff`}
                className="w-11 h-11 rounded-full object-cover border-2 border-[#ff1493]"
                alt=""
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-white text-base leading-snug truncate">{watchingStream.title}</p>
                <p className="text-xs text-white/60">@{watchingStream.username}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Leave Control Bar */}
        <div className="p-4 bg-[#141420] border-t border-white/5">
          <button
            onClick={leaveStream}
            className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors active:scale-[0.99]"
          >
            <PhoneOff size={16} />
            Leave Stream
          </button>
        </div>
      </div>
    );
  }

  // ── BROADCASTER VIEW (Active) ──
  if (isBroadcasting) {
    return (
      <div className="min-h-dvh bg-[#0a0a0f] text-white flex flex-col pt-[var(--safe-area-inset-top)] pb-[var(--safe-area-inset-bottom)]">
        {/* Live Preview Container */}
        <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-contain"
          />

          {/* Overlay Status Bar */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <span className="bg-[#ff1493] text-white px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase flex items-center gap-1.5 shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </span>
              <span className="bg-black/60 backdrop-blur-md border border-white/10 text-white px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5">
                <Clock size={11} />
                {broadcastDuration}
              </span>
            </div>
            <span className="bg-black/60 backdrop-blur-md border border-white/10 text-white px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5">
              <Users size={12} className="text-[#ff1493]" />
              {broadcastViewerCount} watching
            </span>
          </div>

          {!camOn && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 gap-2">
              <VideoOff size={48} className="text-white/30" />
              <p className="text-xs text-white/50">Camera is turned off</p>
            </div>
          )}
        </div>

        {/* Controls Bar */}
        <div className="p-4 bg-[#141420] border-t border-white/5 space-y-3">
          <p className="text-sm font-semibold text-white/80 text-center truncate">{liveTitle}</p>
          <div className="flex items-center justify-around max-w-sm mx-auto">
            <button
              onClick={toggleMic}
              className={`flex flex-col items-center gap-1.5 px-5 py-3 rounded-2xl transition-colors ${micOn ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-red-500/20 text-red-400'}`}
            >
              {micOn ? <Mic size={22} /> : <MicOff size={22} />}
              <span className="text-[10px] font-bold">{micOn ? 'Mute' : 'Unmuted'}</span>
            </button>
            <button
              onClick={endBroadcast}
              className="flex flex-col items-center gap-1.5 px-7 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold transition-colors active:scale-95 shadow-lg shadow-red-500/30"
            >
              <PhoneOff size={22} />
              <span className="text-[10px] font-bold">End Live</span>
            </button>
            <button
              onClick={toggleCam}
              className={`flex flex-col items-center gap-1.5 px-5 py-3 rounded-2xl transition-colors ${camOn ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-red-500/20 text-red-400'}`}
            >
              {camOn ? <Video size={22} /> : <VideoOff size={22} />}
              <span className="text-[10px] font-bold">{camOn ? 'Cam Off' : 'Cam On'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── MAIN STREAMS LISTING ──
  return (
    <div className="min-h-dvh bg-[#0a0a0f] text-white overflow-hidden relative pb-24 font-sans pt-[var(--safe-area-inset-top)]">
      {/* Solid Top Navigation Bar */}
      <div className="sticky top-[var(--safe-area-inset-top,0px)] z-50 bg-[#0a0a0f] border-b border-white/5 px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
          </button>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight" style={{ fontFamily: 'Outfit' }}>
              Live <span className="text-[#ff1493]">Streams</span>
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="flex items-center gap-1 text-[10px] font-black text-[#ff1493] uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff1493] animate-pulse" />
                On Air
              </span>
              <span className="bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-[9px] font-bold text-white/50">
                {streams.length} live now
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setGoLiveOpen(true)}
          className="bg-[#ff1493] hover:bg-[#ff2d87] text-white px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-md shadow-[#ff1493]/20 active:scale-95 transition-all"
        >
          <Video size={14} />
          <span>Go Live</span>
        </button>
      </div>

      {/* Go Live Composer Modal */}
      {goLiveOpen && (
        <div className="fixed inset-0 z-[var(--z-modal)] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-[#141420] border border-white/10 rounded-3xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-lg font-black text-white">Start Live Broadcast</h3>
              <button
                onClick={() => setGoLiveOpen(false)}
                className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-white/50">
              Your camera and microphone will be activated to start transmitting live video to your followers.
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

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 relative z-10">
        {/* Creator Console Info Banner */}
        <div className="bg-[#141420] border border-[#ff1493]/30 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#ff1493]/15 flex items-center justify-center text-[#ff1493] shrink-0">
            <Radio size={22} className="animate-pulse" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
              Creator Console Unlocked
              <Award size={14} className="text-amber-400" />
            </h4>
            <p className="text-xs text-white/50 mt-0.5">
              You have reached 1,000+ followers. You are authorized to broadcast real-time video to your peers.
            </p>
          </div>
        </div>

        {/* Real Live Streams Grid */}
        {streams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {streams.map(stream => {
              const streamId = stream.stream_id || stream.id;
              return (
                <div
                  key={streamId}
                  className="bg-[#141420] border border-white/5 rounded-2xl overflow-hidden flex flex-col hover:border-[#ff1493]/40 transition-all duration-300 cursor-pointer group"
                  onClick={() => joinStream(stream)}
                >
                  {/* Thumbnail / Video Preview Placeholder */}
                  <div className="relative h-44 overflow-hidden bg-zinc-900 flex items-center justify-center">
                    {stream.thumbnail_url ? (
                      <img src={stream.thumbnail_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={stream.title} />
                    ) : (
                      <Radio size={40} className="text-white/10 group-hover:text-[#ff1493]/30 transition-colors" />
                    )}
                    <div className="absolute top-3 left-3 bg-[#ff1493] text-white px-2.5 py-0.5 rounded text-[9px] font-black tracking-widest uppercase flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                      LIVE
                    </div>
                    <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md text-white px-2.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1">
                      <Eye size={10} className="text-[#ff1493]" />
                      {(stream.viewer_count ?? 0).toLocaleString()}
                    </div>
                  </div>

                  {/* Info Area */}
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center gap-3 mb-3">
                      <img
                        src={stream.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(stream.username || 'User')}&background=ff1493&color=fff`}
                        className="w-10 h-10 rounded-full object-cover border-2 border-[#ff1493]/30"
                        alt=""
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-white text-sm truncate">{stream.title}</h3>
                        <p className="text-[11px] text-white/50">@{stream.username}</p>
                      </div>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-2 border-t border-white/5">
                      <span className="text-[9px] font-bold text-[#ff1493] bg-[#ff1493]/10 border border-[#ff1493]/20 px-2 py-0.5 rounded uppercase tracking-wider">
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
            <AlertCircle size={44} className="text-red-400 mb-4" />
            <h4 className="text-lg font-bold text-white mb-1">Couldn't load live streams</h4>
            <p className="text-white/45 text-xs max-w-sm leading-relaxed mb-4">
              Unable to reach the live streams service. Please check your connection and try again.
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
            <Radio size={48} className="text-white/20 mb-4 animate-pulse" />
            <h4 className="text-lg font-bold text-white mb-1">No active live streams</h4>
            <p className="text-white/45 text-xs max-w-sm leading-relaxed">
              No one is broadcasting right now. Be the first to start a stream and share live moments with your campus!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
