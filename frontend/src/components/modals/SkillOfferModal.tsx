import React, { useState } from 'react';
import { X, Zap, ChevronRight, GraduationCap, Code, Palette, PenTool, Music, Cpu, Hammer, Check } from 'lucide-react';
import api from '../../api/api';
import { useModalStore } from '../../store/modalStore';
import { motion, AnimatePresence } from 'framer-motion';

const CATEGORIES = [
  { id: 'tutoring', name: 'Tutoring', icon: GraduationCap },
  { id: 'coding', name: 'Coding', icon: Code },
  { id: 'design', name: 'Design', icon: Palette },
  { id: 'writing', name: 'Writing', icon: PenTool },
  { id: 'music', name: 'Music', icon: Music },
  { id: 'tech', name: 'Tech Support', icon: Cpu },
  { id: 'other', name: 'Other', icon: Hammer },
];

const SKILL_TYPES = [
  { id: 'teaching', name: 'Teaching/Tutoring', desc: 'Pass on your knowledge' },
  { id: 'doing', name: 'Service/Work', desc: 'Get things done for others' },
  { id: 'consulting', name: 'Consulting', desc: 'Provide expert advice' },
];

export default function SkillOfferModal({ onClose, onSuccess }: { onClose: () => void, onSuccess?: () => void }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'tutoring',
    skill_type: 'teaching',
    price: '',
    is_free: false
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.post('/skill-market/offers', formData);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to create skill offer:', err);
      alert('Failed to create skill offer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 lowercase">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-3xl" onClick={onClose} />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-[500px] bg-white rounded-[48px] shadow-[0_50px_150px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col border-4 border-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-10 pb-6 flex items-center justify-between border-b-4 border-black/[0.02]">
          <div>
            <h3 className="font-black text-3xl text-black tracking-tighter italic uppercase leading-none">List Skill</h3>
            <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] mt-2 italic">Step {step} of 2</p>
          </div>
          <button onClick={onClose} className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center text-black/20 hover:text-black transition-all">
            <X size={20} strokeWidth={4} />
          </button>
        </div>

        <div className="p-10 flex-1 overflow-y-auto max-h-[70vh] no-scrollbar">
          {step === 1 ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Category Selection */}
              <div>
                <label className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em] mb-4 block italic px-2">Select Category</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setFormData({ ...formData, category: cat.id })}
                      className={`
                        flex items-center gap-3 p-4 rounded-2xl font-bold text-xs transition-all border-2
                        ${formData.category === cat.id ? 'bg-black text-white border-black shadow-lg' : 'bg-black/5 text-black/40 border-transparent hover:border-black/5'}
                      `}
                    >
                      <cat.icon size={16} strokeWidth={formData.category === cat.id ? 3 : 2} />
                      <span className="italic uppercase truncate">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-4">
                <div className="relative group">
                  <input 
                    type="text" 
                    placeholder="SERVICE TITLE (e.g. PYTHON TUTORING)"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value.toUpperCase() })}
                    className="w-full bg-black/5 rounded-2xl px-6 py-5 font-black text-sm italic uppercase border-2 border-transparent focus:border-primary/20 outline-none transition-all placeholder:text-black/10"
                  />
                </div>
                <div className="relative group">
                  <textarea 
                    placeholder="DESCRIBE YOUR EXPERTISE & WHAT YOU OFFER..."
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-black/5 rounded-3xl px-6 py-5 font-bold text-sm italic border-2 border-transparent focus:border-primary/20 outline-none transition-all placeholder:text-black/10 no-scrollbar"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              {/* Skill Type */}
              <div>
                <label className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em] mb-4 block italic px-2">Skill Modality</label>
                <div className="space-y-2">
                  {SKILL_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setFormData({ ...formData, skill_type: type.id })}
                      className={`
                        w-full flex items-center justify-between p-5 rounded-3xl font-bold transition-all border-2
                        ${formData.skill_type === type.id ? 'bg-black text-white border-black shadow-xl scale-[1.02]' : 'bg-black/5 text-black/40 border-transparent hover:border-black/5'}
                      `}
                    >
                      <div className="text-left">
                        <span className="block text-sm uppercase italic font-black">{type.name}</span>
                        <span className="text-[10px] opacity-40 uppercase italic tracking-tighter">{type.desc}</span>
                      </div>
                      {formData.skill_type === type.id && <Check size={20} strokeWidth={4} className="text-primary" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pricing */}
              <div>
                <label className="text-[10px] font-black text-black/20 uppercase tracking-[0.3em] mb-4 block italic px-2">Commercial Value</label>
                <div className="flex items-center gap-4">
                  <div className={`flex-1 relative transition-opacity ${formData.is_free ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-black/20 italic">KSH</span>
                    <input 
                      type="number" 
                      placeholder="0.00"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full bg-black/5 rounded-3xl pl-16 pr-6 py-5 font-black text-2xl italic border-2 border-transparent focus:border-primary/20 outline-none transition-all"
                    />
                  </div>
                  <button 
                    onClick={() => setFormData({ ...formData, is_free: !formData.is_free })}
                    className={`h-20 px-8 rounded-3xl font-black uppercase italic tracking-tighter transition-all flex flex-col items-center justify-center gap-1 border-2
                      ${formData.is_free ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-black/5 text-black/20 border-transparent'}
                    `}
                  >
                    <Zap size={20} fill={formData.is_free ? 'white' : 'currentColor'} />
                    <span className="text-[9px]">Free</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-10 pt-4 flex gap-3 relative z-10">
          {step === 2 && (
            <button 
              onClick={() => setStep(1)}
              className="px-8 py-5 bg-black/5 text-black rounded-[24px] font-black uppercase italic tracking-tighter hover:bg-black/10 transition-all active:scale-95"
            >
              Back
            </button>
          )}
          <button 
            disabled={loading || (step === 1 && !formData.title)}
            onClick={() => step === 1 ? setStep(2) : handleSubmit()}
            className="flex-1 py-5 bg-black text-white rounded-[24px] font-black uppercase italic tracking-tighter hover:bg-primary transition-all active:scale-95 shadow-xl shadow-black/10 disabled:opacity-20"
          >
            {loading ? 'Transmitting...' : step === 1 ? 'Next Phase' : 'Initiate Listing'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
