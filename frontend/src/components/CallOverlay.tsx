import React, { useState, useEffect } from 'react';
import { useCall } from './MockCallProvider';
import { 
  X, Mic, MicOff, Camera, CameraOff, Volume2, VolumeX, 
  Bluetooth, Phone, PhoneOff, RefreshCw, Signal, 
  User, ShieldAlert, Wifi, Battery, Minimize2, Maximize2
} from 'lucide-react';
import { LocalPreview } from './video/LocalPreview';

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
  } = useCall();

  const [signalStrength, setSignalStrength] = useState<number>(3);

  // Randomize signal strength during the call to make it look realistic
  useEffect(() => {
    if (state === 'connected') {
      const interval = setInterval(() => {
        setSignalStrength(Math.floor(Math.random() * 2) + 2); // 2 or 3 bars
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [state]);

  // Haptic feedback simulation
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

  // Select header state text
  const getStatusText = () => {
    switch (state) {
      case 'calling': return 'Calling...';
      case 'ringing': return 'Ringing...';
      case 'connecting': return 'Connecting...';
      case 'connected': return 'Connected';
      case 'failed': return failureMessage || 'Call failed';
      case 'declined': return 'Call declined';
      case 'missed': return 'Missed call';
      case 'ended': return 'Call ended';
      default: return '';
    }
  };

  // Check if we are showing the incoming call alert modal
  const showIncomingOverlay = direction === 'incoming' && state === 'ringing';

  if (isMinimized) {
    return (
      <div 
        onClick={() => setMinimized(false)}
        className="fixed bottom-24 right-6 z-[99999] hover:scale-105 active:scale-98 transition-all duration-300 pointer-events-auto flex items-center gap-3 p-2 pl-3 pr-2 bg-[#0E1016]/90 backdrop-blur-2xl rounded-full border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.65)] cursor-pointer group animate-fade-in"
      >
        {/* Pulsing indicator & avatar */}
        <div className="relative flex items-center justify-center shrink-0">
          <span className={`absolute inline-flex h-9 w-9 rounded-full opacity-35 ${
            state === 'connected' ? 'bg-emerald-400 animate-ping' : 'bg-pink-400 animate-ping'
          }`} />
          <img 
            src={getAvatarUrl(partnerAvatar, partnerName)} 
            alt="" 
            className="w-8 h-8 rounded-full object-cover border border-white/10"
          />
        </div>
        
        {/* Name and status */}
        <div className="flex flex-col min-w-0 mr-1 select-none font-sans">
          <span className="text-[11px] font-bold tracking-wide text-white truncate max-w-[80px]">
            {partnerName || 'Call'}
          </span>
          <span className={`text-[9px] font-mono leading-none tracking-wider ${
            state === 'connected' ? 'text-emerald-400 font-bold' : 'text-white/60'
          }`}>
            {state === 'connected' ? formatDuration(callDuration) : getStatusText()}
          </span>
        </div>

        {/* Action button inside bubble */}
        <button
          onClick={(e) => {
            e.stopPropagation(); // Avoid triggering maximize
            endCall();
          }}
          className="p-2 bg-rose-500 hover:bg-rose-600 active:scale-90 rounded-full transition-all text-white flex items-center justify-center shadow-md shrink-0"
          title="End Call"
        >
          <PhoneOff size={11} className="fill-white" />
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Styles injected to ensure isolated, ultra-smooth premium animations */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse-wave {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.15); opacity: 0.3; }
          100% { transform: scale(1.35); opacity: 0; }
        }
        @keyframes rotate-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes glow-incoming {
          0%, 100% { box-shadow: 0 0 20px rgba(16, 185, 129, 0.4); }
          50% { box-shadow: 0 0 40px rgba(16, 185, 129, 0.8); }
        }
        @keyframes shake-fail {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
        .animate-pulse-wave-1 { animation: pulse-wave 2.5s infinite ease-out; }
        .animate-pulse-wave-2 { animation: pulse-wave 2.5s infinite ease-out 1.25s; }
        .animate-rotate-slow { animation: rotate-slow 10s infinite linear; }
        .animate-glow-incoming { animation: glow-incoming 2s infinite ease-in-out; }
        .animate-shake-fail { animation: shake-fail 0.4s ease-in-out; }
        .blur-mesh {
          background-image: radial-gradient(at 10% 20%, rgba(255, 20, 147, 0.15) 0px, transparent 50%),
                            radial-gradient(at 90% 80%, rgba(30, 144, 255, 0.15) 0px, transparent 50%);
        }
      `}} />

      {/* Main Full-Screen Calling Portal */}
      <div className={`fixed inset-0 z-[9999] flex flex-col justify-between overflow-hidden bg-[#0A0B10] text-white font-sans ${state === 'failed' ? 'animate-shake-fail' : ''}`}>
        
        {/* Background Layer: Glassy Blurred Mesh or Video Canvas */}
        <div className="absolute inset-0 z-0">
          {isVideo && isCameraOn && state === 'connected' ? (
            // Simulated Active Video Stream Panel (Mesh canvas representing partner view)
            <div className="absolute inset-0 bg-[#0c0d14] overflow-hidden">
              <div className="absolute inset-0 opacity-40 blur-3xl scale-110 blur-mesh"></div>
              {/* Simulated Local/Partner Stream Placeholder */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <img 
                  src={getAvatarUrl(partnerAvatar, partnerName)} 
                  alt="" 
                  className={`w-32 h-32 rounded-full object-cover shadow-2xl transition-all duration-700 ${isFrontCamera ? 'scale-x-[-1]' : ''}`}
                />

              </div>
            </div>
          ) : (
            // Classic Voice calling background with heavy blurred backdrop
            <div className="absolute inset-0 bg-[#08090C] overflow-hidden">
              <div className="absolute inset-0 opacity-20 blur-3xl scale-125 blur-mesh"></div>
              {partnerAvatar && (
                <div 
                  className="absolute inset-0 bg-cover bg-center opacity-[0.08] blur-2xl scale-110"
                  style={{ backgroundImage: `url(${partnerAvatar})` }}
                />
              )}
            </div>
          )}
        </div>

        {/* TOP META BAR (Signal, Encryption, Timer, Cancel) */}
        <div className="relative z-10 flex items-center justify-between px-6 pt-12 pb-4 bg-gradient-to-b from-black/40 to-transparent">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMinimized(true)}
              className="p-2 bg-white/10 hover:bg-emerald-500/30 hover:text-emerald-400 text-white/80 active:scale-90 rounded-full transition-all border border-white/5 flex items-center justify-center shadow-lg backdrop-blur-md"
              title="Minimize call"
              aria-label="Minimize call"
            >
              <Minimize2 size={15} strokeWidth={2.5} />
            </button>
            <div className="flex items-center gap-2 text-xs text-white/60 font-mono">
              <ShieldAlert size={14} className="text-emerald-400" />
              <span>End-to-End Encrypted</span>
            </div>
          </div>
          
          {state === 'connected' && (
            <div className="flex items-center gap-4 bg-black/30 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/5">
              <div className="flex gap-0.5 items-end">
                {[1, 2, 3, 4].map((bar) => (
                  <span 
                    key={bar} 
                    className={`w-1 rounded-sm transition-all duration-300 ${
                      bar <= signalStrength 
                        ? 'bg-emerald-400' 
                        : 'bg-white/20'
                    }`} 
                    style={{ height: `${bar * 3.5 + 4}px` }}
                  />
                ))}
              </div>
              <span className="text-xs font-mono tracking-wider font-semibold text-emerald-400">
                {formatDuration(callDuration)}
              </span>
            </div>
          )}
        </div>

        {/* MIDDLE SECTION: Avatar & Calling State */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
          
          {/* Avatar Area with Pulsing Waves */}
          {(!isVideo || state !== 'connected') && (
            <div className="relative mb-8 flex items-center justify-center">
              {/* Animated audio rings (visible when ringing/calling/connected) */}
              {(state === 'calling' || state === 'ringing' || state === 'connected') && (
                <>
                  <div className="absolute w-44 h-44 rounded-full border border-pink-500/20 animate-pulse-wave-1" />
                  <div className="absolute w-44 h-44 rounded-full border border-pink-500/20 animate-pulse-wave-2" />
                </>
              )}
              
              <div className="relative w-36 h-36 rounded-full overflow-hidden border-2 border-white/10 p-1 bg-[#10111a] shadow-2xl">
                <img 
                  src={getAvatarUrl(partnerAvatar, partnerName)} 
                  alt={partnerName || 'User'} 
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
            </div>
          )}

          {/* Caller / Callee info */}
          <div className="text-center">
            <h2 className="text-2xl font-bold tracking-tight mb-2 drop-shadow-md">
              {partnerName || 'Sparkle User'}
            </h2>
            <div className={`text-sm font-medium tracking-wide transition-all duration-300 ${
              state === 'failed' ? 'text-rose-500' : 'text-white/60'
            }`}>
              {getStatusText()}
            </div>
          </div>
        </div>

        {/* FLOATING MINI PREVIEW (For Video Call Active Connected State) */}
        {isVideo && state === 'connected' && (
          <LocalPreview isCameraOn={isCameraOn} />
        )}

        {/* BOTTOM ACTION BAR (Mute, Speaker, Bluetooth, Decline, Accept buttons) */}
        <div className="relative z-10 px-8 pb-16 pt-8 bg-gradient-to-t from-black/80 to-transparent flex flex-col gap-8">
          
          {/* Incoming Call Layout (Big Green Accept / Red Decline) */}
          {showIncomingOverlay ? (
            <div className="flex items-center justify-around w-full max-w-sm mx-auto animate-fade-in">
              <button 
                onClick={declineCall} 
                className="flex flex-col items-center gap-2 group focus:outline-none"
              >
                <div className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-90 flex items-center justify-center transition-all shadow-[0_4px_20px_rgba(239,68,68,0.4)]">
                  <PhoneOff size={28} className="text-white" />
                </div>
                <span className="text-xs font-semibold text-rose-400 group-hover:text-rose-300">Decline</span>
              </button>

              <button 
                onClick={acceptCall} 
                className="flex flex-col items-center gap-2 group focus:outline-none"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 active:scale-90 flex items-center justify-center transition-all animate-glow-incoming shadow-[0_4px_25px_rgba(16,185,129,0.5)]">
                  <Phone size={28} className="text-white fill-white" />
                </div>
                <span className="text-xs font-semibold text-emerald-400 group-hover:text-emerald-300">Accept</span>
              </button>
            </div>
          ) : (
            // Outgoing / Active Connected Call Layout
            <div className="flex flex-col gap-6 w-full max-w-md mx-auto">
              
              {/* Media Controls (Mute, Speaker, Bluetooth, Camera) */}
              <div className="flex items-center justify-between px-4">
                
                <button 
                  onClick={toggleMute} 
                  className={`flex flex-col items-center gap-1.5 focus:outline-none ${isMuted ? 'text-pink-500' : 'text-white/80'}`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                    isMuted ? 'bg-white text-[#0A0B10]' : 'bg-white/10 hover:bg-white/15'
                  }`}>
                    {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                  </div>
                  <span className="text-[10px] font-medium tracking-wide">Mute</span>
                </button>

                <button 
                  onClick={toggleSpeaker} 
                  className={`flex flex-col items-center gap-1.5 focus:outline-none ${isSpeakerOn ? 'text-emerald-400' : 'text-white/80'}`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                    isSpeakerOn ? 'bg-white text-[#0A0B10]' : 'bg-white/10 hover:bg-white/15'
                  }`}>
                    {isSpeakerOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
                  </div>
                  <span className="text-[10px] font-medium tracking-wide">Speaker</span>
                </button>

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
                    <span className="text-[10px] font-medium tracking-wide">Camera</span>
                  </button>
                ) : (
                  <button 
                    onClick={toggleBluetooth} 
                    className={`flex flex-col items-center gap-1.5 focus:outline-none ${isBluetoothOn ? 'text-indigo-400' : 'text-white/80'}`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 ${
                      isBluetoothOn ? 'bg-white text-[#0A0B10]' : 'bg-white/10 hover:bg-white/15'
                    }`}>
                      <Bluetooth size={20} />
                    </div>
                    <span className="text-[10px] font-medium tracking-wide">Bluetooth</span>
                  </button>
                )}

                {isVideo && (
                  <button 
                    onClick={switchCamera} 
                    className="flex flex-col items-center gap-1.5 focus:outline-none text-white/80"
                  >
                    <div className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center transition-all active:scale-90">
                      <RefreshCw size={20} />
                    </div>
                    <span className="text-[10px] font-medium tracking-wide">Switch</span>
                  </button>
                )}
              </div>

              {/* End Call Button */}
              <div className="flex justify-center mt-2">
                <button 
                  onClick={endCall} 
                  className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-90 flex items-center justify-center transition-all shadow-[0_4px_20px_rgba(239,68,68,0.4)]"
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

