import React from 'react';
import { X, Image as ImageIcon, Video, Mic, FileText, Sparkles, AlertCircle, Clock } from 'lucide-react';
import { useChatStore, ChatMessage } from '../../store/chatStore';

const EMPTY_NICKNAMES_MAP: Record<string, string> = {};

export interface ReplyPreviewProps {
  messageId: string;
  message?: ChatMessage | null;
  chatId?: string;
  onClear?: () => void;
  onNavigateToMessage?: (messageId: string) => void;
}

export const ReplyPreview: React.FC<ReplyPreviewProps> = ({
  messageId,
  message: propMessage,
  chatId: propChatId,
  onClear,
  onNavigateToMessage
}) => {
  const activeChatId = useChatStore(s => s.activeConversationId);
  const effectiveChatId = propChatId || activeChatId || '';
  
  // Resolve original message from props or chat store
  const storeMessage = useChatStore(s => {
    if (propMessage) return propMessage;
    if (effectiveChatId) {
      return s.findMessage(effectiveChatId, messageId);
    }
    return undefined;
  });

  const message = propMessage || storeMessage;
  const rawNicknames = useChatStore(s => (effectiveChatId ? s.chatNicknames[effectiveChatId] : undefined));
  const chatNicknames = rawNicknames || EMPTY_NICKNAMES_MAP;

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClear) {
      onClear();
    } else if (effectiveChatId) {
      useChatStore.getState().setReplyTarget(effectiveChatId, undefined);
    }
  };

  const handleNavigate = () => {
    if (onNavigateToMessage) {
      onNavigateToMessage(messageId);
    } else {
      const el = document.getElementById(`msg-${messageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-pink-500', 'bg-pink-500/20');
        setTimeout(() => el.classList.remove('ring-2', 'ring-pink-500', 'bg-pink-500/20'), 1600);
      }
    }
  };

  if (!message) {
    return (
      <div
        onClick={handleNavigate}
        className="flex items-center gap-2.5 px-3 py-2 bg-slate-900/80 dark:bg-zinc-900/90 border-l-[3.5px] border-[#ff1493] backdrop-blur-md cursor-pointer select-none transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-[#ff1493]">Replying to message</div>
          <div className="truncate text-xs text-slate-300 dark:text-zinc-400 mt-0.5">Click to view referenced message</div>
        </div>
        <button
          onClick={handleClear}
          className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
          aria-label="Cancel reply"
          type="button"
        >
          <X size={15} />
        </button>
      </div>
    );
  }

  const isDeleted = Boolean(message.is_deleted_for_everyone || message.is_deleted);
  const expiryTime = message.expiresAt || message.expires_at;
  const isExpired = Boolean(expiryTime && new Date(expiryTime).getTime() <= Date.now());

  const type = (message.type || 'text').toLowerCase();
  const content = (message.content || '').trim();
  const mediaUrl = message.media_url || message.mediaUrl;

  // Resolve sender display name: Nickname (Feature C) > Name > Username > 'User'
  const senderId = message.sender_id || (message as any).senderId;
  const nickname = senderId ? chatNicknames[senderId] : null;
  const isSparklyBot = senderId === 'sparkly_bot' || message.is_sparkly_bot || (message.metadata && typeof message.metadata === 'string' && message.metadata.includes('sparkly_bot'));
  const senderDisplayName = isSparklyBot
    ? 'Sparkly AI'
    : (nickname || message.sender_name || message.sender_username || 'User');

  const renderThumbnail = () => {
    if (isDeleted || isExpired) return null;

    if ((type === 'image' || type === 'photo') && mediaUrl) {
      return (
        <img
          src={mediaUrl}
          alt="Thumbnail"
          className="w-10 h-10 object-cover rounded-lg border border-white/10 shrink-0"
          onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
        />
      );
    }
    if ((type === 'gif' || type === 'gift') && mediaUrl) {
      return (
        <img
          src={mediaUrl}
          alt="GIF"
          className="w-10 h-10 object-cover rounded-lg border border-white/10 shrink-0"
          onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
        />
      );
    }
    if (type === 'video') {
      if (mediaUrl && (mediaUrl.endsWith('.jpg') || mediaUrl.endsWith('.png') || mediaUrl.endsWith('.webp'))) {
        return (
          <img
            src={mediaUrl}
            alt="Video"
            className="w-10 h-10 object-cover rounded-lg border border-white/10 shrink-0"
          />
        );
      }
      return (
        <div className="w-10 h-10 rounded-lg bg-pink-500/15 border border-pink-500/25 flex items-center justify-center text-pink-400 shrink-0">
          <Video size={18} />
        </div>
      );
    }
    if (type === 'audio' || type === 'voice' || type === 'voice_note') {
      return (
        <div className="w-10 h-10 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center text-purple-400 shrink-0">
          <Mic size={18} />
        </div>
      );
    }
    if (type === 'file' || type === 'document') {
      return (
        <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400 shrink-0">
          <FileText size={18} />
        </div>
      );
    }
    return null;
  };

  const getDisplayText = () => {
    if (isDeleted) {
      return (
        <span className="italic text-slate-400 flex items-center gap-1">
          <AlertCircle size={12} className="shrink-0" /> Original message deleted
        </span>
      );
    }
    if (isExpired) {
      return (
        <span className="italic text-slate-400 flex items-center gap-1">
          <Clock size={12} className="shrink-0" /> This message has expired
        </span>
      );
    }

    if (content) {
      if (type === 'image' || type === 'photo') return `📷 ${content}`;
      if (type === 'video') return `🎥 ${content}`;
      if (type === 'gif' || type === 'gift') return `👾 ${content}`;
      if (type === 'audio' || type === 'voice') return `🎵 Voice Note: ${content}`;
      if (type === 'file' || type === 'document') return `📄 ${content}`;
      return content;
    }

    switch (type) {
      case 'image':
      case 'photo':
        return '📷 Photo';
      case 'video':
        return '🎥 Video';
      case 'gif':
      case 'gift':
        return '👾 GIF';
      case 'audio':
      case 'voice':
      case 'voice_note':
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
    <div
      onClick={handleNavigate}
      className="flex items-center gap-3 px-3.5 py-2.5 bg-slate-900/90 dark:bg-zinc-900/95 border-l-4 border-[#ff1493] backdrop-blur-md cursor-pointer select-none transition-all hover:bg-slate-900/95 dark:hover:bg-zinc-900 shadow-md group"
    >
      {thumbnail}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#ff1493] leading-none mb-1">
          <span className="truncate">Replying to {senderDisplayName}</span>
          {isSparklyBot && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0 flex items-center gap-0.5">
              <Sparkles size={9} /> AI
            </span>
          )}
        </div>
        <div className="truncate text-xs font-medium text-slate-100 dark:text-zinc-200 leading-snug">
          {getDisplayText()}
        </div>
      </div>
      <button
        onClick={handleClear}
        className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0"
        aria-label="Cancel reply"
        title="Cancel reply"
        type="button"
      >
        <X size={15} />
      </button>
    </div>
  );
};
