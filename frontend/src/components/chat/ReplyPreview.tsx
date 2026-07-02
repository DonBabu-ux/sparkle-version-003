import React from 'react';
import { designTokens } from '../../theme/designTokens';
import { X } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';

interface ReplyPreviewProps {
  messageId: string;
  onClear?: () => void; // optional clear callback
}

export const ReplyPreview: React.FC<ReplyPreviewProps> = ({ messageId, onClear }) => {
  const activeChatId = useChatStore(s => s.activeConversationId);
  const message = useChatStore(s => activeChatId ? s.findMessage(activeChatId, messageId) : undefined);
  const clearReply = useChatStore(s => s.setReplyTarget);

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else if (activeChatId) {
      clearReply(activeChatId, undefined);
    }
  };

  if (!message) {
    return (
      <div className="flex items-center gap-2 p-2 bg-white/5 border-l-2 border-[#ff1493]" style={designTokens.replyBorder}>
        <div className="flex-1 min-w-0 truncate text-sm text-white/50">Replying to message...</div>
        <button onClick={handleClear} className="p-1 hover:text-white/100" aria-label="Cancel reply">
          <X size={14} />
        </button>
      </div>
    );
  }

  const type = message.type || 'text';
  const content = message.content || '';
  const media_url = message.media_url || message.mediaUrl;

  const renderThumbnail = () => {
    if ((type === 'image' || type === 'photo') && media_url) {
      return <img src={media_url} alt="img" className="w-[40px] h-[40px] object-cover rounded" />;
    }
    if (type === 'gif' && media_url) {
      return <img src={media_url} alt="gif" className="w-[40px] h-[40px] object-cover rounded" />;
    }
    if (type === 'video' && media_url) {
      return <div className="w-[40px] h-[40px] bg-white/10 rounded flex items-center justify-center text-xs text-white/50">🎥</div>;
    }
    return null;
  };

  const getDisplayText = () => {
    if (content && content.trim() !== '') {
      if (type === 'image' || type === 'photo') return `📷 ${content}`;
      if (type === 'video') return `🎥 ${content}`;
      if (type === 'gif') return `👾 ${content}`;
      return content;
    }

    switch (type) {
      case 'image':
      case 'photo':
        return '📷 Photo';
      case 'video':
        return '🎥 Video';
      case 'gif':
        return '👾 GIF';
      case 'audio':
      case 'voice':
        return '🎵 Voice Note';
      case 'file':
      case 'document':
        return '📄 Document';
      default:
        return 'Attachment';
    }
  };

  const thumbnail = renderThumbnail();

  return (
    <div className="flex items-center gap-2 p-2 bg-white/5 border-l-2 border-[#ff1493]" style={designTokens.replyBorder}>
      {thumbnail && <div className="flex-shrink-0">{thumbnail}</div>}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-bold text-[#ff1493] leading-none mb-1">
          Replying to {message.sender_name || message.sender_username || 'User'}
        </div>
        <div className="truncate text-sm text-white/80 leading-tight">{getDisplayText()}</div>
      </div>
      <button onClick={handleClear} className="p-1 hover:text-white/100" aria-label="Cancel reply">
        <X size={14} />
      </button>
    </div>
  );
};
