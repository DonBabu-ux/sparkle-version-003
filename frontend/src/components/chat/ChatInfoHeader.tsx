import React from 'react';
import { getAvatarUrl } from '../../utils/imageUtils';
import { sanitizePartnerName } from '../../utils/nameSanitizer';
import { ChevronLeft, Phone, Video, User } from 'lucide-react';
import { clsx } from 'clsx';

interface ChatInfoHeaderProps {
  chat: any;
  onClose: () => void;
  onNavigateProfile?: () => void;
}

export const ChatInfoHeader: React.FC<ChatInfoHeaderProps> = ({ chat, onClose, onNavigateProfile }) => {
  const online = chat.is_online ?? false;
  const lastSeen = chat.last_seen ?? '';
  const statusText = online ? 'Online' : `Last seen ${lastSeen}`;

  return (
    <div className="p-4 flex flex-col items-center gap-4 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/10">
      <button onClick={onClose} className="self-start p-2 text-white/90 hover:bg-white/10 rounded-full transition-colors">
        <ChevronLeft size={24} />
      </button>
      <img
        src={getAvatarUrl(chat.partner_avatar)}
        alt="Avatar"
        className={clsx('w-24 h-24 rounded-full border-2', online ? 'border-[#ff1493]' : 'border-gray-500')}
      />
      <h2 className="text-xl font-bold text-white">{sanitizePartnerName(chat.partner_name, chat.partner_username)}</h2>
      {chat.partner_username && (
        <p className="text-sm text-white/60">@{chat.partner_username}</p>
      )}
      <p className="text-xs text-white/50">{statusText}</p>
      {chat.bio && (
        <p className="mt-2 text-center text-sm text-white/70 max-w-xs">{chat.bio}</p>
      )}
      <div className="flex gap-3 mt-2">
        <button
          onClick={onNavigateProfile}
          className="flex items-center gap-1 px-3 py-1 bg-[#ff1493]/15 border border-[#ff1493]/30 rounded-full text-xs text-white hover:bg-[#ff1493]/25"
        >
          <User size={14} /> Profile
        </button>
        <button className="flex items-center gap-1 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-white hover:bg-white/10">
          <Phone size={14} /> Call
        </button>
        <button className="flex items-center gap-1 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-white hover:bg-white/10">
          <Video size={14} /> Video
        </button>
      </div>
    </div>
  );
};
