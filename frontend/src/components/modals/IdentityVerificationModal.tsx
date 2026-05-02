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
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
          <ShieldCheck size={40} className="text-blue-600" />
        </div>
        <div className="text-center">
          <h3 className="text-2xl font-black tracking-tighter mb-2">Get Verified</h3>
          <p className="text-slate-500 font-bold text-sm">Boost your seller trust by 85% with our secure identity verification.</p>
        </div>
        <div className="space-y-3">
          {[
            'Official government ID required',
            'Live selfie for face matching',
            'Data is encrypted & secure'
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-black">
                {i + 1}
              </div>
              <span className="text-sm font-black text-slate-700">{text}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => setStep('id-upload')}
          className="w-full py-4 bg-marketplace-text text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-200 hover:scale-105 transition-all active:scale-95"
        >
          Start Verification
        </button>
      </div>
    ),
    'id-upload': (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-2xl font-black tracking-tighter mb-2">Scan Your ID</h3>
          <p className="text-slate-500 font-bold text-sm">Front of National ID or Passport</p>
        </div>
        <div 
          onClick={() => takePhoto('id')}
          className={`aspect-[1.58/1] rounded-[24px] border-4 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden ${idFront ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
        >
          {idFront ? (
            <img src={idFront} className="w-full h-full object-cover" alt="ID Front" />
          ) : (
            <>
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                <Camera size={32} className="text-slate-400" />
              </div>
              <span className="text-sm font-black text-slate-400">Tap to Capture</span>
            </>
          )}
        </div>
        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 flex gap-3">
          <AlertCircle size={20} className="text-amber-600 flex-shrink-0" />
          <p className="text-xs font-bold text-amber-700">Ensure the text is clear and the entire ID is within the frame.</p>
        </div>
        <button
          disabled={!idFront}
          onClick={() => setStep('selfie')}
          className={`w-full py-4 rounded-2xl font-black text-sm transition-all ${idFront ? 'bg-marketplace-text text-white shadow-xl shadow-slate-200 hover:scale-105 active:scale-95' : 'bg-slate-100 text-slate-400'}`}
        >
          Next Step
        </button>
      </div>
    ),
    selfie: (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-2xl font-black tracking-tighter mb-2">Liveness Check</h3>
          <p className="text-slate-500 font-bold text-sm">Take a clear selfie to match with your ID</p>
        </div>
        <div 
          onClick={() => takePhoto('selfie')}
          className={`aspect-square max-w-[280px] mx-auto rounded-full border-4 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer overflow-hidden ${selfie ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
        >
          {selfie ? (
            <img src={selfie} className="w-full h-full object-cover" alt="Selfie" />
          ) : (
            <>
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
                <Frame size={32} className="text-slate-400" />
              </div>
              <span className="text-sm font-black text-slate-400">Tap to Capture</span>
            </>
          )}
        </div>
        <button
          disabled={!selfie}
          onClick={startProcessing}
          className={`w-full py-4 rounded-2xl font-black text-sm transition-all ${selfie ? 'bg-marketplace-text text-white shadow-xl shadow-slate-200 hover:scale-105 active:scale-95' : 'bg-slate-100 text-slate-400'}`}
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
            className="w-32 h-32 border-4 border-blue-100 border-t-blue-600 rounded-full"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={40} className="text-blue-600 animate-pulse" />
          </div>
        </div>
        <div className="text-center">
          <h3 className="text-2xl font-black tracking-tighter mb-2">Analyzing Data</h3>
          <p className="text-slate-500 font-bold text-sm">Our AI is matching your selfie with your government ID...</p>
        </div>
        <div className="w-full max-w-xs space-y-2">
          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 4 }}
              className="h-full bg-blue-600"
            />
          </div>
          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span>Face Match</span>
            <span>Spoof Check</span>
            <span>OCR</span>
          </div>
        </div>
      </div>
    ),
    success: (
      <div className="space-y-6 flex flex-col items-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-24 h-24 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-200"
        >
          <Check size={48} strokeWidth={3} />
        </motion.div>
        <div className="text-center">
          <h3 className="text-2xl font-black tracking-tighter mb-2">Verification Sent!</h3>
          <p className="text-slate-500 font-bold text-sm">Your identity is being reviewed. You'll receive your blue badge within 24 hours.</p>
        </div>
        <button
          onClick={onClose}
          className="w-full py-4 bg-marketplace-text text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-200 hover:scale-105 transition-all active:scale-95"
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[250]"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 bg-white rounded-t-[40px] z-[251] px-6 pt-8 pb-10 max-w-lg mx-auto"
          >
            <div className="flex justify-center mb-6">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
            </div>

            {steps[step]}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
