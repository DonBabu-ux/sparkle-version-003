import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ShieldCheck, Camera, Upload, Check, 
  ChevronRight, AlertCircle, Loader2, Frame
} from 'lucide-react';
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import api from '../../api/api';

interface IdentityVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (data: any) => void;
}

type Step = 'intro' | 'id-upload' | 'selfie' | 'processing' | 'success';

export default function IdentityVerificationModal({ isOpen, onClose, onComplete }: IdentityVerificationModalProps) {
  const [step, setStep] = useState<Step>('intro');
  const [idFront, setIdFront] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const takePhoto = async (type: 'id' | 'selfie') => {
    try {
      const image = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });

      if (type === 'id') setIdFront(image.dataUrl || null);
      else setSelfie(image.dataUrl || null);
    } catch (err) {
      console.error('Camera error:', err);
    }
  };

  const startProcessing = async () => {
    setStep('processing');
    setIsProcessing(true);
    
    try {
      // Post to the real verification API
      await api.post('/marketplace/verification/submit', {
        id_front_url: idFront,
        selfie_url: selfie
      });
      
      // Keep a small minimum delay for UX (AI analysis simulation)
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
            'Data is encrypted & secure'
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
          onClick={() => takePhoto('id')}
          className={`aspect-[1.58/1] rounded-[32px] border-4 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden ${idFront ? 'border-primary bg-primary/5' : 'border-black/5 bg-black/5 hover:border-primary/30'}`}
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
          <p className="text-xs font-bold text-amber-700/80 leading-relaxed">Ensure the text is clear and the entire ID is within the frame.</p>
        </div>
        <button
          disabled={!idFront}
          onClick={() => setStep('selfie')}
          className={`w-full py-5 rounded-[22px] font-black text-sm transition-all uppercase tracking-widest ${idFront ? 'bg-primary text-white shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]' : 'bg-black/5 text-black/20'}`}
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
          onClick={() => takePhoto('selfie')}
          className={`aspect-square max-w-[280px] mx-auto rounded-full border-4 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden ${selfie ? 'border-primary bg-primary/5' : 'border-black/5 bg-black/5 hover:border-primary/30'}`}
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
          className={`w-full py-5 rounded-[22px] font-black text-sm transition-all uppercase tracking-widest ${selfie ? 'bg-primary text-white shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98]' : 'bg-black/5 text-black/20'}`}
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
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
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
              animate={{ width: "100%" }}
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
          <p className="text-black/40 font-medium text-sm leading-relaxed max-w-[280px] mx-auto">Your identity is being reviewed. You'll receive your badge within 24 hours.</p>
        </div>
        <button
          onClick={onClose}
          className="w-full py-5 bg-black text-white rounded-[22px] font-black text-sm shadow-xl shadow-black/10 hover:scale-[1.02] transition-all active:scale-95 uppercase tracking-widest"
        >
          Back to Shop
        </button>
      </div>
    )
  };

  return (
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
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.15, ease: "easeOut" }}
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
  );
}

