import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ShieldCheck, Camera, Check,
  AlertCircle, Loader2, Frame, SwitchCamera, ImageIcon
} from 'lucide-react';
import api from '../../api/api';

// ─────────────────────────────────────────────────────────────────────────────
// InAppCaptureModal
// Fully in-app live camera capture using navigator.mediaDevices.getUserMedia.
// Never triggers a system camera intent or leaves the Sparkle app.
// ─────────────────────────────────────────────────────────────────────────────
interface InAppCaptureModalProps {
  mode: 'id' | 'selfie';
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}

function InAppCaptureModal({ mode, onCapture, onClose }: InAppCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(
    mode === 'selfie' ? 'user' : 'environment'
  );
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start (or restart) the camera stream for the given facing mode
  const startStream = useCallback(async (facing: 'user' | 'environment') => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setReady(false);
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        videoRef.current.onloadedmetadata = () => setReady(true);
      }
    } catch (err) {
      console.error('[InAppCamera] stream error:', err);
      setError('Camera unavailable. Please grant camera permission or pick from gallery.');
    }
  }, []);

  useEffect(() => {
    startStream(facingMode);
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, [facingMode, startStream]);

  const handleFlip = () =>
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));

  // Canvas snapshot — never triggers system camera
  const handleSnap = () => {
    if (!videoRef.current || !ready) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Mirror front camera so selfies look natural
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    streamRef.current?.getTracks().forEach(t => t.stop());
    onCapture(dataUrl);
  };

  // Gallery file picker — opens the Android photo picker, NOT a camera intent
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      onCapture(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleClose = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[600] bg-black flex flex-col overflow-hidden"
    >
      {/* ── Top Bar ── */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-5 bg-gradient-to-b from-black/70 to-transparent safe-area-top">
        <button
          onClick={handleClose}
          className="w-11 h-11 bg-black/30 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white active:scale-90 transition-all"
        >
          <X size={22} strokeWidth={2.5} />
        </button>
        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">
          {mode === 'selfie' ? 'Selfie Capture' : 'ID Scan'}
        </span>
        <button
          onClick={handleFlip}
          className="w-11 h-11 bg-black/30 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center text-white active:scale-90 transition-all"
        >
          <SwitchCamera size={20} strokeWidth={2.5} />
        </button>
      </div>

      {/* ── Live Preview ── */}
      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-zinc-950 p-8 text-center">
            <AlertCircle size={44} className="text-amber-400" />
            <p className="text-white/60 text-sm font-bold leading-relaxed max-w-xs">{error}</p>
            <label className="mt-2 h-14 px-8 bg-white/10 border border-white/20 rounded-full flex items-center gap-3 text-white text-sm font-black uppercase tracking-widest cursor-pointer active:scale-95 transition-all">
              <ImageIcon size={18} />
              Pick from Gallery
              <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            </label>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
          />
        )}

        {/* Guide frame overlay */}
        {!error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className={`relative border-2 border-white/30 ${
                mode === 'id'
                  ? 'w-[78%] h-[44%] rounded-2xl'
                  : 'w-[62%] aspect-square rounded-full'
              }`}
            >
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-white rounded-tl-2xl -translate-x-0.5 -translate-y-0.5" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-white rounded-tr-2xl translate-x-0.5 -translate-y-0.5" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-white rounded-bl-2xl -translate-x-0.5 translate-y-0.5" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-white rounded-br-2xl translate-x-0.5 translate-y-0.5" />
            </div>
            {/* Instruction label */}
            <span className="absolute bottom-[30%] text-[10px] font-black uppercase tracking-widest text-white/50 bg-black/30 backdrop-blur-md px-4 py-1.5 rounded-full">
              {mode === 'id' ? 'Place ID within frame' : 'Centre your face'}
            </span>
          </div>
        )}
      </div>

      {/* ── Capture Controls ── */}
      <div className="absolute bottom-0 left-0 right-0 p-8 pb-14 flex items-center justify-center gap-10 bg-gradient-to-t from-black/90 to-transparent safe-area-bottom">
        {/* Gallery shortcut */}
        <label className="w-14 h-14 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center text-white cursor-pointer active:scale-90 transition-all">
          <ImageIcon size={22} />
          <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
        </label>

        {/* Shutter button */}
        <button
          onClick={handleSnap}
          disabled={!ready}
          className="w-20 h-20 rounded-full border-[5px] border-white flex items-center justify-center active:scale-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <div className={`rounded-full transition-all duration-150 ${ready ? 'w-14 h-14 bg-white' : 'w-10 h-10 bg-white/40'}`} />
        </button>

        {/* Spacer */}
        <div className="w-14 h-14" />
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// IdentityVerificationModal
// ─────────────────────────────────────────────────────────────────────────────
interface IdentityVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: any) => void;
}

