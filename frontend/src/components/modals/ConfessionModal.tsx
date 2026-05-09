import { useState, useRef } from 'react';
import { X, Flame, Snowflake, Sparkles, ArrowRight, Image as ImageIcon, AlertTriangle, ShieldOff, Trash2 } from 'lucide-react';

// Custom Spy/Anonymous Icon to match the "Incognito" aesthetic (Fedora + Glasses)
const SpyIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M17 10c.5-1.5 0-3-1-4l-1-1h-6l-1 1c-1 1-1.5 2.5-1 4" />
    <path d="M3 10h18l-1.5 3H4.5L3 10z" />
    <circle cx="8.5" cy="17" r="2.5" />
    <circle cx="15.5" cy="17" r="2.5" />
    <path d="M11 17h2" />
  </svg>
);
import api from '../../api/api';
import Spinner from '../ui/Spinner';

interface ConfessionModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function ConfessionModal({ onClose, onSuccess }: ConfessionModalProps) {
  const [content, setContent] = useState('');
  const [subType, setSubType] = useState<'fire' | 'ice' | 'ghost'>('fire');
  const [submitting, setSubmitting] = useState(false);

  // Image upload state
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showImageWarning, setShowImageWarning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      if (selectedImage) {
        // Image path: multipart/form-data (requires multer on the backend route)
        const formData = new FormData();
        formData.append('content', content);
        formData.append('sub_type', subType);
        formData.append('is_anonymous', 'true');
        formData.append('image', selectedImage);
        await api.post('/confessions', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } else {
        // Standard path: JSON body — matches backend req.body parsing
        await api.post('/confessions', {
          content,
          sub_type: subType,
          is_anonymous: true,
        });
      }
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Confession failed:', err);
      alert('Failed to share confession.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageClick = () => {
    // Show anonymity warning first, then let user decide
    setShowImageWarning(true);
  };

  const handleImageProceed = () => {
    setShowImageWarning(false);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedImage(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const themes = {
    fire:  { icon: <Flame size={18} />,     label: 'HOT TAKE',    color: 'text-primary' },
    ice:   { icon: <Snowflake size={18} />, label: 'COLD TRUTH',  color: 'text-sky-500' },
    ghost: { icon: <SpyIcon size={18} />,     label: 'DEEP SECRET', color: 'text-slate-500' }
  };

  return (
    <div className="flex flex-col bg-white rounded-3xl overflow-hidden shadow-2xl relative max-h-[90vh]">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <SpyIcon size={20} className="text-white" />
          </div>
          <div>
            <h3 className="font-black text-xl text-gray-900 tracking-tight uppercase italic leading-none">New Confession</h3>
            <p className="text-[9px] font-black text-gray-300 uppercase tracking-widest mt-0.5">Always Anonymous · Identity Shielded</p>
          </div>
        </div>
        <button
          className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 hover:text-primary hover:bg-primary/5 transition-all active:scale-90"
          onClick={onClose}
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>

      {/* Body (scrollable) */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="p-6 space-y-5">

          {/* Vibe selector */}
          <div className="flex gap-2">
            {(Object.keys(themes) as Array<keyof typeof themes>).map(t => (
              <button
                key={t}
                className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                  subType === t
                    ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20'
                    : 'border-gray-100 bg-gray-50 text-gray-400 hover:border-primary/20 hover:bg-white'
                }`}
                onClick={() => setSubType(t)}
              >
                <div className={`transition-transform ${subType === t ? 'scale-110' : ''}`}>
                  {themes[t].icon}
                </div>
                <span className={`text-[8px] font-black uppercase tracking-wider ${subType === t ? 'text-white' : ''}`}>
                  {themes[t].label}
                </span>
              </button>
            ))}
          </div>

          {/* Textarea */}
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <Sparkles size={12} className="text-primary" />
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Your Confession</label>
            </div>
            <textarea
              className="w-full p-5 bg-gray-50 border-2 border-transparent rounded-2xl outline-none font-semibold text-lg text-gray-800 placeholder:text-gray-300 focus:bg-white focus:border-primary/20 transition-all min-h-[140px] resize-none leading-snug"
              placeholder={`What's your ${themes[subType].label.toLowerCase()}?`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {/* Image preview */}
          {imagePreview && (
            <div className="relative rounded-2xl overflow-hidden border border-gray-100">
              <img src={imagePreview} alt="Attachment" className="w-full max-h-52 object-cover" />
              {/* Anonymity reminder banner on image */}
              <div className="absolute top-2 left-2 right-2 flex items-center gap-2 bg-black/70 backdrop-blur-sm rounded-xl px-3 py-2">
                <ShieldOff size={12} className="text-amber-400 flex-shrink-0" />
                <span className="text-[9px] font-black text-amber-300 uppercase tracking-widest">Image may reduce anonymity</span>
              </div>
              <button
                onClick={removeImage}
                className="absolute bottom-2 right-2 w-8 h-8 bg-black/60 rounded-xl flex items-center justify-center text-white hover:bg-rose-500 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}

          {/* Image Warning */}
          {showImageWarning && (
            <div className="border border-gray-200 rounded-lg bg-white p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 mb-1">This may reduce your anonymity</p>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Images can carry hidden metadata — device info, GPS coordinates, or identifiable content. Only attach an image if you're confident it can't be traced back to you.
                  </p>
                  <div className="flex items-center gap-3 mt-4">
                    <button
                      onClick={() => setShowImageWarning(false)}
                      className="text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImageProceed}
                      className="px-4 py-1.5 bg-gray-900 text-white text-sm font-semibold rounded-md hover:bg-gray-700 transition-colors"
                    >
                      Proceed anyway
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Identity shield note */}
          <div className="flex items-center gap-3 p-4 bg-emerald-50/70 rounded-2xl border border-emerald-100">
            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-emerald-500 shadow-sm flex-shrink-0">
              <SpyIcon size={16} className="text-emerald-500" />
            </div>
            <span className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-widest leading-relaxed">
              Identity shielded by Sparkle's anonymity layer.
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 pb-6 pt-3 flex-shrink-0 border-t border-gray-50 space-y-3">
        {/* Attach image button */}
        {!imagePreview && !showImageWarning && (
          <button
            onClick={handleImageClick}
            className="w-full h-11 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center gap-2 text-gray-400 hover:border-primary/30 hover:text-primary transition-all group"
          >
            <ImageIcon size={16} className="group-hover:scale-110 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Attach Image (optional)</span>
          </button>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Submit */}
        <button
          className="w-full h-13 rounded-2xl bg-primary text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/30 hover:scale-[1.02] hover:shadow-primary/50 transition-all active:scale-95 disabled:opacity-30 flex items-center justify-center gap-3 group py-3.5"
          onClick={handleSubmit}
          disabled={submitting || !content.trim()}
        >
          {submitting ? <Spinner size="medium" color="text-white" /> : (
            <>
              Post Anonymously
              <ArrowRight size={18} strokeWidth={2.5} className="group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
