import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface ForwardHeaderProps {
  onBack: () => void;
  selectedCount: number;
}

export const ForwardHeader: React.FC<ForwardHeaderProps> = ({ onBack, selectedCount }) => {
  return (
    <div className="flex items-center h-14 px-4 bg-[#111111] border-b border-white/10 sticky top-0 z-10 backdrop-blur-xl bg-white/10">
      <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full">
        <ArrowLeft size={20} className="text-white" />
      </button>
      <h2 className="flex-1 text-center text-lg font-medium text-white">
        {selectedCount ? `Forward to ${selectedCount} chat${selectedCount > 1 ? 's' : ''}` : 'Forward Message'}
      </h2>
    </div>
  );
};
