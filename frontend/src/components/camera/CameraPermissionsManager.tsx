import React from 'react';
import { Camera, Mic, ShieldAlert, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface CameraPermissionsManagerProps {
  onRequestPermission: () => void;
}

export default function CameraPermissionsManager({ onRequestPermission }: CameraPermissionsManagerProps) {
  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center p-6 z-[300] overflow-hidden font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[360px] bg-[#1C1C1E] border border-[#2C2C2E] rounded-[28px] p-6 flex flex-col items-center shadow-2xl relative"
      >
        {/* App Icon Representation */}
        <div className="w-14 h-14 bg-[#0A84FF] rounded-[14px] flex items-center justify-center text-white mb-5 shadow-lg relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent" />
          <Sparkles size={28} className="text-white drop-shadow" />
        </div>

        {/* Header Text */}
        <h2 className="text-[19px] font-semibold text-white tracking-tight leading-snug text-center px-2 mb-2">
          “Sparkle” Would Like to Access the Camera & Microphone
        </h2>

        <p className="text-[13px] text-[#8E8E93] leading-relaxed text-center mb-6 px-3">
          This allows you to capture photos, record videos, and share your sparkles instantly.
        </p>

        {/* Feature List (iOS Style Settings Row) */}
        <div className="w-full bg-[#2C2C2E]/50 rounded-[18px] border border-[#2C2C2E] p-4 space-y-4 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-[#2C2C2E] flex items-center justify-center text-[#0A84FF] shrink-0">
              <Camera size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-[13px] font-medium text-white">In-App Camera Capture</h4>
              <p className="text-[11px] text-[#8E8E93] mt-0.5 truncate">Snap full-screen photos and live filters.</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-[#2C2C2E] flex items-center justify-center text-[#FF453A] shrink-0">
              <Mic size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-[13px] font-medium text-white">Immersive Video Recording</h4>
              <p className="text-[11px] text-[#8E8E93] mt-0.5 truncate">Record seamless clips and voice attachments.</p>
            </div>
          </div>
        </div>

        {/* Action Buttons (iOS Alert Style) */}
        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={onRequestPermission}
            className="w-full h-12 bg-[#0A84FF] hover:bg-[#0A84FF]/90 active:scale-[0.98] transition-all rounded-[12px] font-semibold text-[15px] text-white flex items-center justify-center shadow-md"
          >
            Allow
          </button>

          <button
            onClick={() => window.history.back()}
            className="w-full h-12 bg-[#2C2C2E]/60 hover:bg-[#2C2C2E] active:scale-[0.98] transition-all rounded-[12px] font-medium text-[15px] text-[#8E8E93] flex items-center justify-center"
          >
            Don’t Allow
          </button>
        </div>

        {/* Footer info (Highly High-Contrast & Visible) */}
        <div className="flex items-center gap-2 justify-center text-[11px] font-bold text-zinc-100 lowercase tracking-widest mt-5 bg-[#2C2C2E] px-4 py-2 rounded-full border border-white/5">
          <ShieldAlert size={14} className="text-[#30D158] fill-[#30D158]/10 animate-pulse" />
          <span>Encrypted Sandbox Permissions</span>
        </div>
      </motion.div>
    </div>
  );
}
