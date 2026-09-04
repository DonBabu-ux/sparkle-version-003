import React, { useState } from 'react';
import { Send, Clock, MessageSquare, MapPin } from 'lucide-react';

export type LiveDuration = '15m' | '1h' | '8h' | 'off';

interface LiveLocationConfigPanelProps {
  onSend: (duration: LiveDuration, comment: string) => void;
  onCancel: () => void;
  isSending?: boolean;
}

export const LiveLocationConfigPanel: React.FC<LiveLocationConfigPanelProps> = ({
  onSend,
  onCancel,
  isSending = false
}) => {
  const [duration, setDuration] = useState<LiveDuration>('1h');
  const [comment, setComment] = useState('');

  const durationOptions: { id: LiveDuration; label: string }[] = [
    { id: '15m', label: '15 min' },
    { id: '1h', label: '1 hour' },
    { id: '8h', label: '8 hours' },
    { id: 'off', label: 'Until turned off' }
  ];

  const handleSend = () => {
    onSend(duration, comment.trim());
  };

  return (
    <div className="w-full bg-[#13131a] border-t border-white/10 p-4 rounded-t-3xl shadow-2xl animate-slide-up text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-[#ff1493]/20 text-[#ff1493]">
            <MapPin className="w-4 h-4" />
          </div>
          <span className="font-bold text-base text-white">Share live location</span>
        </div>
        <button
          onClick={onCancel}
          className="text-xs font-semibold text-white/50 hover:text-white px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Duration Label */}
      <div className="flex items-center gap-1.5 text-xs font-semibold text-white/60 mb-2">
        <Clock className="w-3.5 h-3.5 text-[#ff1493]" />
        <span>Select duration</span>
      </div>

      {/* Duration Pills */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {durationOptions.map((opt) => {
          const isActive = duration === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setDuration(opt.id)}
              className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all text-center ${
                isActive
                  ? 'bg-[#ff1493] text-white shadow-lg shadow-[#ff1493]/40 border border-[#ff1493] scale-[1.02]'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/5'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Comment Input & Send Row */}
      <div className="relative flex items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
            <MessageSquare className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment... (optional)"
            className="w-full bg-white/5 border border-white/10 focus:border-[#ff1493] rounded-2xl py-3 pl-9 pr-3 text-sm text-white placeholder-white/40 focus:outline-none transition-colors"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
          />
        </div>

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={isSending}
          className="p-3.5 rounded-2xl bg-gradient-to-r from-[#ff1493] to-[#e0115f] text-white hover:brightness-110 shadow-lg shadow-[#ff1493]/30 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center shrink-0"
        >
          <Send className="w-5 h-5 fill-current" />
        </button>
      </div>
    </div>
  );
};
