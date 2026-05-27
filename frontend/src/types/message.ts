export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text?: string;
  media?: Array<{ url: string; type: 'image' | 'video' | 'gif' | 'sticker' | 'voice' }>; // simplified
  timestamp: string; // ISO
  // Permission flags supplied by the backend
  isSender: boolean;
  canEdit: boolean;
  canDeleteForMe: boolean;
  canDeleteForEveryone: boolean;
  canPin: boolean;
  canForward: boolean;
  canReply: boolean;
  canReact: boolean;
}
