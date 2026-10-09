import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Moon, Sun, SwitchCamera, Image as ImageIcon, Download, Sparkles, Send } from 'lucide-react';
import { getAvatarUrl } from '../../utils/imageUtils';
import { showError } from '../../utils/toast';
import { validateFile } from '../../utils/fileValidation';
import { logger } from '../../utils/logger';
import { useModalA11y } from '../../hooks/useModalA11y';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerName?: string;
  partnerAvatar?: string;
  onSend: (mediaUrl: string, viewMode: 'off' | 'once' | 'twice') => void;
}

const FILTERS = [
  { id: 'normal', name: 'Normal', css: 'none' },
  { id: 'vintage', name: 'Vintage', css: 'sepia(0.6) contrast(1.2)' },
  { id: 'bw', name: 'B&W', css: 'grayscale(1)' },
  { id: 'cyber', name: 'Cyber', css: 'hue-rotate(90deg) saturate(2)' },
  { id: 'dream', name: 'Dream', css: 'blur(1px) brightness(1.2)' },
];

const MODES = ['Normal', 'Text', 'Video', 'Boomerang', 'Selfie'];

export default function CameraModal({ isOpen, onClose, partnerName, partnerAvatar, onSend }: CameraModalProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [capturedMedia, setCapturedMedia] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState('Normal');
  const [activeFilter, setActiveFilter] = useState(FILTERS[0]);
  const [isDark, setIsDark] = useState(true);
  
  // Post-capture states
  const [viewMode, setViewMode] = useState<'off' | 'once' | 'twice'>('off');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const a11yRef = useModalA11y(isOpen, onClose);

  const startCamera = useCallback(async () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
    }
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: false
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err) {
      logger.error("Error accessing camera:", err);
    }
  }, [facingMode]);

  useEffect(() => {
    if (isOpen && !capturedMedia) {
      startCamera();
    } else {
      if (stream) stream.getTracks().forEach(t => t.stop());
    }
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [isOpen, facingMode, capturedMedia]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const takeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Apply filter to context
    ctx.filter = activeFilter.css;
    
    // Mirror if selfie
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedMedia(dataUrl);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const check = validateFile(file, { kind: 'any', maxSizeMB: 10 });
    if (!check.ok) {
      showError(check.error!);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => setCapturedMedia(event.target?.result as string);
    reader.readAsDataURL(file);
  };

  if (!isOpen) return null;

  return (
    <div ref={a11yRef} role="dialog" aria-modal="true" tabIndex={-1} className={`fixed inset-0 z-(--z-modal) flex flex-col overflow-hidden ${isDark ? 'bg-black text-white' : 'bg-white text-black'}`}>
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-50 bg-gradient-to-b from-black/50 to-transparent">
        <button onClick={() => { setCapturedMedia(null); onClose(); }} className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-colors">
          <X size={24} />
        </button>
        <button onClick={() => setIsDark(!isDark)} className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/40 transition-colors">
          {isDark ? <Moon size={22} /> : <Sun size={22} />}
        </button>
      </div>

      {!capturedMedia ? (
        /* CAMERA PREVIEW VIEW */
        <div className="flex-1 relative flex flex-col">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className={`w-full h-full object-cover transition-all duration-300 ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
            style={{ filter: activeFilter.css }}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Filters Overlay */}
          {activeFilter.id !== 'normal' && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/50 backdrop-blur-md px-4 py-2 rounded-full text-white text-sm font-bold z-10 animate-fade-in">
              <Sparkles size={14} className="text-yellow-400" />
              {activeFilter.name}
              <button onClick={() => setActiveFilter(FILTERS[0])} className="ml-2 bg-white/20 rounded-full p-0.5 hover:bg-white/40">
                <X size={12} />
              </button>
            </div>
          )}

          {/* Bottom Controls */}
          <div className="absolute bottom-0 left-0 right-0 px-8 pt-24 pb-[calc(2rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col items-center">
            
            {/* Modes row */}
            <div className="flex gap-5 md:gap-6 overflow-x-auto no-scrollbar mb-8 w-full justify-start sm:justify-center px-4 snap-x">
              {MODES.map(m => (
                <button 
                  key={m} 
                  onClick={() => setActiveMode(m)}
                  className={`text-[11px] md:text-xs font-black tracking-widest uppercase transition-all whitespace-nowrap snap-center shrink-0 ${activeMode === m ? 'text-white scale-110 drop-shadow-md' : 'text-white/50 hover:text-white/80'}`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Filter rings & Capture button */}
            <div className="flex items-center justify-center gap-3 md:gap-4 w-full h-24 mb-6 px-2">
              {/* Left filters */}
              {FILTERS.slice(1, 3).map(f => (
                <button key={f.id} onClick={() => setActiveFilter(f)} className={`w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden border-[3px] shrink-0 transition-all ${activeFilter.id === f.id ? 'border-primary scale-110' : 'border-white/20'}`}>
                  <div className="w-full h-full bg-gradient-to-br from-pink-500 to-purple-500" style={{ filter: f.css }} />
                </button>
              ))}

              {/* Main Snap Button */}
              <button 
                onClick={takeSnapshot}
                className="w-[72px] h-[72px] md:w-20 md:h-20 rounded-full border-[4px] border-white/50 flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-10 shrink-0 mx-1 md:mx-2"
              >
                <div className="w-[60px] h-[60px] md:w-[68px] md:h-[68px] bg-white rounded-full shadow-inner" />
              </button>

              {/* Right filters */}
              {FILTERS.slice(3, 5).map(f => (
                <button key={f.id} onClick={() => setActiveFilter(f)} className={`w-12 h-12 md:w-14 md:h-14 rounded-full overflow-hidden border-[3px] shrink-0 transition-all ${activeFilter.id === f.id ? 'border-primary scale-110' : 'border-white/20'}`}>
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-cyan-500" style={{ filter: f.css }} />
                </button>
              ))}
            </div>

            {/* Bottom Actions Row */}
            <div className="flex justify-between items-center w-full px-4">
              <label className="w-12 h-12 bg-black/30 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/10 hover:bg-black/50 transition-all cursor-pointer">
                <ImageIcon size={22} />
                <input type="file" accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
              </label>
              <button onClick={toggleCamera} className="w-12 h-12 bg-black/30 backdrop-blur-md rounded-2xl flex items-center justify-center text-white border border-white/10 hover:bg-black/50 transition-all">
                <SwitchCamera size={22} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* POST-CAPTURE VIEW */
        <div className="flex-1 relative flex flex-col bg-[#111]">
          <img src={capturedMedia} className="w-full h-full object-contain" alt="Captured" />
          
          {/* Right Tools Panel */}
          <div className="absolute right-4 top-24 flex flex-col gap-4 z-10">
            <button
              onClick={() => {
                const a = document.createElement('a');
                a.href = capturedMedia;
                a.download = 'sparkle-capture.jpg';
                document.body.appendChild(a);
                a.click();
                a.remove();
              }}
              className="w-11 h-11 rounded-full bg-black/40 text-white backdrop-blur-md flex items-center justify-center hover:bg-black/60 transition-all"
              title="Save photo"
            >
              <Download size={20} />
            </button>
          </div>

          {/* Bottom Send Bar */}
          <div className="absolute bottom-0 left-0 right-0 px-6 pt-10 pb-[calc(1.5rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-black/80 to-transparent flex items-end justify-between pointer-events-auto">
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  const nextMode = viewMode === 'off' ? 'once' : viewMode === 'once' ? 'twice' : 'off';
                  setViewMode(nextMode);
                }}
                className="bg-black/50 backdrop-blur-md px-4 py-2 rounded-full text-white text-[11px] font-bold uppercase tracking-widest border border-white/10 w-fit"
              >
                View: {viewMode}
              </button>
            </div>
            
            <button 
              onClick={() => onSend(capturedMedia, viewMode)}
              className="bg-white px-5 py-3 rounded-full text-black font-black flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/20"
            >
              <span className="uppercase text-sm tracking-widest hidden sm:block">Send</span>
              <div className="flex items-center justify-center relative">
                 <img src={getAvatarUrl(partnerAvatar, partnerName)} className="w-7 h-7 rounded-full object-cover border-2 border-white absolute opacity-20 scale-150 blur-sm" />
                 <img src={getAvatarUrl(partnerAvatar, partnerName)} className="w-7 h-7 rounded-full object-cover border border-black z-10" />
              </div>
              <Send size={16} strokeWidth={3} className="ml-1" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
