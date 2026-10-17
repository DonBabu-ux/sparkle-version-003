import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { useSocket } from '../hooks/useSocket';
import { useUserStore } from '../store/userStore';
import { logger } from '../utils/logger';
import AudioSessionManager from '../audio/managers/AudioSessionManager';

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
  isMinimized: boolean;
  setMinimized: (minimized: boolean) => void;
  callHistory: CallHistoryEntry[];
  clearHistory: () => void;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
}

const CallContext = createContext<CallContextProps | null>(null);

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
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
  const [isMinimized, setMinimized] = useState(false);
  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // ── Refs (read by socket handlers without stale closures) ──
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

  const emit = (event: string, payload: Record<string, unknown>) => {
    socketRef.current?.emit(event, payload);
  };

  const applyState = (next: CallState) => {
    stateRef.current = next;
    setState(next);
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

  // ── Apply mute/camera flags to live tracks whenever they change ──
  useEffect(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !isMuted;
    });
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = isCameraOn;
    });
  }, [isMuted, isCameraOn, localStream]);

  // ── Load history from localStorage ──
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sparkle_call_history');
      if (stored) {
        setCallHistory(JSON.parse(stored));
      }
    } catch (e) {
      logger.error('Failed to load call history', e);
    }
  }, []);

  const saveCallToLog = (finalState: CallState, durationSecs: number) => {
    if (loggedRef.current) return;
    const pid = partnerId;
    if (!pid) return;
    loggedRef.current = true;
    const entry: CallHistoryEntry = {
      id: Math.random().toString(36).slice(2, 11),
      partnerId: pid,
      partnerName: partnerName || 'Unknown User',
      partnerAvatar: partnerAvatar || undefined,
      mode: mode || 'voice',
      direction: direction || 'outgoing',
      state: finalState,
      timestamp: Date.now(),
      duration: durationSecs,
    };
    setCallHistory((prev) => {
      const updated = [entry, ...prev].slice(0, 50);
      try {
        localStorage.setItem('sparkle_call_history', JSON.stringify(updated));
      } catch (e) {
        logger.error('Failed to save call history', e);
      }
      return updated;
    });
  };

  const clearHistory = () => {
    setCallHistory([]);
    localStorage.removeItem('sparkle_call_history');
  };

  // ── State-machine side effects (real transitions only — no simulation) ──
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
      }, 2000);
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

  // ── Socket signaling listeners ──
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

      // Already in a call (or mid-transition) → auto-reject so the caller
      // gets an immediate busy instead of a silent ring.
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
      setMinimized(false);
      applyState('ringing');
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

    const onBusy = (data: { callId?: string }) => {
      const call = callRef.current;
      if (!call || !data?.callId || String(data.callId) !== call.callId) return;
      failCall('User is busy', 'busy');
    };

    const onEnd = (data: { callId?: string; reason?: string }) => {
      const call = callRef.current;
      if (!call || !data?.callId || String(data.callId) !== call.callId) return;
      const wasConnected = stateRef.current === 'connected';
      finish('ended', wasConnected ? 'completed' : 'hangup');
    };

    socket.on('call:invite', onInvite);
    socket.on('call:accept', onAccept);
    socket.on('call:ice', onIce);
    socket.on('call:reject', onReject);
    socket.on('call:busy', onBusy);
    socket.on('call:end', onEnd);

    return () => {
      socket.off('call:invite', onInvite);
      socket.off('call:accept', onAccept);
      socket.off('call:ice', onIce);
      socket.off('call:reject', onReject);
      socket.off('call:busy', onBusy);
      socket.off('call:end', onEnd);
    };
  }, [socket]);

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
    setMinimized(false);
    applyState('calling');
    try {
      AudioSessionManager.startOutgoingCall();
    } catch (e) {
      logger.warn('Outgoing call tone failed', e);
    }

    // Cosmetic "Calling…" → "Ringing…" swap while we wait for the callee.
    clearTimer(ringSwapTimerRef);
    ringSwapTimerRef.current = window.setTimeout(() => {
      ringSwapTimerRef.current = null;
      if (stateRef.current === 'calling' && callRef.current?.callId === callId) {
        applyState('ringing');
      }
    }, 900);

    // No answer → missed.
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
      emit('call:end', { callId: call.callId, targetId: call.peerId });
    }
    finish('ended', wasConnected ? 'completed' : 'hangup');
  };

  const toggleMute = () => setMuted((v) => !v);
  const toggleSpeaker = () => setSpeaker((v) => !v);
  const toggleBluetooth = () => setBluetooth((v) => !v);
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
      newVideo.enabled = !isMuted ? !isCameraOn ? false : true : false;
      newVideo.enabled = isCameraOn;
      const merged = new MediaStream([newVideo, ...audioTracks]);
      localStreamRef.current = merged;
      setLocalStream(merged);
      setIsFrontCamera(!isFrontCamera);
    } catch (e) {
      logger.warn('switchCamera failed', e);
    }
  };

  // ── Cleanup on unmount (App-lifetime, but stay safe) ──
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
        isMinimized,
        setMinimized,
        callHistory,
        clearHistory,
        remoteStream,
        localStream,
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
