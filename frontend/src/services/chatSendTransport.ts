import type { Socket } from 'socket.io-client';
import { useChatStore } from '../store/chatStore';
import { PersistentOfflineQueue } from './PersistentOfflineQueue';
import { logger } from '../utils/logger';

/**
 * Acknowledgement the server returns for `send-message`.
 *
 * backend/socket/index.js:737 on success, :848 on failure. The failure shape
 * carries a `code` and an `isBlocked` flag rather than a bare string, because
 * "cannot send this" has several distinct causes the client must tell apart:
 * blocked conversation, forbidden chat, missing chat, bad media URL.
 */
export interface SendMessageAck {
  success?: boolean;
  messageId?: string;
  sentAt?: string;
  server_sequence?: number;
  isBlocked?: boolean;
  code?: string;
  error?: string;
}

export interface TransmitMessageOptions {
  /** The client UUID already rendered on the optimistic bubble and in the payload. */
  clientMessageId: string;
  chatId: string;
  /** Merged into the bubble on success — upload paths carry the final media URL. */
  ackFields?: Record<string, unknown>;
  /** Runs after the shared reconciliation: perf logging, upload-payload cleanup. */
  onAck?: (ack: SendMessageAck) => void;
  onFailure?: (ack?: SendMessageAck) => void;
  onBlocked?: (ack: SendMessageAck) => void;
}

export type TransmitOutcome = 'transmitted' | 'offline';

function isBlockedAck(ack?: SendMessageAck): boolean {
  return Boolean(ack?.isBlocked || ack?.code === 'MESSAGE_BLOCKED' || ack?.error?.includes('blocked'));
}

/**
 * Write a patch onto one optimistic bubble.
 *
 * This mirrors what pages/Messages.tsx's local `updateMessages` helper does,
 * including routing through `setMessages` rather than `updateMessage`: setMessages
 * re-normalizes the array and calls refreshConversation, which re-derives the
 * chat-list preview and moves the chat back to the top of the inbox. Using
 * `updateMessage` here would silently skip both.
 */
function patchOptimisticMessage(chatId: string, clientMessageId: string, updates: Record<string, unknown>): void {
  if (!chatId) return;
  const store = useChatStore.getState();
  const current = store.messagesByConversation[chatId] || [];
  const next = current.map((m: any) =>
    (m.message_id === clientMessageId || m.id === clientMessageId) ? { ...m, ...updates } : m
  );
  store.setMessages(chatId, next);
}

/**
 * Send one message over the socket and reconcile the acknowledgement.
 *
 * Every `send-message` emit site in the app used to do this by hand, and each
 * one drifted in a different direction:
 *
 *  - the upload paths (`executeMediaUpload`, `handleVoiceSend`) never called
 *    `acknowledge()` and never started a delivery timer, so an upload bubble
 *    that the server never acked sat at "sending" forever;
 *  - `handleRetryMessage` dropped `server_sequence`, so a resent message lost
 *    its ordering key and could land out of place after a re-sort;
 *  - none of the four handled a blocked conversation, which the server reports
 *    via `isBlocked` on the ack — they showed a plain failure instead;
 *  - only `handleSendMessage` refreshed the chat list, so a voice note or an
 *    attachment left a stale preview until the next reconnect.
 *
 * `acknowledge`, `markFailed` and `markBlocked` all no-op when the id is not in
 * the durable outbox (they filter by messageId), so calling them
 * unconditionally is safe for the paths that only queue when offline.
 *
 * Returns whether the message was actually transmitted; the caller keeps its
 * own offline policy, which legitimately differs per site.
 */
export function transmitMessage(
  socket: Socket | null | undefined,
  payload: Record<string, any>,
  options: TransmitMessageOptions
): TransmitOutcome {
  const { clientMessageId, chatId } = options;

  if (!socket || !socket.connected) return 'offline';

  // Every live send gets the 10s acknowledgement window. For a message that was
  // never enqueued the timer's internal markFailed is a no-op, so this only
  // fails the bubble — which is exactly what the upload paths were missing.
  PersistentOfflineQueue.startMessageTimeout(clientMessageId, () => {
    patchOptimisticMessage(chatId, clientMessageId, { status: 'failed' });
  });

  socket.emit('send-message', payload, (ack: SendMessageAck) => {
    if (ack && ack.success && ack.messageId) {
      // acknowledge() also clears the delivery timer.
      PersistentOfflineQueue.acknowledge(clientMessageId);

      const serverSeq = ack.server_sequence != null && Number.isFinite(Number(ack.server_sequence))
        ? Number(ack.server_sequence)
        : undefined;

      // Only send keys the server actually returned. Spreading `sent_at:
      // undefined` would wipe the local timestamp when the ack omits it.
      const updates: Record<string, unknown> = {
        message_id: ack.messageId,
        id: ack.messageId,
        status: 'sent',
        ...(serverSeq !== undefined ? { server_sequence: serverSeq } : {}),
        ...(ack.sentAt ? { sent_at: ack.sentAt } : {}),
        ...(options.ackFields || {}),
      };
      patchOptimisticMessage(chatId, clientMessageId, updates);

      options.onAck?.(ack);
      return;
    }

    // A blocked conversation is not a delivery failure: the message must not be
    // retried, and the thread has to switch to its blocked state.
    if (isBlockedAck(ack)) {
      PersistentOfflineQueue.markBlocked(clientMessageId);
      PersistentOfflineQueue.clearMessageTimeout(clientMessageId);
      patchOptimisticMessage(chatId, clientMessageId, { status: 'blocked' });
      useChatStore.getState().setConversationBlockState(chatId, {
        is_blocked: true,
        conversation_status: 'blocked',
        can_send_messages: false,
      });
      options.onBlocked?.(ack as SendMessageAck);
      return;
    }

    // Stop the timer before accruing an attempt, otherwise it fires at 10s and
    // double-counts this failure against the backoff ladder.
    PersistentOfflineQueue.clearMessageTimeout(clientMessageId);
    PersistentOfflineQueue.markFailed(clientMessageId);
    patchOptimisticMessage(chatId, clientMessageId, { status: 'failed' });

    logger.warn('[ChatSend] Server did not acknowledge the message, it stays in the outbox:', ack?.error);
    options.onFailure?.(ack);
  });

  return 'transmitted';
}
