import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';

// Types for call state
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
  triggerIncomingCall: (userId: string, mode: CallMode, name?: string, avatar?: string) => void;
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
}

const CallContext = createContext<CallContextProps | null>(null);

export const MockCallProvider = ({ children }: { children: ReactNode }) => {
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

  const transitionTimerRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<number | null>(null);

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('sparkle_call_history');
      if (stored) {
        setCallHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load call history', e);
    }
  }, []);

  const saveCallToLog = (finalState: CallState, durationSecs: number) => {
    if (!partnerId) return;
    const newEntry: CallHistoryEntry = {
      id: Math.random().toString(36).substr(2, 9),
      partnerId,
      partnerName: partnerName || 'Unknown User',
      partnerAvatar: partnerAvatar || undefined,
      mode: mode || 'voice',
      direction: direction || 'outgoing',
      state: finalState,
      timestamp: Date.now(),
      duration: durationSecs,
    };
    const updated = [newEntry, ...callHistory].slice(0, 50); // Keep last 50 logs
    setCallHistory(updated);
    try {
      localStorage.setItem('sparkle_call_history', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save call history', e);
    }
  };

  const clearHistory = () => {
    setCallHistory([]);
    localStorage.removeItem('sparkle_call_history');
  };

  // Helper to get random duration within bounds (seconds)
  const randomDuration = (min: number, max: number) => {
    return Math.random() * (max - min) + min;
  };

  const clearTimers = () => {
    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = null;
    }
    if (durationIntervalRef.current) {
      window.clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  };

  // Safe transition function
  const transitionTo = (nextState: CallState, delayMs: number) => {
    clearTimers();
    transitionTimerRef.current = window.setTimeout(() => {
      setState(nextState);
    }, delayMs);
  };

  // Handle finite state machine sequential transitions
  useEffect(() => {
    if (state === 'idle') {
      clearTimers();
      setCallDuration(0);
      setMinimized(false);
      return;
    }

    if (state === 'calling') {
      // Calling -> Ringing (1.2 to 2.0 seconds)
      transitionTo('ringing', randomDuration(1.2, 2.0) * 1000);
      return;
    }

    if (state === 'ringing') {
      if (direction === 'outgoing') {
        // Ringing -> Connecting (2.0 to 3.5 seconds)
        transitionTo('connecting', randomDuration(2.0, 3.5) * 1000);
      }
      // For incoming, we stay in ringing until user accepts or declines, or it times out (missed call after 15s)
      if (direction === 'incoming') {
        transitionTimerRef.current = window.setTimeout(() => {
          setState('missed');
        }, 15000);
      }
      return;
    }

    if (state === 'connecting') {
      // Connecting -> Connected (80% chance) or Failed (20% chance) (1.5 to 3.0 seconds)
      const isSuccess = Math.random() < 0.8;
      const delay = randomDuration(1.5, 3.0) * 1000;
      transitionTimerRef.current = window.setTimeout(() => {
        if (isSuccess) {
          setState('connected');
        } else {
          const failures = [
            'Connection failed',
            'Poor network connection',
            'Call could not connect',
            'Network unavailable',
            'User unavailable'
          ];
          const randomMsg = failures[Math.floor(Math.random() * failures.length)];
          setFailureMessage(randomMsg);
          setState('failed');
        }
      }, delay);
      return;
    }

    if (state === 'connected') {
      // Start call duration timer
      setCallDuration(0);
      durationIntervalRef.current = window.setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
      return;
    }

    if (state === 'failed' || state === 'declined' || state === 'missed') {
      const finalDuration = callDuration;
      saveCallToLog(state, finalDuration);
      setMinimized(false);
      // Auto dismiss to ended state after 2 seconds
      transitionTo('ended', 2000);
      return;
    }

    if (state === 'ended') {
      const finalDuration = callDuration;
      // If we ended from a connected state, log it as ended/completed
      if (finalDuration > 0) {
        saveCallToLog('ended', finalDuration);
      }
      setMinimized(false);
      transitionTo('idle', 1000);
      return;
    }
  }, [state]);

  const startCall = (userId: string, callMode: CallMode, name?: string, avatar?: string) => {
    clearTimers();
    setMode(callMode);
    setDirection('outgoing');
    setPartnerId(userId);
    setPartnerName(name || 'User');
    setPartnerAvatar(avatar || null);
    setFailureMessage(null);
    setMuted(false);
    setSpeaker(true);
    setBluetooth(false);
    setCamera(callMode === 'video');
    setIsFrontCamera(true);
    setMinimized(false);
    setState('calling');
  };

  const triggerIncomingCall = (userId: string, callMode: CallMode, name?: string, avatar?: string) => {
    clearTimers();
    setMode(callMode);
    setDirection('incoming');
    setPartnerId(userId);
    setPartnerName(name || 'Incoming User');
    setPartnerAvatar(avatar || null);
    setFailureMessage(null);
    setMuted(false);
    setSpeaker(true);
    setBluetooth(false);
    setCamera(callMode === 'video');
    setIsFrontCamera(true);
    setMinimized(false);
    setState('ringing');
  };

  const acceptCall = () => {
    if (state !== 'ringing') return;
    setState('connecting');
  };

  const declineCall = () => {
    if (state !== 'ringing') return;
    setState('declined');
  };

  const endCall = () => {
    setState('ended');
  };

  const toggleMute = () => setMuted((v) => !v);
  const toggleSpeaker = () => setSpeaker((v) => !v);
  const toggleBluetooth = () => setBluetooth((v) => !v);
  const toggleCamera = () => setCamera((v) => !v);
  const switchCamera = () => setIsFrontCamera((v) => !v);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearTimers();
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
        triggerIncomingCall,
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
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within MockCallProvider');
  return ctx;
};

