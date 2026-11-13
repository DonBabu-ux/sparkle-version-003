import { createContext, useContext, useState, useEffect, useRef, type ReactNode, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { useSocket } from '../hooks/useSocket';
import { useUserStore } from '../store/userStore';
import { logger } from '../utils/logger';
import AudioSessionManager from '../audio/managers/AudioSessionManager';
import api from '../api/api';

export type CallMode = 'voice' | 'video';
export type CallDirection = 'outgoing' | 'incoming';
export type CallState =
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'failed'
  | 'declined'
  | 'missed'
  | 'ended';

export type AudioRouteType = 'speaker' | 'earpiece' | 'bluetooth' | 'headphones';

export interface CallHistoryEntry {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string;
  mode: CallMode;
  direction: CallDirection;
  state: CallState;
  timestamp: number;
  duration: number;
}

export interface CallWaitingInfo {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  mode: CallMode;
  sdp: RTCSessionDescriptionInit;
}

interface CallContextProps {
  mode: CallMode | null;
  direction: CallDirection | null;
  state: CallState;
  partnerId: string | null;
  partnerName: string | null;
  partnerAvatar: string | null;
  failureMessage: string | null;
  callDuration: number;
  startCall: (userId: string, mode: CallMode, name?: string, avatar?: string) => void;
  acceptCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleBluetooth: () => void;
  toggleCamera: () => void;
  switchCamera: () => void;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isBluetoothOn: boolean;
  isCameraOn: boolean;
  isFrontCamera: boolean;
  isRemoteMuted: boolean;
  isRemoteCameraOn: boolean;
  isMinimized: boolean;
  setMinimized: (minimized: boolean) => void;
  callHistory: CallHistoryEntry[];
  clearHistory: () => void;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  // Audio routing & devices
  availableAudioDevices: MediaDeviceInfo[];
  selectedAudioDeviceId: string | null;
  audioRoute: AudioRouteType;
  selectAudioDevice: (deviceId: string) => Promise<void>;
  // Call upgrade
  videoUpgradeRequested: boolean;
  requestVideoUpgrade: () => void;
  respondVideoUpgrade: (accepted: boolean) => void;
  // Call waiting
  callWaiting: CallWaitingInfo | null;
  acceptCallWaiting: () => void;
  declineCallWaiting: () => void;
}

const CallContext = createContext<CallContextProps | null>(null);

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    { urls: ['stun:stun.cloudflare.com:3478'] },
  ],
};

const OUTGOING_NO_ANSWER_MS = 35_000;
const INCOMING_RING_MS = 30_000;
const CONNECTING_TIMEOUT_MS = 20_000;
const DISCONNECT_GRACE_MS = 8_000;
const MAX_BUFFERED_ICE = 50;

interface ActiveCall {
  callId: string;
  peerId: string;
  mode: CallMode;
  direction: CallDirection;
}

