import React from 'react';
import { designTokens } from '../../theme/designTokens';
import { X } from 'lucide-react';
import { useChatStore } from '../../store/chatStore';

interface ReplyPreviewProps {
  messageId: string;
  content: string;
  type?: string;
  media_url?: string;
  avatarUrl?: string; // optional avatar URL
  onClear?: () => void; // optional clear callback
}

export const ReplyPreview: React.FC<ReplyPreviewProps> = ({ messageId, content, type, media_url, avatarUrl, onClear }) => {
  // fallback clear function using chat store if onClear not provided
  const clearReply = useChatStore(s => s.setReplyTarget);
  const handleClear = () => {
    if (onClear) onClear();
    else clearReply(undefined);
  };

  const renderThumbnail = () => {
    if (type === 'image' && media_url) {
      return <img src={media_url} alt="img" className="w-[40px] h-[40px] object-cover rounded" />;
    }
    if (type === 'gif' && media_url) {
      return <img src={media_url} alt="gif" className="w-[40px] h-[40px] object-cover rounded" />;
    }
    if (type === 'video' && media_url) {
      return <div className="w-[40px] h-[40px] bg-white/10 rounded flex items-center justify-center text-xs text-white/50">🎥</div>;
    }
    // For text messages, don't render any thumbnail
    return null;
  };
  const getDisplayText = () => {
    if (content && content.trim() !== '') {
      // If it's a rich media message with a caption, display it, otherwise prefix it
      if (type === 'image') return `📷 ${content}`;
      if (type === 'video') return `🎥 ${content}`;
      if (type === 'gif') return `👾 ${content}`;
      return content;
    }

    switch (type) {
      case 'image':
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
    <div className="flex items-center gap-2 p-2" style={designTokens.replyBorder}>
      {avatarUrl && (
        <img src={avatarUrl} alt="avatar" className="w-[40px] h-[40px] rounded-full object-cover" />
      )}
      {thumbnail && <div className="flex-shrink-0">{thumbnail}</div>}
      <div className="flex-1 min-w-0 truncate text-sm text-white/80">{getDisplayText()}</div>
      <button onClick={handleClear} className="p-1 hover:text-white/100" aria-label="Cancel reply">
        <X size={14} />
      </button>
    </div>
  );
};
