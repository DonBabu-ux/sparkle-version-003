import { MessagePermissions } from "./messagePermissions";

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text?: string;
  media?: Array<{ url: string; type: 'image' | 'video' | 'gif' | 'sticker' | 'voice' }>; // simplified
  timestamp: string; // ISO
  // Permissions supplied by the backend
  permissions: MessagePermissions;
}
