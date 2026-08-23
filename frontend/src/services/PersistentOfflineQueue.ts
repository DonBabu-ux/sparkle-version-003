/**
 * PersistentOfflineQueue.ts
 *
 * Architecture Pillar #11: Persistent Client-Side Outgoing Queue.
 *
 * Outgoing messages are stored in localStorage (IndexedDB via zustand-persist
 * on web, Capacitor Preferences on Android) BEFORE sending, and are only
 * removed after the server ACKs receipt with a real message_id.
 *
 * This means if the user:
 *  - Loses connection mid-send
 *  - Force-closes the app
 *  - The process is killed by Android
 *
 * …the messages will be re-sent automatically on next open.
 *
 * Architecture Pillar #12: Idempotency — every queued item carries a stable
 * client-generated UUID + SHA-256 payload hash so the server can safely
 * deduplicate retransmissions.
 */

import { v4 as uuidv4 } from 'uuid';
import { SparkleStorage } from './SparkleStorageService';

const STORAGE_KEY = 'sparkle_persistent_outgoing_queue';
const RETRY_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 20_000, 30_000, 60_000, 300_000, 900_000];
const MAX_ATTEMPTS = RETRY_DELAYS_MS.length;

export interface OutgoingMessage {
  /** Client-generated UUID — used for server-side idempotency */
  messageId: string;
  chatId: string;
  recipientId?: string;
  senderId: string;
  content?: string;
  type: string;
  mediaUrl?: string;
  replyToId?: string;
  metadata?: string;
  context?: string;
  /** SHA-256 hex of content+type for server integrity check */
  payloadHash: string;
  /** ISO timestamp when this was first queued locally */
  queuedAt: string;
  /** Number of send attempts made so far */
  attempts: number;
  /** ISO timestamp after which next attempt is allowed */
  nextRetryAt: string;
}

/** Simple SHA-256 via Web Crypto API */
async function sha256(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

class PersistentOfflineQueueService {
  private memoryCache: OutgoingMessage[] | null = null;

  private load(): OutgoingMessage[] {
    if (this.memoryCache !== null) return this.memoryCache;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const queue = raw ? JSON.parse(raw) : [];
      this.memoryCache = queue;
      return queue;
    } catch {
      return [];
    }
  }

  private save(queue: OutgoingMessage[]): void {
    this.memoryCache = queue;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
      SparkleStorage.saveOfflineQueue(queue).catch(console.warn);
    } catch (e) {
      console.warn('[PersistentOfflineQueue] Failed to persist queue:', e);
    }
  }

  getAll(): OutgoingMessage[] {
    return this.load();
  }

  async enqueue(payload: Omit<OutgoingMessage, 'payloadHash' | 'queuedAt' | 'attempts' | 'nextRetryAt'> & { messageId?: string }): Promise<OutgoingMessage> {
    const queue = this.load();

    // If caller already generated a UUID (the common case), use it.
    // Otherwise generate one here — but the caller SHOULD always provide it
    // so the optimistic bubble and the queue entry share the same UUID.
    const messageId = payload.messageId || uuidv4();

    const payloadStr = `${payload.senderId}:${payload.content ?? ''}:${payload.mediaUrl ?? ''}:${payload.type}`;
    const payloadHash = await sha256(payloadStr);
    const now = new Date().toISOString();

    // Prevent double-enqueue: if this UUID is already in the queue, skip.
    if (queue.some((m) => m.messageId === messageId)) {
      return queue.find((m) => m.messageId === messageId)!;
    }

    const item: OutgoingMessage = {
      ...payload,
      messageId,
      payloadHash,
      queuedAt: now,
      attempts: 0,
      nextRetryAt: now,
    };

    queue.push(item);
    this.save(queue);
    return item;
  }

  /**
   * Called after a successful server ACK — removes the item from the queue.
   */
  acknowledge(messageId: string): void {
    const queue = this.load().filter((m) => m.messageId !== messageId);
    this.save(queue);
  }

  /**
   * Mark an item as failed and schedule next retry with exponential backoff.
   * Drops the item permanently if MAX_ATTEMPTS is exceeded.
   */
  markFailed(messageId: string): void {
    const queue = this.load();
    const idx = queue.findIndex((m) => m.messageId === messageId);
    if (idx === -1) return;

    const item = queue[idx];
    const nextAttempt = item.attempts + 1;

    if (nextAttempt >= MAX_ATTEMPTS) {
      // Permanently drop — emit an event so UI can show "failed"
      queue.splice(idx, 1);
      window.dispatchEvent(new CustomEvent('sparkle:message-failed', { detail: { messageId } }));
    } else {
      const delayMs = RETRY_DELAYS_MS[nextAttempt];
      queue[idx] = {
        ...item,
        attempts: nextAttempt,
        nextRetryAt: new Date(Date.now() + delayMs).toISOString(),
      };
    }

    this.save(queue);
  }

  /**
   * Returns all messages that are ready for retry right now.
   */
  getDueMessages(): OutgoingMessage[] {
    const now = Date.now();
    return this.load().filter((m) => new Date(m.nextRetryAt).getTime() <= now);
  }

  /**
   * Completely clears the queue (e.g. on logout).
   */
  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('sparkle_persistent_interaction_queue');
  }

  // ── Persistent Interaction Event Queue (Reactions, Edits, Deletes, Pins, Stars) ──
  private loadInteractions(): OutgoingInteraction[] {
    try {
      const raw = localStorage.getItem('sparkle_persistent_interaction_queue');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveInteractions(queue: OutgoingInteraction[]): void {
    try {
      localStorage.setItem('sparkle_persistent_interaction_queue', JSON.stringify(queue));
    } catch (e) {
      console.warn('[PersistentOfflineQueue] Failed to persist interactions:', e);
    }
  }

  enqueueInteraction(item: Omit<OutgoingInteraction, 'operationId' | 'queuedAt' | 'attempts'>): OutgoingInteraction {
    const queue = this.loadInteractions();
    const interaction: OutgoingInteraction = {
      ...item,
      operationId: uuidv4(),
      queuedAt: new Date().toISOString(),
      attempts: 0,
    };
    queue.push(interaction);
    this.saveInteractions(queue);
    return interaction;
  }

  acknowledgeInteraction(operationId: string): void {
    const queue = this.loadInteractions().filter((i) => i.operationId !== operationId);
    this.saveInteractions(queue);
  }

  getDueInteractions(): OutgoingInteraction[] {
    return this.loadInteractions();
  }
}

export interface OutgoingInteraction {
  operationId: string;
  type: 'add-reaction' | 'remove-reaction' | 'edit-message' | 'delete-message' | 'pin-message' | 'star-message';
  chatId: string;
  messageId: string;
  emoji?: string;
  content?: string;
  pinned?: boolean;
  starred?: boolean;
  queuedAt: string;
  attempts: number;
}

export const PersistentOfflineQueue = new PersistentOfflineQueueService();
export default PersistentOfflineQueue;
