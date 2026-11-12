import { PersistentOfflineQueue } from './PersistentOfflineQueue';
import { logger } from '../utils/logger';

/**
 * Put an outgoing message into the durable outbox.
 *
 * The three call sites in pages/Messages.tsx each did this by hand and drifted:
 * two add senderId from the user, one passes the bare payload with no senderId
 * at all — so a voice note queued offline carried no sender and the flush could
 * not attribute it. Two of the three attach a catch, one does not, so a storage
 * quota error rejected unhandled in one path and was swallowed in the others.
 *
 * senderId is derived here so every site behaves the same, and the persist
 * failure is always non-fatal: the message is already on screen and already
 * going out over the socket, and losing the durable copy costs retry, not the
 * message.
 */
export interface OutgoingMessage {
  messageId: string;
  chatId: string;
  recipientId?: string;
  partnerId?: string;
  senderId?: string;
  content: string;
  type: string;
  mediaUrl?: string | null;
  replyToId?: string;
  context?: string;
  metadata?: string;
}

export function queueOutgoingMessage(payload: OutgoingMessage): void {
  let senderId = payload.senderId;
  if (!senderId) {
    try {
      // Read lazily so this module does not import the store and so the value is
      // current at enqueue time rather than at module load.
      const state = require('../store/userStore').useUserStore.getState();
      const user = state.user;
      senderId = user?.id || user?.user_id || user?.userId || '';
    } catch {
      senderId = '';
    }
  }

  try {
    PersistentOfflineQueue.enqueue({ ...payload, senderId });
  } catch (err) {
    logger.warn('[ChatSend] Outbox persistence failed; the message is still on screen:', err);
  }
}
