import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useModalStore } from '../../store/modalStore';
import { 
  Pen, 
  PlayCircle, 
  Calendar, 
  X,
  Store,
  Ghost,
  History
} from 'lucide-react';

interface CreationHubModalProps {
  onClose: () => void;
}

export default function CreationHubModal({ onClose }: CreationHubModalProps) {
  const navigate = useNavigate();
  const { setActiveModal } = useModalStore();



  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-0 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-fade-in" 
        onClick={onClose} 
      />
      
      {/* Modal Content - Exact Copy of Side Bar Modal Styling */}
      <div 
        className="relative w-full max-w-[340px] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col animate-scale-in border border-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex-1 overflow-y-auto max-h-[80vh] custom-scrollbar">
          {/* Header Title - Matching Side Bar Menu Style */}
          <div className="flex items-center justify-between mb-6 px-1">
            <span className="font-black text-slate-900 text-xl tracking-tight">Create</span>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
              <X size={18} strokeWidth={3} />
            </button>
          </div>

          {/* Creation Options - Using the List Style from reference */}
          <div className="flex flex-col gap-1">
            <button onClick={() => { onClose(); setActiveModal('post'); }} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors group rounded-xl">
              <div className="text-slate-400 group-hover:text-slate-600 transition-colors">
                <Pen size={20} strokeWidth={2.5} />
              </div>
              <span className="font-bold text-slate-500 text-[15px]">Create Post</span>
            </button>

            <button onClick={() => { onClose(); navigate('/afterglow/create'); }} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors group rounded-xl">
              <div className="text-violet-500 group-hover:text-violet-600 transition-colors">
                <History size={20} strokeWidth={2.5} />
              </div>
              <span className="font-bold text-slate-500 text-[15px]">Create AfterGlow</span>
            </button>

            <button onClick={() => { onClose(); navigate('/moments/create'); }} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors group rounded-xl">
              <div className="text-rose-500 group-hover:text-rose-600 transition-colors">
                <PlayCircle size={20} strokeWidth={2.5} />
              </div>
              <span className="font-bold text-slate-500 text-[15px]">Create Moment</span>
            </button>

            {/* Divider - Exact position as side bar */}
            <div className="my-3 border-t border-slate-100 mx-2" />

            <button onClick={() => { onClose(); setActiveModal('listing'); }} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors group rounded-xl">
              <div className="text-emerald-500 group-hover:text-emerald-600 transition-colors">
                <Store size={20} strokeWidth={2.5} />
              </div>
              <span className="font-bold text-slate-500 text-[15px]">Sell Item</span>
            </button>

            <button onClick={() => { onClose(); setActiveModal('poll'); }} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors group rounded-xl">
              <div className="text-amber-500 group-hover:text-amber-600 transition-colors">
                <div className="w-5 h-5 flex items-center justify-center">
                  <i className="fas fa-poll" style={{ fontSize: '1.2rem' }}></i>
                </div>
              </div>
              <span className="font-bold text-slate-500 text-[15px]">Launch Poll</span>
            </button>

            <button onClick={() => { onClose(); setActiveModal('event'); }} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors group rounded-xl">
              <div className="text-orange-600 group-hover:text-orange-700 transition-colors">
                <Calendar size={20} strokeWidth={2.5} />
              </div>
              <span className="font-bold text-slate-500 text-[15px]">Post Event</span>
            </button>

            <button onClick={() => { onClose(); setActiveModal('confession'); }} className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors group rounded-xl relative">
              <div className="text-rose-600 group-hover:text-rose-700 transition-colors">
                <Ghost size={20} strokeWidth={2.5} />
              </div>
              <span className="font-bold text-slate-500 text-[15px]">Share Confession</span>
              <div className="absolute right-12 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-rose-500 rounded-full" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
