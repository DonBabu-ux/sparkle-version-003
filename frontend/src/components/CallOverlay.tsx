import React from 'react';
import { useCall } from './MockCallProvider';
import { X, Mic, MicOff, Camera, CameraOff, Volume2, VolumeX } from 'lucide-react';

type CallState =
  | 'idle'
  | 'calling'
  | 'ringing'
  | 'connecting'
  | 'connected'
  | 'failed'
  | 'declined'
  | 'missed'
  | 'ended';

export const CallOverlay = () => {
  const {
    mode,
    direction,
    state,
    toggleMute,
    toggleSpeaker,
    toggleCamera,
    endCall,
    isMuted,
    isSpeakerOn,
    isCameraOn,
  } = useCall();

  if (state === 'idle' || state === 'ended') return null;

  const isVideo = mode === 'video';
  const statusMap: Record<CallState, string> = {
    calling: 'Calling...',
    ringing: direction === 'incoming' ? 'Incoming call' : 'Ringing...',
    connecting: 'Connecting...',
    connected: 'Connected',
    failed: 'Call failed',
    declined: 'Call declined',
    missed: 'Missed call',
    ended: '',
    idle: '',
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50 animate-fade-in">
      <div className="relative bg-white dark:bg-[#000000] rounded-xl p-6 w-80 sm:w-96 flex flex-col items-center gap-4">
        <div className="text-lg font-medium">{statusMap[state]}</div>
        {isVideo && state === 'connected' && (
          <div className="w-full h-48 bg-gray-200 dark:bg-gray-800 rounded-md flex items-center justify-center">
            <span className="text-sm text-gray-500">Video Stream</span>
          </div>
        )}
        <div className="flex gap-4">
          <button className="premium-btn" onClick={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <button className="premium-btn" onClick={toggleSpeaker} aria-label={isSpeakerOn ? 'Speaker off' : 'Speaker on'}>
            {isSpeakerOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
          {isVideo && (
            <button className="premium-btn" onClick={toggleCamera} aria-label={isCameraOn ? 'Camera off' : 'Camera on'}>
              {isCameraOn ? <Camera size={20} /> : <CameraOff size={20} />}
            </button>
          )}
          <button className="premium-btn" onClick={endCall} aria-label="End call">
            <X size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
