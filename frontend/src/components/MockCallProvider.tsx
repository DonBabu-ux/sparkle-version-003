import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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

interface CallContextProps {
  mode: CallMode | null;
  direction: CallDirection | null;
  state: CallState;
  startCall: (userId: string, mode: CallMode) => void;
  acceptCall: () => void;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleBluetooth: () => void;
  toggleCamera: () => void;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isBluetoothOn: boolean;
  isCameraOn: boolean;
}

const CallContext = createContext<CallContextProps | null>(null);

export const MockCallProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setMode] = useState<CallMode | null>(null);
  const [direction, setDirection] = useState<CallDirection | null>(null);
  const [state, setState] = useState<CallState>('idle');
  const [isMuted, setMuted] = useState(false);
  const [isSpeakerOn, setSpeaker] = useState(true);
  const [isBluetoothOn, setBluetooth] = useState(false);
  const [isCameraOn, setCamera] = useState(true);

  // Helper to get random duration within bounds (seconds)
  const randomDuration = (min: number, max: number) => {
    return Math.random() * (max - min) + min;
  };

  // Cleanup any pending timers when component unmounts or call ends
  const clearAllTimers = () => {
    // @ts-ignore – we store timer IDs on window for simplicity
    Object.values((window as any)._mockCallTimers || {}).forEach((id: number) => clearTimeout(id));
    (window as any)._mockCallTimers = {};
  };

  // Transition helper that respects random delays
  const scheduleTransition = (nextState: CallState, minSec: number, maxSec: number, onEnter?: () => void) => {
    const delay = randomDuration(minSec, maxSec) * 1000;
    const timerId = window.setTimeout(() => {
      setState(nextState);
      onEnter && onEnter();
    }, delay);
    // Store timer for later cleanup
    (window as any)._mockCallTimers = { ...(window as any)._mockCallTimers, [nextState]: timerId };
  };

  const startCall = (userId: string, callMode: CallMode) => {
    // Reset flags
    setMode(callMode);
    setDirection('outgoing');
    setState('calling');
    setMuted(false);
    setSpeaker(true);
    setBluetooth(false);
    setCamera(callMode === 'video');
    clearAllTimers();
    // CALLING → RINGING
    scheduleTransition('ringing', 1.2, 2.0);
    // RINGING → CONNECTING
    scheduleTransition('connecting', 2.0, 3.5);
    // CONNECTING → either CONNECTED or FAILED (random)
    const finalDelayMin = 1.5;
    const finalDelayMax = 3.0;
    const finalTimer = window.setTimeout(() => {
      const succeed = Math.random() > 0.5; // 50% chance succeed for demo
      if (succeed) {
        setState('connected');
      } else {
        // pick a failure message later via UI
        setState('failed');
      }
    }, randomDuration(finalDelayMin, finalDelayMax) * 1000);
    (window as any)._mockCallTimers = { ...(window as any)._mockCallTimers, final: finalTimer };
  };

  const acceptCall = () => {
    setDirection('incoming');
    setState('ringing');
    // Follow same flow as outgoing after ringing
    scheduleTransition('connecting', 2.0, 3.5);
    const finalTimer = window.setTimeout(() => {
      const succeed = Math.random() > 0.5;
      setState(succeed ? 'connected' : 'failed');
    }, randomDuration(1.5, 3.0) * 1000);
    (window as any)._mockCallTimers = { ...(window as any)._mockCallTimers, final: finalTimer };
  };

  const declineCall = () => {
    setState('declined');
    // Auto‑end after a brief moment
    scheduleTransition('ended', 0.5, 1.0);
  };

  const endCall = () => {
    setState('ended');
    clearAllTimers();
  };

  const toggleMute = () => setMuted((v) => !v);
  const toggleSpeaker = () => setSpeaker((v) => !v);
  const toggleBluetooth = () => setBluetooth((v) => !v);
  const toggleCamera = () => setCamera((v) => !v);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  return (
    <CallContext.Provider
      value={{
        mode,
        direction,
        state,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMute,
        toggleSpeaker,
        toggleBluetooth,
        toggleCamera,
        isMuted,
        isSpeakerOn,
        isBluetoothOn,
        isCameraOn,
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