const newCallId = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `call-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const mediaConstraints = (mode: CallMode): MediaStreamConstraints =>
  mode === 'video'
    ? { audio: true, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } }
    : { audio: true };

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const socket: Socket | null = useSocket();
  const socketRef = useRef<Socket | null>(null);
  socketRef.current = socket;

  const [mode, setMode] = useState<CallMode | null>(null);
  const [direction, setDirection] = useState<CallDirection | null>(null);
  const [state, setState] = useState<CallState>('idle');
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const [partnerAvatar, setPartnerAvatar] = useState<string | null>(null);
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);

  const [isMuted, setMuted] = useState(false);
  const [isSpeakerOn, setSpeaker] = useState(true);
  const [isBluetoothOn, setBluetooth] = useState(false);
  const [isCameraOn, setCamera] = useState(true);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isRemoteCameraOn, setIsRemoteCameraOn] = useState(true);
  const [isMinimized, setMinimized] = useState(false);
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);

  // Audio Device Routing
  const [availableAudioDevices, setAvailableAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string | null>(null);
  const [audioRoute, setAudioRoute] = useState<AudioRouteType>('speaker');

  // Video Upgrade & Call Waiting
  const [videoUpgradeRequested, setVideoUpgradeRequested] = useState(false);
  const [callWaiting, setCallWaiting] = useState<CallWaitingInfo | null>(null);

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // ── Refs ──
  const stateRef = useRef<CallState>('idle');
  const callRef = useRef<ActiveCall | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const loggedRef = useRef(false);

  const ringSwapTimerRef = useRef<number | null>(null);
  const answerTimeoutRef = useRef<number | null>(null);
  const incomingRingRef = useRef<number | null>(null);
  const connectingTimeoutRef = useRef<number | null>(null);
  const disconnectGraceRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<number | null>(null);

  const clearTimer = (ref: React.RefObject<number | null>) => {
    if (ref.current !== null) {
      window.clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const emit = useCallback((event: string, payload: Record<string, unknown>) => {
    socketRef.current?.emit(event, payload);
  }, []);

  const applyState = (next: CallState) => {
    stateRef.current = next;
    setState(next);
  };

  // ── Audio Devices Enumeration ──
  const enumerateAudioDevices = useCallback(async () => {
    try {
      if (navigator.mediaDevices?.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
        setAvailableAudioDevices(audioOutputs);
      }
    } catch (_) {}
  }, []);

  useEffect(() => {
    enumerateAudioDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', enumerateAudioDevices);
    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', enumerateAudioDevices);
    };
  }, [enumerateAudioDevices]);

  const selectAudioDevice = async (deviceId: string) => {
    setSelectedAudioDeviceId(deviceId);
    const dev = availableAudioDevices.find(d => d.deviceId === deviceId);
    const label = (dev?.label || '').toLowerCase();
    if (label.includes('bluetooth') || label.includes('bt') || label.includes('airpod')) {
      setAudioRoute('bluetooth');
      setBluetooth(true);
      setSpeaker(false);
    } else if (label.includes('speaker')) {
      setAudioRoute('speaker');
      setSpeaker(true);
      setBluetooth(false);
    } else if (label.includes('headphone') || label.includes('headset')) {
      setAudioRoute('headphones');
      setSpeaker(false);
      setBluetooth(false);
    } else {
      setAudioRoute('earpiece');
      setSpeaker(false);
      setBluetooth(false);
    }
  };

  const teardownMedia = () => {
    clearTimer(ringSwapTimerRef);
    clearTimer(answerTimeoutRef);
    clearTimer(incomingRingRef);
    clearTimer(connectingTimeoutRef);
    clearTimer(disconnectGraceRef);
    const pc = pcRef.current;
    pcRef.current = null;
    if (pc) {
      try {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
      } catch {
        /* already closed */
      }
    }
    localStreamRef.current?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* track already ended */
      }
    });
    localStreamRef.current = null;
    setLocalStream(null);
    remoteStreamRef.current = null;
    setRemoteStream(null);
    pendingOfferRef.current = null;
    pendingIceRef.current = [];
    callRef.current = null;
    setVideoUpgradeRequested(false);
    setCallWaiting(null);
  };

  const finish = (nextState: CallState, tone: 'completed' | 'hangup' | 'busy') => {
    teardownMedia();
    try {
      AudioSessionManager.endCall(tone);
    } catch (e) {
      logger.warn('Call audio end failed', e);
    }
    if (stateRef.current === 'idle') return;
    applyState(nextState);
  };

  const failCall = (message: string, tone: 'completed' | 'hangup' | 'busy' = 'hangup') => {
    if (stateRef.current === 'idle') return;
    setFailureMessage(message);
    finish('failed', tone);
  };

  const startConnectingTimeout = () => {
    clearTimer(connectingTimeoutRef);
    connectingTimeoutRef.current = window.setTimeout(() => {
      connectingTimeoutRef.current = null;
      if (stateRef.current === 'connecting') {
        failCall('Could not connect');
      }
    }, CONNECTING_TIMEOUT_MS);
  };

  const flushPendingIce = async (pc: RTCPeerConnection) => {
    const buffered = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const candidate of buffered) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (e) {
        logger.warn('addIceCandidate (buffered) failed', e);
      }
    }
  };

  const createPeer = (callId: string, peerId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        emit('call:ice', { callId, targetId: peerId, candidate: e.candidate.toJSON() });
      }
    };
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      remoteStreamRef.current = stream;
      setRemoteStream(stream);
    };
    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc) return;
      const cs = pc.connectionState;
      if (cs === 'connected') {
        clearTimer(disconnectGraceRef);
        clearTimer(connectingTimeoutRef);
        if (stateRef.current === 'calling' || stateRef.current === 'ringing' || stateRef.current === 'connecting') {
          applyState('connected');
        }
      } else if (cs === 'failed') {
        failCall('Connection failed');
      } else if (cs === 'disconnected') {
        if (disconnectGraceRef.current === null) {
          disconnectGraceRef.current = window.setTimeout(() => {
            disconnectGraceRef.current = null;
            if (pcRef.current === pc && pc.connectionState !== 'connected') {
              failCall('Connection lost');
            }
          }, DISCONNECT_GRACE_MS);
        }
      }
    };
    return pc;
  };

  // ── Apply mute/camera flags to live tracks ──
  useEffect(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !isMuted;
    });
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = isCameraOn;
    });
    // Emit real-time status to peer
    if (callRef.current && stateRef.current === 'connected') {
      emit('call:mute', { callId: callRef.current.callId, targetId: callRef.current.peerId, isMuted });
      emit('call:camera', { callId: callRef.current.callId, targetId: callRef.current.peerId, isCameraOn });
    }
  }, [isMuted, isCameraOn, localStream, emit]);

  // ── Load history from backend & localStorage ──
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sparkle_call_history');
      if (stored) {
        setCallHistory(JSON.parse(stored));
      }
    } catch (_) {}

    // Also fetch authoritative backend call history
    api.get('/calls/history')
      .then(res => {
        if (res.data?.success && Array.isArray(res.data.history)) {
          const backendEntries: CallHistoryEntry[] = res.data.history.map((h: any) => ({
            id: h.call_id || h.id,
            partnerId: h.partner?.user_id || '',
            partnerName: h.partner?.name || h.partner?.username || 'User',
            partnerAvatar: h.partner?.avatar_url,
            mode: h.mode === 'video' ? 'video' : 'voice',
            direction: h.direction || 'outgoing',
            state: h.status === 'ended' ? 'ended' : h.status === 'missed' ? 'missed' : h.status === 'rejected' ? 'declined' : 'ended',
            timestamp: new Date(h.started_at).getTime(),
            duration: h.duration_seconds || 0,
          }));
          setCallHistory(prev => {
            const combined = [...backendEntries, ...prev];
            const deduped = Array.from(new Map(combined.map(item => [item.id, item])).values());
            return deduped.slice(0, 100);
          });
        }
      })
      .catch(() => {});
  }, []);

  const saveCallToLog = (finalState: CallState, durationSecs: number) => {
    if (loggedRef.current) return;
    const pid = partnerId;
    if (!pid) return;
    loggedRef.current = true;
    const callMode = mode || 'voice';
    const callDir = direction || 'outgoing';
    const entry: CallHistoryEntry = {
      id: callRef.current?.callId || Math.random().toString(36).slice(2, 11),
      partnerId: pid,
      partnerName: partnerName || 'Sparkle User',
      partnerAvatar: partnerAvatar || undefined,
      mode: callMode,
      direction: callDir,
      state: finalState,
      timestamp: Date.now(),
      duration: durationSecs,
    };

    setCallHistory((prev) => {
      const updated = [entry, ...prev.filter(e => e.id !== entry.id)].slice(0, 100);
      try {
        localStorage.setItem('sparkle_call_history', JSON.stringify(updated));
      } catch (e) {
        logger.error('Failed to save call history', e);
      }
      return updated;
    });

    const outcome = finalState === 'ended' ? 'completed'
      : finalState === 'missed' ? 'missed'
      : finalState === 'declined' ? 'declined'
      : finalState === 'failed' ? 'failed'
      : 'cancelled';

    const me = useUserStore.getState().user;
    if ((me?.id || me?.user_id) && pid && String(pid).trim()) {
      api.post('/messages/send', {
        partnerId: String(pid).trim(),
        recipient_id: String(pid).trim(),
        content: `${callDir === 'outgoing' ? 'Outgoing' : 'Incoming'} ${callMode} call · ${outcome}${durationSecs > 0 && outcome === 'completed' ? ` · ${Math.floor(durationSecs / 60)}:${String(durationSecs % 60).padStart(2, '0')}` : ''}`,
        type: callMode === 'video' ? 'video_call' : 'voice_call',
        metadata: JSON.stringify({ outcome, duration: durationSecs, direction: callDir }),
      }).catch((e: Error) => logger.warn('Call log bubble send failed', e.message));
    }
  };

  const clearHistory = () => {
    setCallHistory([]);
    localStorage.removeItem('sparkle_call_history');
  };

  // ── State machine timer & duration side effects ──
  useEffect(() => {
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (durationIntervalRef.current !== null) {
      window.clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (state === 'idle') {
      setCallDuration(0);
      setMinimized(false);
      return;
    }

    if (state === 'connected') {
      setCallDuration(0);
      durationIntervalRef.current = window.setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
      return;
    }

    if (state === 'failed' || state === 'declined' || state === 'missed') {
      saveCallToLog(state, callDuration);
      setMinimized(false);
      transitionTimerRef.current = window.setTimeout(() => {
        transitionTimerRef.current = null;
        if (stateRef.current === state) applyState('ended');
      }, 2500);
      return;
    }

    if (state === 'ended') {
      saveCallToLog('ended', callDuration);
      setMinimized(false);
      transitionTimerRef.current = window.setTimeout(() => {
        transitionTimerRef.current = null;
        if (stateRef.current === 'ended') applyState('idle');
      }, 1000);
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // ── Socket Signaling Handlers ──
  useEffect(() => {
    if (!socket) return;

    const onInvite = (data: {
      callId?: string;
      callerId?: string | number;
      mode?: string;
      sdp?: RTCSessionDescriptionInit;
      callerName?: string;
      callerAvatar?: string | null;
    }) => {
      const callId = data?.callId ? String(data.callId) : null;
      const callerId = data?.callerId !== undefined && data?.callerId !== null ? String(data.callerId) : null;
      if (!callId || !callerId || !data?.sdp) return;

      // Call Waiting handling if already in a call:
      if (stateRef.current === 'connected') {
        setCallWaiting({
          callId,
          callerId,
          callerName: data.callerName || 'Someone',
          callerAvatar: data.callerAvatar || undefined,
          mode: data.mode === 'video' ? 'video' : 'voice',
          sdp: data.sdp,
        });
        return;
      }

      if (stateRef.current !== 'idle' || pcRef.current || callRef.current) {
        emit('call:reject', { callId, targetId: callerId, reason: 'busy' });
        return;
      }

      const callMode: CallMode = data.mode === 'video' ? 'video' : 'voice';
      loggedRef.current = false;
      callRef.current = { callId, peerId: callerId, mode: callMode, direction: 'incoming' };
      pendingOfferRef.current = data.sdp;
      pendingIceRef.current = [];

      setMode(callMode);
      setDirection('incoming');
      setPartnerId(callerId);
      setPartnerName(data.callerName || 'Incoming User');
      setPartnerAvatar(data.callerAvatar || null);
      setFailureMessage(null);
      setMuted(false);
      setSpeaker(true);
      setBluetooth(false);
      setCamera(callMode === 'video');
      setIsFrontCamera(true);
      setIsRemoteMuted(false);
      setIsRemoteCameraOn(true);
      setMinimized(false);
      applyState('ringing');

      // Alert caller that call is ringing
      emit('call:ringing', { callId, targetId: callerId });

      try {
        AudioSessionManager.startIncomingCall();
      } catch (e) {
        logger.warn('Incoming ringtone failed', e);
      }

      clearTimer(incomingRingRef);
      incomingRingRef.current = window.setTimeout(() => {
        incomingRingRef.current = null;
        if (stateRef.current === 'ringing' && callRef.current?.callId === callId) {
          emit('call:end', { callId, targetId: callerId });
          finish('missed', 'hangup');
        }
      }, INCOMING_RING_MS);
    };

    const onRinging = (data: { callId?: string }) => {
      const call = callRef.current;
      if (!call || !data?.callId || String(data.callId) !== call.callId) return;
      if (stateRef.current === 'calling') {
        applyState('ringing');
      }
    };

    const onAccept = (data: { callId?: string; calleeId?: string | number; sdp?: RTCSessionDescriptionInit }) => {
      const call = callRef.current;
      if (!call || !data?.callId || String(data.callId) !== call.callId) return;
      const pc = pcRef.current;
      if (!pc || !data.sdp) return;
      (async () => {
        try {
          await pc.setRemoteDescription(data.sdp);
          await flushPendingIce(pc);
          clearTimer(answerTimeoutRef);
          applyState('connecting');
          startConnectingTimeout();
        } catch (e) {
          logger.error('Failed to apply answer SDP', e);
          failCall('Call handshake failed');
        }
      })();
    };

    const onIce = (data: { callId?: string; candidate?: RTCIceCandidateInit | null }) => {
      const call = callRef.current;
      if (!call || !data?.callId || String(data.callId) !== call.callId) return;
      if (!data.candidate) return;
      const pc = pcRef.current;
      if (pc && pc.remoteDescription) {
        pc.addIceCandidate(data.candidate).catch((e) => logger.warn('addIceCandidate failed', e));
      } else if (pendingIceRef.current.length < MAX_BUFFERED_ICE) {
        pendingIceRef.current.push(data.candidate);
      }
    };

    const onReject = (data: { callId?: string; reason?: string }) => {
      const call = callRef.current;
      if (!call || !data?.callId || String(data.callId) !== call.callId) return;
      if (data.reason === 'busy') {
        failCall('User is busy', 'busy');
      } else {
        finish('declined', 'hangup');
      }
    };

    const onCancel = (data: { callId?: string }) => {
      const call = callRef.current;
      if (!call || !data?.callId || String(data.callId) !== call.callId) return;
      finish('missed', 'hangup');
    };

    const onBusy = (data: { callId?: string }) => {
      const call = callRef.current;
      if (!call || !data?.callId || String(data.callId) !== call.callId) return;
      failCall('User is busy', 'busy');
    };

    const onUnavailable = (data: { callId?: string; reason?: string }) => {
      const call = callRef.current;
      if (!call || !data?.callId || String(data.callId) !== call.callId) return;
      if (data.reason === 'blocked') {
        failCall('Call unavailable');
      } else if (data.reason === 'silenced') {
        failCall('User has silenced unknown callers');
      } else {
        failCall('User is currently unavailable');
      }
    };

    const onEnd = (data: { callId?: string; reason?: string }) => {
      const call = callRef.current;
      if (!call || !data?.callId || String(data.callId) !== call.callId) return;
      const wasConnected = stateRef.current === 'connected';
      finish('ended', wasConnected ? 'completed' : 'hangup');
    };

    const onPeerMute = (data: { callId?: string; isMuted?: boolean }) => {
      const call = callRef.current;
      if (!call || !data?.callId || String(data.callId) !== call.callId) return;
      setIsRemoteMuted(Boolean(data.isMuted));
    };

    const onPeerCamera = (data: { callId?: string; isCameraOn?: boolean }) => {
      const call = callRef.current;
      if (!call || !data?.callId || String(data.callId) !== call.callId) return;
      setIsRemoteCameraOn(Boolean(data.isCameraOn));
    };

    const onUpgradeVideo = (data: { callId?: string }) => {
      const call = callRef.current;
      if (!call || !data?.callId || String(data.callId) !== call.callId) return;
      setVideoUpgradeRequested(true);
    };

    const onUpgradeResponse = async (data: { callId?: string; accepted?: boolean; sdp?: RTCSessionDescriptionInit }) => {
      const call = callRef.current;
      if (!call || !data?.callId || String(data.callId) !== call.callId) return;
      if (data.accepted) {
        setMode('video');
        setCamera(true);
        if (data.sdp && pcRef.current) {
          try {
            await pcRef.current.setRemoteDescription(data.sdp);
          } catch (_) {}
        }
      }
    };

    socket.on('call:invite', onInvite);
    socket.on('call:ringing', onRinging);
    socket.on('call:accept', onAccept);
    socket.on('call:ice', onIce);
    socket.on('call:reject', onReject);
    socket.on('call:cancel', onCancel);
    socket.on('call:busy', onBusy);
    socket.on('call:unavailable', onUnavailable);
    socket.on('call:end', onEnd);
    socket.on('call:mute', onPeerMute);
    socket.on('call:camera', onPeerCamera);
    socket.on('call:upgrade-video', onUpgradeVideo);
    socket.on('call:upgrade-response', onUpgradeResponse);

    return () => {
      socket.off('call:invite', onInvite);
      socket.off('call:ringing', onRinging);
      socket.off('call:accept', onAccept);
      socket.off('call:ice', onIce);
      socket.off('call:reject', onReject);
      socket.off('call:cancel', onCancel);
      socket.off('call:busy', onBusy);
      socket.off('call:unavailable', onUnavailable);
      socket.off('call:end', onEnd);
      socket.off('call:mute', onPeerMute);
      socket.off('call:camera', onPeerCamera);
      socket.off('call:upgrade-video', onUpgradeVideo);
      socket.off('call:upgrade-response', onUpgradeResponse);
    };
  }, [socket, emit]);

  // ── Actions ──
  const startCall = (userId: string, callMode: CallMode, name?: string, avatar?: string) => {
    if (!socketRef.current || stateRef.current !== 'idle') return;

    teardownMedia();
    loggedRef.current = false;
    const callId = newCallId();
    const peerId = String(userId);
    const call: ActiveCall = { callId, peerId, mode: callMode, direction: 'outgoing' };
    callRef.current = call;

    setMode(callMode);
    setDirection('outgoing');
    setPartnerId(peerId);
    setPartnerName(name || 'User');
    setPartnerAvatar(avatar || null);
    setFailureMessage(null);
    setMuted(false);
    setSpeaker(true);
    setBluetooth(false);
    setCamera(callMode === 'video');
    setIsFrontCamera(true);
    setIsRemoteMuted(false);
    setIsRemoteCameraOn(true);
    setMinimized(false);
    applyState('calling');

    try {
      AudioSessionManager.startOutgoingCall();
    } catch (e) {
      logger.warn('Outgoing call tone failed', e);
    }

    clearTimer(ringSwapTimerRef);
    ringSwapTimerRef.current = window.setTimeout(() => {
      ringSwapTimerRef.current = null;
      if (stateRef.current === 'calling' && callRef.current?.callId === callId) {
        applyState('ringing');
      }
    }, 1200);

    clearTimer(answerTimeoutRef);
    answerTimeoutRef.current = window.setTimeout(() => {
      answerTimeoutRef.current = null;
      if (callRef.current?.callId === callId && (stateRef.current === 'calling' || stateRef.current === 'ringing')) {
        emit('call:end', { callId, targetId: peerId });
        finish('missed', 'hangup');
      }
    }, OUTGOING_NO_ANSWER_MS);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints(callMode));
        if (stateRef.current === 'idle' || callRef.current !== call) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        stream.getAudioTracks().forEach((t) => {
          t.enabled = !isMuted;
        });
        stream.getVideoTracks().forEach((t) => {
          t.enabled = isCameraOn;
        });

        const pc = createPeer(callId, peerId);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const me = useUserStore.getState().user;
        emit('call:invite', {
          callId,
          targetId: peerId,
          mode: callMode,
          sdp: pc.localDescription,
          callerName: me?.name || me?.username || 'Sparkle User',
          callerAvatar: me?.avatar_url || me?.avatar || null,
        });
      } catch (e) {
        logger.error('startCall media/signaling failure', e);
        emit('call:end', { callId, targetId: peerId });
        failCall(callMode === 'video' ? 'Camera or microphone unavailable' : 'Microphone unavailable');
      }
    })();
  };

  const acceptCall = () => {
    const call = callRef.current;
    if (stateRef.current !== 'ringing' || !call) return;
    const offer = pendingOfferRef.current;
    if (!offer) {
      failCall('Call could not be answered');
      return;
    }
    const callMode = call.mode;
    clearTimer(incomingRingRef);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints(callMode));
        if (stateRef.current !== 'ringing' || callRef.current !== call) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        stream.getAudioTracks().forEach((t) => {
          t.enabled = !isMuted;
        });
        stream.getVideoTracks().forEach((t) => {
          t.enabled = isCameraOn;
        });

        const pc = createPeer(call.callId, call.peerId);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        await pc.setRemoteDescription(offer);
        pendingOfferRef.current = null;
        await flushPendingIce(pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        applyState('connecting');
        startConnectingTimeout();
        emit('call:accept', {
          callId: call.callId,
          targetId: call.peerId,
          sdp: pc.localDescription,
        });
      } catch (e) {
        logger.error('acceptCall media/signaling failure', e);
        emit('call:reject', { callId: call.callId, targetId: call.peerId, reason: 'media' });
        failCall('Could not access microphone');
      }
    })();
  };

  const declineCall = () => {
    const call = callRef.current;
    if (stateRef.current !== 'ringing' || !call) return;
    emit('call:reject', { callId: call.callId, targetId: call.peerId });
    finish('declined', 'hangup');
  };

  const endCall = () => {
    if (stateRef.current === 'idle') return;
    const call = callRef.current;
    const wasConnected = stateRef.current === 'connected';
    if (call) {
      if (stateRef.current === 'calling' || (stateRef.current === 'ringing' && direction === 'outgoing')) {
        emit('call:cancel', { callId: call.callId, targetId: call.peerId });
      } else {
        emit('call:end', { callId: call.callId, targetId: call.peerId });
      }
    }
    finish('ended', wasConnected ? 'completed' : 'hangup');
  };

  const toggleMute = () => setMuted((v) => !v);
  const toggleSpeaker = () => {
    setSpeaker(prev => {
      const next = !prev;
      setAudioRoute(next ? 'speaker' : 'earpiece');
      return next;
    });
  };
  const toggleBluetooth = () => {
    setBluetooth(prev => {
      const next = !prev;
      setAudioRoute(next ? 'bluetooth' : 'speaker');
      return next;
    });
  };
  const toggleCamera = () => setCamera((v) => !v);

  const switchCamera = async () => {
    if (mode !== 'video' || !isCameraOn || stateRef.current === 'idle') return;
    const nextFacing = isFrontCamera ? 'environment' : 'user';
    try {
      const fresh = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const newVideo = fresh.getVideoTracks()[0];
      if (!newVideo) return;
      const pc = pcRef.current;
      const sender = pc?.getSenders().find((s) => s.track?.kind === 'video');
      if (pc && sender) {
        await sender.replaceTrack(newVideo);
      }
      const oldTracks = localStreamRef.current?.getVideoTracks() ?? [];
      const audioTracks = localStreamRef.current?.getAudioTracks() ?? [];
      oldTracks.forEach((t) => {
        if (t !== newVideo) t.stop();
      });
      newVideo.enabled = isCameraOn;
      const merged = new MediaStream([newVideo, ...audioTracks]);
      localStreamRef.current = merged;
      setLocalStream(merged);
      setIsFrontCamera(!isFrontCamera);
    } catch (e) {
      logger.warn('switchCamera failed', e);
    }
  };

  // Video Upgrade Request & Response
  const requestVideoUpgrade = async () => {
    if (!callRef.current || mode === 'video') return;
    emit('call:upgrade-video', { callId: callRef.current.callId, targetId: callRef.current.peerId });
  };

  const respondVideoUpgrade = async (accepted: boolean) => {
    setVideoUpgradeRequested(false);
    if (!callRef.current) return;
    if (!accepted) {
      emit('call:upgrade-response', { callId: callRef.current.callId, targetId: callRef.current.peerId, accepted: false });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack && pcRef.current && localStreamRef.current) {
        localStreamRef.current.addTrack(videoTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        pcRef.current.addTrack(videoTrack, localStreamRef.current);
        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);

        setMode('video');
        setCamera(true);
        emit('call:upgrade-response', {
          callId: callRef.current.callId,
          targetId: callRef.current.peerId,
          accepted: true,
          sdp: offer,
        });
      }
    } catch (err: any) {
      logger.error('Video upgrade permission error:', err);
      emit('call:upgrade-response', { callId: callRef.current.callId, targetId: callRef.current.peerId, accepted: false });
    }
  };

  // Call Waiting Actions
  const acceptCallWaiting = () => {
    if (!callWaiting) return;
    // End current call
    endCall();
    // Answer the waiting call
    const waiting = { ...callWaiting };
    setCallWaiting(null);
    setTimeout(() => {
      callRef.current = {
        callId: waiting.callId,
        peerId: waiting.callerId,
        mode: waiting.mode,
        direction: 'incoming'
      };
      pendingOfferRef.current = waiting.sdp;
      setMode(waiting.mode);
      setDirection('incoming');
      setPartnerId(waiting.callerId);
      setPartnerName(waiting.callerName);
      setPartnerAvatar(waiting.callerAvatar || null);
      acceptCall();
    }, 500);
  };

  const declineCallWaiting = () => {
    if (!callWaiting) return;
    emit('call:reject', { callId: callWaiting.callId, targetId: callWaiting.callerId, reason: 'busy' });
    setCallWaiting(null);
  };

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      const call = callRef.current;
      if (call) {
        emit('call:end', { callId: call.callId, targetId: call.peerId });
      }
      teardownMedia();
      if (durationIntervalRef.current !== null) {
        window.clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <CallContext.Provider
      value={{
        mode,
        direction,
        state,
        partnerId,
        partnerName,
        partnerAvatar,
        failureMessage,
        callDuration,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMute,
        toggleSpeaker,
        toggleBluetooth,
        toggleCamera,
        switchCamera,
        isMuted,
        isSpeakerOn,
        isBluetoothOn,
        isCameraOn,
        isFrontCamera,
        isRemoteMuted,
        isRemoteCameraOn,
        isMinimized,
        setMinimized,
        callHistory,
        clearHistory,
        remoteStream,
        localStream,
        availableAudioDevices,
        selectedAudioDeviceId,
        audioRoute,
        selectAudioDevice,
        videoUpgradeRequested,
        requestVideoUpgrade,
        respondVideoUpgrade,
        callWaiting,
        acceptCallWaiting,
        declineCallWaiting,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
};
