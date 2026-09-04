import React from 'react';
import { MapPin, Shield, Clock, X } from 'lucide-react';

interface LiveLocationIntroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
}

export const LiveLocationIntroModal: React.FC<LiveLocationIntroModalProps> = ({
  isOpen,
  onClose,
  onContinue
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm overflow-hidden bg-[#13131a] border border-white/10 rounded-3xl shadow-2xl p-6 text-white text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Vibrating / Pulsing Location Icon */}
        <div className="relative mx-auto my-4 w-20 h-20 flex items-center justify-center">
          {/* Animated pulse rings */}
          <span className="absolute inset-0 rounded-full bg-[#ff1493]/20 animate-ping" />
          <span className="absolute inset-2 rounded-full bg-[#ff1493]/30 animate-pulse" />
          
          <div className="relative z-10 w-16 h-16 rounded-full bg-gradient-to-tr from-[#ff1493] to-[#ff69b4] flex items-center justify-center shadow-lg shadow-[#ff1493]/40 animate-bounce-short">
            <MapPin className="w-8 h-8 text-white drop-shadow-md" />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold tracking-tight text-white mb-2">
          Share live location
        </h3>

        {/* Body Text */}
        <p className="text-sm leading-relaxed text-white/70 mb-6 px-2">
          Members in this chat will see your live location in real time. This feature shares your location for the duration you choose even if you are not using the app. You can stop sharing at any time.
        </p>

        {/* Feature Badges */}
        <div className="flex items-center justify-center gap-4 text-xs font-semibold text-white/80 mb-6 bg-white/5 py-2.5 px-3 rounded-2xl border border-white/5">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#ff1493]" />
            <span>Time Limited</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-white/30" />
          <div className="flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[#ff1493]" />
            <span>End-to-End Control</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-white/70 bg-white/5 hover:bg-white/10 hover:text-white border border-white/10 active:scale-95 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onContinue}
            className="flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#ff1493] to-[#e0115f] hover:brightness-110 shadow-lg shadow-[#ff1493]/30 active:scale-95 transition-all"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};
