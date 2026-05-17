import React from 'react';
import { Camera, Mic, ShieldAlert, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface CameraPermissionsManagerProps {
  onRequestPermission: () => void;
}

export default function CameraPermissionsManager({ onRequestPermission }: CameraPermissionsManagerProps) {
  return (
    <div className="absolute inset-0 bg-[#070708] flex items-center justify-center p-8 z-[300] overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[60%] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[80%] h-[60%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[40px] p-8 md:p-10 flex flex-col items-center text-center relative overflow-hidden shadow-2xl"
      >
        {/* Decorative elements */}
        <div className="absolute top-4 right-4 text-purple-400/20">
          <Sparkles size={24} />
        </div>

        {/* Feature Icon Header */}
        <div className="flex gap-4 mb-8">
          <div className="w-16 h-16 rounded-[24px] bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center text-white shadow-xl shadow-purple-500/20">
            <Camera size={28} strokeWidth={2.5} />
          </div>
          <div className="w-16 h-16 rounded-[24px] bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white shadow-xl shadow-rose-500/20">
            <Mic size={28} strokeWidth={2.5} />
          </div>
        </div>

        {/* Header Text */}
        <h2 className="text-[24px] md:text-[26px] font-black italic uppercase tracking-tight text-white mb-3">
          Capture Your Sparkle
        </h2>
        
        <p className="text-[13px] md:text-[14px] font-bold text-white/50 leading-relaxed mb-8 max-w-xs">
          Enable camera and microphone access to record premium stories, moments, and chat attachments directly in the app.
        </p>

        {/* Feature List */}
        <div className="w-full space-y-4 mb-10 text-left bg-white/[0.02] border border-white/5 rounded-3xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 shrink-0">
              <Camera size={16} />
            </div>
            <div>
              <h4 className="text-[12px] font-black uppercase italic tracking-wide text-white/80">In-App Camera Capture</h4>
              <p className="text-[10px] font-bold text-white/40 mt-0.5">Snap fullscreen photos and apply live vintage filters instantly.</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 shrink-0">
              <Mic size={16} />
            </div>
            <div>
              <h4 className="text-[12px] font-black uppercase italic tracking-wide text-white/80">Immersive Video Recording</h4>
              <p className="text-[10px] font-bold text-white/40 mt-0.5">Record seamless 1080p clips and share reels without exits.</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <button 
          onClick={onRequestPermission}
          className="w-full h-16 bg-white text-black hover:bg-white/90 active:scale-[0.98] transition-all rounded-full font-black italic uppercase tracking-tight text-sm flex items-center justify-center gap-2 shadow-lg"
        >
          <span>Grant Access</span>
          <Sparkles size={16} fill="currentColor" />
        </button>

        <div className="flex items-center gap-2 justify-center text-[10px] font-bold text-white/30 uppercase tracking-widest mt-6">
          <ShieldAlert size={12} />
          <span>Encrypted Sandbox Sandbox Sandbox Permissions</span>
        </div>
      </motion.div>
    </div>
  );
}