type Step = 'intro' | 'id-upload' | 'selfie' | 'processing' | 'success';

export default function IdentityVerificationModal({
  isOpen,
  onClose,
  onComplete,
}: IdentityVerificationModalProps) {
  const [step, setStep] = useState<Step>('intro');
  const [idFront, setIdFront] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  // Which in-app camera view is active: null = none, 'id' | 'selfie' = open
  const [activeCam, setActiveCam] = useState<'id' | 'selfie' | null>(null);

  const startProcessing = async () => {
    setStep('processing');
    setIsProcessing(true);
    try {
      await api.post('/marketplace/verification/submit', {
        id_front_url: idFront,
        selfie_url: selfie,
      });
      setTimeout(() => {
        setIsProcessing(false);
        setStep('success');
      }, 2500);
    } catch (err) {
      console.error('Verification failed:', err);
      alert('Verification failed. Please try again.');
      setStep('intro');
      setIsProcessing(false);
    }
  };

  const steps = {
    intro: (
      <div className="space-y-6">
        <div className="w-24 h-24 bg-primary/5 rounded-full flex items-center justify-center mx-auto border border-primary/10">
          <ShieldCheck size={48} className="text-primary" strokeWidth={1.5} />
        </div>
        <div className="text-center">
          <h3 className="text-3xl font-black tracking-tight italic mb-2">Get Verified</h3>
          <p className="text-black/40 font-medium text-sm">Boost your trust by 85% with our secure identity check.</p>
        </div>
        <div className="space-y-3">
          {[
            'Official government ID required',
            'Live selfie for face matching',
            'Data is encrypted & secure',
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-4 bg-black/5 p-5 rounded-[24px] border border-white">
              <div className="w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center text-xs font-black italic shadow-lg shadow-primary/20">
                {i + 1}
              </div>
              <span className="text-sm font-bold text-black/70">{text}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => setStep('id-upload')}
          className="w-full py-5 bg-black text-white rounded-[22px] font-black text-sm shadow-xl shadow-black/10 hover:scale-[1.02] active:scale-[0.98] transition-all uppercase tracking-widest"
        >
          Start Verification
        </button>
      </div>
    ),
    'id-upload': (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-3xl font-black tracking-tight italic mb-2">Scan Your ID</h3>
          <p className="text-black/40 font-medium text-sm">Front of National ID or Passport</p>
        </div>
        <div
          onClick={() => setActiveCam('id')}
          className={`aspect-[1.58/1] rounded-[32px] border-4 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden ${
            idFront ? 'border-primary bg-primary/5' : 'border-black/5 bg-black/5 hover:border-primary/30'
          }`}
        >
          {idFront ? (
            <img src={idFront} className="w-full h-full object-cover" alt="ID Front" />
          ) : (
            <>
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-md mb-4 text-black/20">
                <Camera size={32} strokeWidth={2.5} />
              </div>
              <span className="text-sm font-black text-black/20 uppercase tracking-widest">Tap to Capture</span>
            </>
          )}
        </div>
        <div className="bg-amber-50 p-5 rounded-[24px] border border-amber-100 flex gap-4">
          <AlertCircle size={22} className="text-amber-600 shrink-0" />
          <p className="text-xs font-bold text-amber-700/80 leading-relaxed">
            Ensure the text is clear and the entire ID is within the frame.
          </p>
        </div>
        <button
          disabled={!idFront}
          onClick={() => setStep('selfie')}
          className={`w-full py-5 rounded-[22px] font-black text-sm transition-all uppercase tracking-widest ${
            idFront
              ? 'bg-primary text-white shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-black/5 text-black/20'
          }`}
        >
          Next Step
        </button>
      </div>
    ),
    selfie: (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-3xl font-black tracking-tight italic mb-2">Liveness Check</h3>
          <p className="text-black/40 font-medium text-sm">Take a clear selfie to match with your ID</p>
        </div>
        <div
          onClick={() => setActiveCam('selfie')}
          className={`aspect-square max-w-[280px] mx-auto rounded-full border-4 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden ${
            selfie ? 'border-primary bg-primary/5' : 'border-black/5 bg-black/5 hover:border-primary/30'
          }`}
        >
          {selfie ? (
            <img src={selfie} className="w-full h-full object-cover" alt="Selfie" />
          ) : (
            <>
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-md mb-4 text-black/20">
                <Frame size={32} strokeWidth={2.5} />
              </div>
              <span className="text-sm font-black text-black/20 uppercase tracking-widest">Tap to Capture</span>
            </>
          )}
        </div>
        <button
          disabled={!selfie}
          onClick={startProcessing}
          className={`w-full py-5 rounded-[22px] font-black text-sm transition-all uppercase tracking-widest ${
            selfie
              ? 'bg-primary text-white shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]'
              : 'bg-black/5 text-black/20'
          }`}
        >
          Submit for Review
        </button>
      </div>
    ),
    processing: (
      <div className="py-12 space-y-8 flex flex-col items-center">
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-32 h-32 border-4 border-primary/10 border-t-primary rounded-full shadow-inner"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={40} className="text-primary animate-pulse" />
          </div>
        </div>
        <div className="text-center">
          <h3 className="text-3xl font-black tracking-tight italic mb-2">Analyzing Data</h3>
          <p className="text-black/40 font-medium text-sm">Our AI is matching your selfie with your ID...</p>
        </div>
        <div className="w-full max-w-xs space-y-3">
          <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden shadow-inner">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '100%' }}
              transition={{ duration: 4 }}
              className="h-full bg-primary shadow-lg shadow-primary/20"
            />
          </div>
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-black/20">
            <span>Face Match</span>
            <span>Spoof Check</span>
            <span>OCR</span>
          </div>
        </div>
      </div>
    ),
    success: (
      <div className="space-y-8 flex flex-col items-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-28 h-28 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/30"
        >
          <Check size={56} strokeWidth={4} />
        </motion.div>
        <div className="text-center">
          <h3 className="text-3xl font-black tracking-tight italic mb-2">Verification Sent!</h3>
          <p className="text-black/40 font-medium text-sm leading-relaxed max-w-[280px] mx-auto">
            Your identity is being reviewed. You'll receive your badge within 24 hours.
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-full py-5 bg-black text-white rounded-[22px] font-black text-sm shadow-xl shadow-black/10 hover:scale-[1.02] transition-all active:scale-95 uppercase tracking-widest"
        >
          Back to Shop
        </button>
      </div>
    ),
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/40 backdrop-blur-md z-[250]"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.15, ease: 'easeOut' }}
              className="fixed inset-x-0 bottom-0 bg-white/95 backdrop-blur-3xl rounded-t-[48px] z-[251] px-8 pt-10 pb-12 max-w-lg mx-auto border-t border-white"
            >
              <div className="flex justify-center mb-8">
                <div className="w-14 h-1.5 bg-black/5 rounded-full" />
              </div>
              {steps[step]}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* In-app camera overlay — rendered at root level so it covers everything */}
      <AnimatePresence>
        {activeCam && (
          <InAppCaptureModal
            key={activeCam}
            mode={activeCam}
            onCapture={(dataUrl) => {
              if (activeCam === 'id') setIdFront(dataUrl);
              else setSelfie(dataUrl);
              setActiveCam(null);
            }}
            onClose={() => setActiveCam(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
