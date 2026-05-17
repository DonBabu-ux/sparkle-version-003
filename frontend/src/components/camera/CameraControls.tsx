import React from 'react';
import { 
  Zap, RotateCw, Image as ImageIcon, Sparkles, X, 
  Grid3X3, Square, RectangleHorizontal, Timer as TimerIcon, Gauge,
  Volume2, VolumeX, Clapperboard, Radio, LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CameraControlsProps {
  mode: 'post' | 'story' | 'reel' | 'live';
  onModeChange: (mode: 'post' | 'story' | 'reel' | 'live') => void;
  flash: boolean;
  onFlashToggle: () => void;
  cameraType: 'front' | 'back';
  onCameraTypeToggle: () => void;
  onGalleryClick: () => void;
  onCapture: () => void;
  
  // Custom states
  isRecording: boolean;
  recordingSeconds: number;
  cameraTimer: 0 | 3 | 10;
  onTimerToggle: () => void;
  cameraSpeed: '1x' | '2x' | '0.5x';
  onSpeedToggle: () => void;
  cameraLayout: 'standard' | 'grid';
  onLayoutToggle: () => void;
  isMagicOn: boolean;
  onMagicToggle: () => void;
  isWideAspect: boolean;
  onRatioToggle: () => void;
  
  // Filters list
  filters: { id: string; name: string; css: string }[];
  activeFilter: { id: string; name: string; css: string };
  onFilterChange: (filter: { id: string; name: string; css: string }) => void;
  
  // Close / Exit
  onClose: () => void;
}

export default function CameraControls({
  mode,
  onModeChange,
  flash,
  onFlashToggle,
  cameraType,
  onCameraTypeToggle,
  onGalleryClick,
  onCapture,
  
  isRecording,
  recordingSeconds,
  cameraTimer,
  onTimerToggle,
  cameraSpeed,
  onSpeedToggle,
  cameraLayout,
  onLayoutToggle,
  isMagicOn,
  onMagicToggle,
  isWideAspect,
  onRatioToggle,
  
  filters,
  activeFilter,
  onFilterChange,
  onClose
}: CameraControlsProps) {

  // Format recording timer: 00:00
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none flex flex-col justify-between z-40 select-none">
      
      {/* 1. TOP UTILITY HEADER BAR */}
      <div className="w-full p-6 pt-14 flex items-center justify-between pointer-events-auto bg-gradient-to-b from-black/60 to-transparent">
        <button 
          onClick={onClose} 
          className="w-12 h-12 bg-black/30 backdrop-blur-3xl border border-white/10 rounded-full flex items-center justify-center text-white active:scale-95 transition-all shadow-lg"
        >
          <X size={22} strokeWidth={2.5} />
        </button>

        {isRecording && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2 bg-rose-500 px-4 py-2 rounded-full text-white font-black italic uppercase tracking-wider text-xs shadow-lg shadow-rose-500/20"
          >
            <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
            <span>REC {formatTimer(recordingSeconds)}</span>
          </motion.div>
        )}

        <button 
          onClick={onFlashToggle} 
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg border border-white/10 ${flash ? 'bg-yellow-400 text-black border-yellow-400' : 'bg-black/30 text-white'}`}
        >
          <Zap size={18} fill={flash ? "currentColor" : "none"} strokeWidth={2.5} />
        </button>
      </div>

      {/* 2. LEFT FLT ACTIONS TOOLBAR */}
      <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-5 pointer-events-auto z-40">
        <AnimatePresence mode="wait">
          {mode === 'reel' && (
            <motion.div 
              key="reel-tools"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="flex flex-col gap-5"
            >
              <button 
                onClick={onTimerToggle} 
                className={`camera-tool-btn ${cameraTimer > 0 ? 'text-yellow-400' : ''}`}
              >
                <div className="relative">
                  <TimerIcon size={20} strokeWidth={2.5} />
                  {cameraTimer > 0 && (
                    <span className="absolute -top-2 -right-2 bg-yellow-400 text-black text-[8px] px-1 rounded-full font-black">
                      {cameraTimer}s
                    </span>
                  )}
                </div>
                <span>Timer</span>
              </button>

              <button 
                onClick={onSpeedToggle} 
                className={`camera-tool-btn ${cameraSpeed !== '1x' ? 'text-blue-400' : ''}`}
              >
                <Gauge size={20} strokeWidth={2.5} />
                <span>{cameraSpeed}</span>
              </button>

              <button 
                onClick={onLayoutToggle} 
                className={`camera-tool-btn ${cameraLayout === 'grid' ? 'text-purple-400' : ''}`}
              >
                <LayoutGrid size={20} strokeWidth={2.5} />
                <span>Grid</span>
              </button>

              <button 
                onClick={onMagicToggle} 
                className={`camera-tool-btn ${isMagicOn ? 'text-pink-400' : ''}`}
              >
                <Sparkles size={20} fill={isMagicOn ? "currentColor" : "none"} strokeWidth={2.5} />
                <span>Magic</span>
              </button>
            </motion.div>
          )}

          {mode === 'post' && (
            <motion.div 
              key="post-tools"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              className="flex flex-col gap-5"
            >
              <button 
                onClick={onLayoutToggle} 
                className={`camera-tool-btn ${cameraLayout === 'grid' ? 'text-blue-400' : ''}`}
              >
                <Grid3X3 size={20} strokeWidth={2.5} />
                <span>Grid</span>
              </button>

              <button 
                onClick={onRatioToggle} 
                className={`camera-tool-btn ${isWideAspect ? 'text-amber-400' : ''}`}
              >
                {isWideAspect ? <RectangleHorizontal size={20} strokeWidth={2.5} /> : <Square size={20} strokeWidth={2.5} />}
                <span>Ratio</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 3. DYNAMIC FILTER SELECTOR OVER PREVIEW FOOTER */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-3 pointer-events-auto z-40">
        <span className="text-[7px] font-black uppercase tracking-widest text-white/40 text-center select-none rotate-90 mb-4">Filters</span>
        {filters.map(f => (
          <button 
            key={f.id} 
            onClick={() => onFilterChange(f)} 
            className={`w-11 h-11 rounded-full overflow-hidden border-[3px] shrink-0 transition-all shadow-lg active:scale-95 ${activeFilter.id === f.id ? 'border-purple-500 scale-110 shadow-purple-500/20' : 'border-white/10'}`}
          >
            <div 
              className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-[10px] font-black text-white"
              style={{ filter: f.css }}
            >
              {f.name[0]}
            </div>
          </button>
        ))}
      </div>

      {/* 4. MAIN INTERACTIVE SHUTTER SLATE FOOTER */}
      <div className="w-full p-10 pb-20 flex flex-col items-center gap-8 pointer-events-auto bg-gradient-to-t from-black/90 via-black/40 to-transparent">
        
        {/* Shutter Ring Controls row */}
        <div className="flex items-center gap-14 z-50">
          {/* Gallery Shortcut Button */}
          <button 
            onClick={onGalleryClick} 
            className="w-12 h-12 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center active:scale-90 transition-all shadow-xl hover:bg-white/20"
          >
            <ImageIcon size={20} className="text-white/60" />
          </button>

          {/* Shutter Capture Button */}
          <button 
            onClick={onCapture}
            className="relative w-24 h-24 flex items-center justify-center group active:scale-95 transition-transform"
          >
            {/* Pulsing ring outline */}
            <div 
              className={`absolute inset-0 rounded-full border-[6px] transition-all duration-300 ${
                isRecording 
                  ? 'scale-125 border-rose-500' 
                  : mode === 'post' 
                    ? 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)]' 
                    : mode === 'reel' 
                      ? 'border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.4)]' 
                      : 'border-white shadow-[0_0_20px_rgba(255,255,255,0.2)]'
              }`} 
            />
            {/* Center dot */}
            <div 
              className={`w-18 h-18 rounded-full transition-all duration-300 ${
                isRecording 
                  ? 'scale-50 rounded-2xl bg-rose-500' 
                  : mode === 'post' 
                    ? 'bg-blue-500' 
                    : mode === 'reel' 
                      ? 'bg-rose-500' 
                      : 'bg-white'
              }`} 
            />
          </button>

          {/* Camera Type Switcher (Front/Back Rotate) */}
          <button 
            onClick={onCameraTypeToggle} 
            className="w-12 h-12 bg-white/10 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white active:scale-90 transition-all shadow-xl hover:bg-white/20"
          >
            <RotateCw size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Scrollable Camera Modes Row */}
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-2 px-24 mask-fade-edges relative max-w-xs sm:max-w-md w-full justify-center">
          {['post', 'story', 'reel', 'live'].map((m) => (
            <button 
              key={m} 
              onClick={() => onModeChange(m as any)} 
              className={`text-[11px] font-black uppercase tracking-[0.2em] transition-all shrink-0 ${mode === m ? 'text-white scale-125 drop-shadow-[0_2px_4px_rgba(255,255,255,0.2)]' : 'text-white/40 hover:text-white/60'}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
