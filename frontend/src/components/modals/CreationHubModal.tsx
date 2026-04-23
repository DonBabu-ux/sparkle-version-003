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
  History,
  Sparkles,
  BarChart3,
  Orbit,
  ArrowRight
} from 'lucide-react';

interface CreationHubModalProps {
  onClose: () => void;
}

export default function CreationHubModal({ onClose }: CreationHubModalProps) {
  const navigate = useNavigate();
  const { setActiveModal } = useModalStore();

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-6 lowercase">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/10 backdrop-blur-3xl animate-fade-in" 
        onClick={onClose} 
      />
      
      {/* Modal Content */}
      <div 
        className="relative w-full max-w-[420px] bg-white rounded-[64px] shadow-[0_50px_150px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col animate-scale-in border-4 border-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 right-0 p-12 text-black/[0.02] pointer-events-none">
            <Orbit size={200} strokeWidth={1} className="animate-spin-slow" />
        </div>

        <div className="p-10 flex-1 overflow-y-auto max-h-[85vh] no-scrollbar relative z-10">
          {/* Header Title */}
          <div className="flex items-center justify-between mb-12 px-2">
            <div>
                <h3 className="font-heading font-black text-4xl text-black tracking-tighter italic uppercase leading-none">Matrix Hub</h3>
                <p className="text-[10px] font-black text-black/20 uppercase tracking-[0.4em] mt-3 italic">Initiate New Frequency</p>
            </div>
            <button onClick={onClose} className="w-14 h-14 rounded-2xl bg-black/5 flex items-center justify-center text-black/10 hover:text-black hover:bg-black/10 transition-all active:rotate-90">
              <X size={24} strokeWidth={4} />
            </button>
          </div>

          {/* Creation Options */}
          <div className="grid grid-cols-1 gap-2">
            {[
                { name: 'new spark', icon: Pen, action: () => setActiveModal('post'), desc: 'TRANSMIT BROADCAST', color: 'text-black' },
                { name: 'afterglow', icon: History, action: () => navigate('/afterglow/create'), desc: 'EPHEMERAL FRAGMENT', color: 'text-primary' },
                { name: 'moment', icon: PlayCircle, action: () => navigate('/moments/create'), desc: 'PULSE TRANSLATION', color: 'text-primary' },
            ].map((item, idx) => (
                <button 
                    key={idx}
                    onClick={() => { onClose(); item.action(); }} 
                    className="w-full p-6 flex items-center gap-6 hover:bg-black/5 transition-all group rounded-[32px] relative overflow-hidden active:scale-95 border-2 border-transparent hover:border-black/5"
                >
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-primary/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    <div className={`w-14 h-14 rounded-2xl bg-black/5 flex items-center justify-center ${item.color} group-hover:bg-black group-hover:text-white transition-all duration-500 scale-110`}>
                        <item.icon size={24} strokeWidth={3} />
                    </div>
                    <div className="text-left flex-1">
                        <span className="font-heading font-black text-black text-xl tracking-tighter uppercase italic leading-none">{item.name}</span>
                        <p className="text-[9px] font-black text-black/20 uppercase tracking-[0.3em] mt-1 group-hover:text-primary transition-colors">{item.desc}</p>
                    </div>
                    <ArrowRight size={20} strokeWidth={4} className="text-black/5 group-hover:text-primary group-hover:translate-x-2 transition-all" />
                </button>
            ))}

            <div className="my-6 border-t-4 border-black/5 mx-6 rounded-full" />

            {[
                { name: 'market signal', icon: Store, action: () => setActiveModal('listing'), desc: 'LIQUIDITY INJECT', color: 'text-black' },
                { name: 'pulse poll', icon: BarChart3, action: () => setActiveModal('poll'), desc: 'AGGREGATE RESONANCE', color: 'text-black' },
                { name: 'village rift', icon: Calendar, action: () => setActiveModal('event'), desc: 'TEMPORAL COORDINATE', color: 'text-black' },
                { name: 'confession', icon: Ghost, action: () => setActiveModal('confession'), desc: 'DEEP CORE SYNC', color: 'text-rose-500' },
            ].map((item, idx) => (
                <button 
                    key={idx}
                    onClick={() => { onClose(); item.action(); }} 
                    className="w-full p-6 flex items-center gap-6 hover:bg-black/5 transition-all group rounded-[32px] active:scale-95 border-2 border-transparent hover:border-black/5"
                >
                    <div className={`w-12 h-12 rounded-[18px] bg-black/5 flex items-center justify-center ${item.color} group-hover:scale-110 transition-all duration-500`}>
                        <item.icon size={22} strokeWidth={3} />
                    </div>
                    <div className="text-left flex-1">
                        <span className="font-heading font-black text-black text-[17px] tracking-tighter uppercase italic leading-none">{item.name}</span>
                        <p className="text-[9px] font-black text-black/10 uppercase tracking-[0.2em] mt-1">{item.desc}</p>
                    </div>
                </button>
            ))}
          </div>
          
          <div className="mt-12 pt-8 border-t-4 border-black/5 text-center">
             <div className="flex items-center justify-center gap-4 text-black/10 animate-pulse">
                <Sparkles size={16} />
                <span className="text-[9px] font-black uppercase tracking-[0.6em] italic">identity matrix active</span>
                <Sparkles size={16} />
             </div>
          </div>
        </div>
      </div>
      
      <style>{`
        .animate-spin-slow { animation: spin 30s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-in { from { opacity: 0; transform: scale(0.9) translateY(40px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .animate-fade-in { animation: fade-in 0.8s ease-out forwards; }
        .animate-scale-in { animation: scale-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>
    </div>
  );
}
