import { useState, useEffect, useRef } from 'react';
import { useCall } from './CallProvider';
import {
  Mic, MicOff, Camera, CameraOff, Volume2, VolumeX, Bluetooth,
  Phone, PhoneOff, RefreshCw, ShieldAlert, Minimize2, Video,
  Headphones, Smartphone, X, Check, ArrowRight
} from 'lucide-react';

export const CallOverlay = () => {
  const {
    mode,
    direction,
    state,
    partnerName,
    partnerAvatar,
    failureMessage,
    callDuration,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    toggleCamera,
    switchCamera,
    isMuted,
    isSpeakerOn,
    isCameraOn,
    isFrontCamera,
    isRemoteMuted,
    isRemoteCameraOn,
    isMinimized,
    setMinimized,
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
  } = useCall();

  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const [showAudioRouteMenu, setShowAudioRouteMenu] = useState(false);

  // Attach WebRTC streams to their playback elements
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream && remoteVideoRef.current.srcObject !== remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, state, isMinimized]);

  useEffect(() => {
    if (localVideoRef.current && localStream && localVideoRef.current.srcObject !== localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, state, isMinimized]);

  // Voice call audio routing
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream && remoteAudioRef.current.srcObject !== remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream, mode]);

  // Apply selected audio output device to audio element if supported
  useEffect(() => {
    if (selectedAudioDeviceId) {
      if (remoteAudioRef.current && 'setSinkId' in remoteAudioRef.current) {
        (remoteAudioRef.current as any).setSinkId(selectedAudioDeviceId).catch(() => {});
      }
      if (remoteVideoRef.current && 'setSinkId' in remoteVideoRef.current) {
        (remoteVideoRef.current as any).setSinkId(selectedAudioDeviceId).catch(() => {});
      }
    }
  }, [selectedAudioDeviceId]);

  // Network signal strength simulation
  const [signalStrength, setSignalStrength] = useState<number>(3);
  useEffect(() => {
    if (state === 'connected') {
      const interval = setInterval(() => {
        setSignalStrength(Math.floor(Math.random() * 2) + 2);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [state]);

  // Haptic feedback
  useEffect(() => {
    if (state === 'ringing' && direction === 'incoming') {
      const vibrateInterval = setInterval(() => {
        if ('vibrate' in navigator) {
          navigator.vibrate([400, 200, 400]);
        }
      }, 2000);
      return () => clearInterval(vibrateInterval);
    } else if (state === 'failed') {
      if ('vibrate' in navigator) {
        navigator.vibrate([100, 50, 100, 50, 200]);
      }
    }
  }, [state, direction]);

  if (state === 'idle') return null;

  const isVideo = mode === 'video';

  const getAvatarUrl = (avatar: string | null, name: string | null) => {
    if (avatar) return avatar;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'Sparkle User')}&background=ff1493&color=fff&size=256&semibold=true`;
  };

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (state) {
      case 'calling': return 'Calling...';
      case 'ringing': return direction === 'incoming' ? 'Incoming call...' : 'Ringing...';
      case 'connecting': return 'Connecting...';
      case 'connected': return formatDuration(callDuration);
      case 'failed': return failureMessage || 'Call failed';
      case 'declined': return 'Call declined';
      case 'missed': return 'Missed call';
      case 'ended': return 'Call ended';
      default: return '';
    }
  };

  const showIncomingOverlay = direction === 'incoming' && state === 'ringing';

  // ═══════════════════════════════════════════════════════════════════════════
  // MINIMIZED CALL BUBBLE (Allows accessing chat without ending call)
  // ═══════════════════════════════════════════════════════════════════════════
  if (isMinimized) {
    return (
      <div
        onClick={() => setMinimized(false)}
        className="fixed bottom-24 right-6 z-50 hover:scale-105 active:scale-95 transition-all duration-300 pointer-events-auto flex items-center gap-3 p-2.5 pl-3.5 pr-2.5 bg-[#0E1016]/95 backdrop-blur-2xl rounded-full border border-white/10 shadow-2xl cursor-pointer group"
      >
        <div className="relative flex items-center justify-center shrink-0">
          <span className={`absolute inline-flex h-9 w-9 rounded-full opacity-35 ${
            state === 'connected' ? 'bg-emerald-400 animate-ping' : 'bg-[#ff1493] animate-ping'
          }`} />
          <img
            src={getAvatarUrl(partnerAvatar, partnerName)}
            alt=""
            className="w-8 h-8 rounded-full object-cover border border-[#ff1493]"
          />
        </div>

        <div className="flex flex-col min-w-0 mr-1 select-none font-sans">
          <span className="text-[11px] font-bold tracking-wide text-white truncate max-w-[90px]">
            {partnerName || 'Call'}
          </span>
          <span className={`text-[9px] font-mono leading-none tracking-wider ${
            state === 'connected' ? 'text-emerald-400 font-bold' : 'text-white/60'
          }`}>
            {getStatusText()}
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            endCall();
          }}
          className="p-2 bg-rose-500 hover:bg-rose-600 active:scale-90 rounded-full transition-all text-white flex items-center justify-center shadow-md shrink-0"
          title="End Call"
        >
          <PhoneOff size={12} className="fill-white" />
        </button>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse-wave {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.3); opacity: 0.2; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .animate-pulse-wave-1 { animation: pulse-wave 2.5s infinite ease-out; }
        .animate-pulse-wave-2 { animation: pulse-wave 2.5s infinite ease-out 1.25s; }
      `}} />

      {/* Main Full-Screen Calling Surface */}
      <div className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden bg-[#0A0B10] text-white font-sans select-none">
        
        {/* Background / Video Layer */}
        <div className="absolute inset-0 z-0">
          {isVideo && state === 'connected' && remoteStream && isRemoteCameraOn ? (
            <div className="absolute inset-0 bg-black overflow-hidden">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          ) : isVideo && state === 'connected' && !isRemoteCameraOn ? (
            <div className="absolute inset-0 bg-[#0c0d14] flex flex-col items-center justify-center">
              <img
                src={getAvatarUrl(partnerAvatar, partnerName)}
                alt=""
                className="w-32 h-32 rounded-full object-cover border-2 border-white/20 shadow-2xl"
              />
              <p className="text-xs text-white/50 mt-4 font-semibold">Camera is turned off</p>
            </div>
          ) : (
            <div className="absolute inset-0 bg-[#08090C] overflow-hidden flex items-center justify-center">
              {partnerAvatar && (
                <div
                  className="absolute inset-0 bg-cover bg-center opacity-[0.08] blur-2xl scale-125"
                  style={{ backgroundImage: `url(${partnerAvatar})` }}
                />
              )}
            </div>
          )}

          {/* Voice call audio element */}
          {!isVideo && (
            <audio ref={remoteAudioRef} autoPlay playsInline />
          )}
        </div>

        {/* ── CALL WAITING BANNER ── */}
        {callWaiting && (
          <div className="relative z-40 px-4 pt-[calc(3.5rem+var(--safe-area-inset-top,0px))]">
            <div className="bg-[#141420]/95 border-2 border-[#ff1493] rounded-2xl p-4 shadow-2xl backdrop-blur-md flex items-center justify-between animate-bounce">
              <div className="flex items-center gap-3">
                <img
                  src={getAvatarUrl(callWaiting.callerAvatar || null, callWaiting.callerName)}
                  className="w-10 h-10 rounded-full object-cover border border-[#ff1493]"
                  alt=""
                />
                <div>
                  <p className="text-xs font-bold text-white truncate max-w-[140px]">{callWaiting.callerName}</p>
                  <p className="text-[10px] text-[#ff1493] font-semibold">
                    Incoming {callWaiting.mode} call...
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={declineCallWaiting}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
                >
                  Decline
                </button>
                <button
                  onClick={acceptCallWaiting}
                  className="px-3 py-1.5 rounded-xl bg-[#ff1493] hover:bg-[#ff2d87] text-white text-xs font-bold flex items-center gap-1 shadow-md"
                >
                  <ArrowRight size={12} /> Answer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── VIDEO UPGRADE REQUEST DIALOG ── */}
        {videoUpgradeRequested && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#141420] border border-white/10 rounded-3xl p-6 w-full max-w-sm text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#ff1493]/20 text-[#ff1493] flex items-center justify-center mx-auto">
                <Video size={28} />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Switch to Video Call?</h3>
                <p className="text-xs text-white/50 mt-1">
                  {partnerName || 'Caller'} wants to switch this call to video. Your camera will be turned on.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => respondVideoUpgrade(false)}
                  className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/15"
                >
                  Decline
                </button>
                <button
                  onClick={() => respondVideoUpgrade(true)}
                  className="flex-1 py-3 rounded-xl bg-[#ff1493] hover:bg-[#ff2d87] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-[#ff1493]/30"
                >
                  <Check size={14} /> Accept
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TOP BAR: Minimize, Encryption, Signal, Timer */}
        <div className="relative z-20 flex items-center justify-between px-6 pt-[calc(3rem+var(--safe-area-inset-top,0px))] pb-4 bg-gradient-to-b from-black/60 to-transparent">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMinimized(true)}
              className="p-2.5 bg-black/40 hover:bg-white/10 text-white/80 active:scale-90 rounded-full transition-all border border-white/10 shadow-lg backdrop-blur-md"
              title="Minimize call"
            >
              <Minimize2 size={16} strokeWidth={2.5} />
            </button>
            <div className="flex items-center gap-1.5 text-[11px] text-white/60 font-mono bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/5">
              <ShieldAlert size={12} className="text-emerald-400" />
              <span>End-to-End Encrypted</span>
            </div>
          </div>

          {state === 'connected' && (
            <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/10">
              <div className="flex gap-0.5 items-end">
                {[1, 2, 3, 4].map((bar) => (
                  <span
                    key={bar}
                    className={`w-1 rounded-sm transition-all duration-300 ${
                      bar <= signalStrength ? 'bg-emerald-400' : 'bg-white/20'
                    }`}
                    style={{ height: `${bar * 3 + 4}px` }}
                  />
                ))}
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400">
                {formatDuration(callDuration)}
              </span>
            </div>
          )}
        </div>

        {/* MIDDLE SECTION: Large Avatar & Caller Details */}
        <div className="relative z-20 flex-1 flex flex-col items-center justify-center px-6">
          {(!isVideo || state !== 'connected') && (
            <div className="relative mb-6 flex items-center justify-center">
              {(state === 'calling' || state === 'ringing' || state === 'connected') && (
                <>
                  <div className="absolute w-44 h-44 rounded-full border border-[#ff1493]/30 animate-pulse-wave-1" />
                  <div className="absolute w-44 h-44 rounded-full border border-[#ff1493]/30 animate-pulse-wave-2" />
                </>
              )}

              <div className="relative w-36 h-36 rounded-full overflow-hidden border-2 border-[#ff1493]/50 p-1 bg-[#10111a] shadow-2xl">
                <img
                  src={getAvatarUrl(partnerAvatar, partnerName)}
                  alt={partnerName || 'User'}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
            </div>
          )}

          <div className="text-center">
            <h2 className="text-2xl font-black tracking-tight mb-1 drop-shadow-md">
              {partnerName || 'Sparkle User'}
            </h2>
            <div className={`text-sm font-semibold tracking-wide transition-all ${
              state === 'failed' ? 'text-rose-500' : 'text-white/60'
            }`}>
              {getStatusText()}
            </div>

            {isRemoteMuted && state === 'connected' && (
              <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                <MicOff size={11} /> Caller is muted
              </span>
            )}
          </div>
        </div>

        {/* FLOATING MINI PREVIEW (Local camera during video call) */}
        {isVideo && state === 'connected' && isCameraOn && localStream && (
          <div className="relative z-20 px-6 pb-2">
            <div className="relative ml-auto w-28 h-40 rounded-2xl overflow-hidden bg-black/40 border-2 border-white/20 shadow-2xl">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${isFrontCamera ? 'scale-x-[-1]' : ''}`}
              />
              <span className="absolute bottom-1.5 left-1.5 text-[8px] bg-black/60 text-white px-1.5 py-0.5 rounded font-bold">
                You
              </span>
              <button
                onClick={() => { void switchCamera(); }}
                className="absolute top-1.5 right-1.5 p-1.5 bg-black/60 hover:bg-white/20 active:scale-90 rounded-full transition-all flex items-center justify-center text-white"
                title="Switch camera"
              >
                <RefreshCw size={12} />
              </button>
            </div>
          </div>
        )}

        {/* ── AUDIO ROUTING BOTTOM SHEET ── */}
        {showAudioRouteMenu && (
          <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-end justify-center p-0">
            <div className="bg-[#141420] border-t border-white/10 rounded-t-3xl w-full max-w-sm p-5 space-y-3">
              <div className="flex items-center justify-between pb-1">
                <h4 className="text-sm font-black text-white">Audio Output</h4>
                <button onClick={() => setShowAudioRouteMenu(false)} className="text-white/60 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              <button
                onClick={() => { toggleSpeaker(); setShowAudioRouteMenu(false); }}
                className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-colors ${
                  audioRoute === 'speaker' ? 'bg-[#ff1493]/15 border-[#ff1493] text-white' : 'bg-white/5 border-white/5 text-white/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Volume2 size={18} className="text-[#ff1493]" />
                  <span className="text-xs font-bold">Speakerphone</span>
                </div>
                {audioRoute === 'speaker' && <Check size={14} className="text-[#ff1493]" />}
              </button>

              <button
                onClick={() => { toggleSpeaker(); setShowAudioRouteMenu(false); }}
                className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-colors ${
                  audioRoute === 'earpiece' ? 'bg-[#ff1493]/15 border-[#ff1493] text-white' : 'bg-white/5 border-white/5 text-white/70'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Smartphone size={18} className="text-white/70" />
                  <span className="text-xs font-bold">Phone Earpiece</span>
                </div>
                {audioRoute === 'earpiece' && <Check size={14} className="text-[#ff1493]" />}
              </button>

              {availableAudioDevices.filter(d => (d.label || '').toLowerCase().includes('bluetooth') || (d.label || '').toLowerCase().includes('bt')).map(d => (
                <button
                  key={d.deviceId}
                  onClick={() => { selectAudioDevice(d.deviceId); setShowAudioRouteMenu(false); }}
                  className={`w-full p-3 rounded-2xl border flex items-center justify-between transition-colors ${
                    selectedAudioDeviceId === d.deviceId ? 'bg-[#ff1493]/15 border-[#ff1493] text-white' : 'bg-white/5 border-white/5 text-white/70'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Bluetooth size={18} className="text-indigo-400" />
                    <span className="text-xs font-bold truncate max-w-[200px]">{d.label || 'Bluetooth Device'}</span>
                  </div>
                  {selectedAudioDeviceId === d.deviceId && <Check size={14} className="text-[#ff1493]" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* BOTTOM ACTION BAR */}
        <div className="relative z-20 px-8 pt-6 pb-[calc(3.5rem+var(--safe-area-inset-bottom,0px))] bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-6">
          
          {/* Incoming Call Layout (Big Green Answer / Red Decline) */}
          {showIncomingOverlay ? (
            <div className="flex items-center justify-around w-full max-w-sm mx-auto">
              <button
                onClick={declineCall}
                className="flex flex-col items-center gap-2 group focus:outline-none"
              >
                <div className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-90 flex items-center justify-center transition-all shadow-xl shadow-rose-500/30">
                  <PhoneOff size={28} className="text-white" />
                </div>
                <span className="text-xs font-bold text-rose-400">Decline</span>
              </button>

              <button
                onClick={acceptCall}
                className="flex flex-col items-center gap-2 group focus:outline-none"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-90 flex items-center justify-center transition-all shadow-xl shadow-emerald-500/30 animate-pulse">
                  <Phone size={28} className="text-white fill-white" />
                </div>
                <span className="text-xs font-bold text-emerald-400">Answer</span>
              </button>
            </div>
          ) : (
            // Outgoing / Active Connected Call Controls
            <div className="flex flex-col gap-6 w-full max-w-md mx-auto">
              <div className="flex items-center justify-around px-2">
                
                {/* Mute Button */}
                <button
                  onClick={toggleMute}
                  className={`flex flex-col items-center gap-1.5 focus:outline-none ${isMuted ? 'text-[#ff1493]' : 'text-white/80'}`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                    isMuted ? 'bg-white text-[#0A0B10]' : 'bg-white/10 hover:bg-white/15'
                  }`}>
                    {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                  </div>
                  <span className="text-[10px] font-bold">{isMuted ? 'Muted' : 'Mute'}</span>
                </button>

                {/* Audio Route / Speaker Button */}
                <button
                  onClick={() => setShowAudioRouteMenu(true)}
                  className={`flex flex-col items-center gap-1.5 focus:outline-none ${isSpeakerOn ? 'text-emerald-400' : 'text-white/80'}`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                    isSpeakerOn ? 'bg-white text-[#0A0B10]' : 'bg-white/10 hover:bg-white/15'
                  }`}>
                    {audioRoute === 'bluetooth' ? <Bluetooth size={20} /> : audioRoute === 'headphones' ? <Headphones size={20} /> : isSpeakerOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
                  </div>
                  <span className="text-[10px] font-bold capitalize">{audioRoute}</span>
                </button>

                {/* Video Call: Camera toggle. Voice Call: Switch to Video */}
                {isVideo ? (
                  <button
                    onClick={toggleCamera}
                    className={`flex flex-col items-center gap-1.5 focus:outline-none ${isCameraOn ? 'text-emerald-400' : 'text-white/80'}`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                      isCameraOn ? 'bg-white text-[#0A0B10]' : 'bg-white/10 hover:bg-white/15'
                    }`}>
                      {isCameraOn ? <Camera size={20} /> : <CameraOff size={20} />}
                    </div>
                    <span className="text-[10px] font-bold">{isCameraOn ? 'Camera' : 'Cam Off'}</span>
                  </button>
                ) : (
                  <button
                    onClick={requestVideoUpgrade}
                    className="flex flex-col items-center gap-1.5 focus:outline-none text-white/80 hover:text-white"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center transition-all active:scale-90">
                      <Video size={20} />
                    </div>
                    <span className="text-[10px] font-bold">Video</span>
                  </button>
                )}

                {/* Switch Camera Button (Video only) */}
                {isVideo && (
                  <button
                    onClick={switchCamera}
                    className="flex flex-col items-center gap-1.5 focus:outline-none text-white/80"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center transition-all active:scale-90">
                      <RefreshCw size={20} />
                    </div>
                    <span className="text-[10px] font-bold">Flip</span>
                  </button>
                )}
              </div>

              {/* End Call Button */}
              <div className="flex justify-center">
                <button
                  onClick={endCall}
                  className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-90 flex items-center justify-center transition-all shadow-xl shadow-rose-500/30"
                  aria-label="End call"
                >
                  <PhoneOff size={26} className="text-white" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
