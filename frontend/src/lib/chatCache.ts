/**
 * chatCache.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * IndexedDB-backed cache for Sparkle chat data via localforage.
 *
 * Stores:
 *  - Inbox / conversation list
 *  - Per-chat message arrays (last 100 msgs per chat)
 *  - Pending outbound read-receipt IDs (to flush on reconnect)
 *
 * Strategy: "cache-first, network-refresh"
 *  1. Immediately return cached data so the UI renders instantly.
 *  2. Fetch fresh data in the background and update the store.
 */
import localforage from 'localforage';

// ── Store instances ──────────────────────────────────────────────────────────
const inboxStore = localforage.createInstance({ name: 'sparkle', storeName: 'inbox' });
const msgsStore  = localforage.createInstance({ name: 'sparkle', storeName: 'messages' });
const miscStore  = localforage.createInstance({ name: 'sparkle', storeName: 'misc' });

const INBOX_KEY       = 'conversations';
const MAX_CACHED_MSGS = 100;

// ── Inbox ────────────────────────────────────────────────────────────────────
export async function getCachedInbox(): Promise<any[] | null> {
  try {
    return await inboxStore.getItem<any[]>(INBOX_KEY);
  } catch {
    return null;
  }
}

export async function setCachedInbox(conversations: any[]): Promise<void> {
  try {
    await inboxStore.setItem(INBOX_KEY, conversations);
  } catch (e) {
    console.warn('[chatCache] setCachedInbox error', e);
  }
}

// ── Per-chat messages ────────────────────────────────────────────────────────
export async function getCachedMessages(chatId: string): Promise<any[] | null> {
  try {
    return await msgsStore.getItem<any[]>(chatId);
  } catch {
    return null;
  }
}

export async function setCachedMessages(chatId: string, messages: any[]): Promise<void> {
  try {
    // Only keep the most recent N messages to cap storage usage
    const trimmed = messages.slice(-MAX_CACHED_MSGS);
    await msgsStore.setItem(chatId, trimmed);
  } catch (e) {
    console.warn('[chatCache] setCachedMessages error', e);
  }
}

/**
 * Merge a new message into the cache, deduplicating by message_id.
 * Call this whenever a socket 'new-message' event fires.
 */
export async function appendMessageToCache(chatId: string, msg: any): Promise<void> {
  try {
    const existing: any[] = (await msgsStore.getItem<any[]>(chatId)) ?? [];
    if (existing.some(m => m.message_id === msg.message_id)) return; // dedup
    const updated = [...existing, msg].slice(-MAX_CACHED_MSGS);
    await msgsStore.setItem(chatId, updated);
  } catch (e) {
    console.warn('[chatCache] appendMessageToCache error', e);
  }
}

// ── Pending read receipts (survive socket disconnect) ────────────────────────
export async function getPendingReadReceipts(): Promise<string[]> {
  try {
    return (await miscStore.getItem<string[]>('pendingReadReceipts')) ?? [];
  } catch {
    return [];
  }
}

export async function setPendingReadReceipts(chatIds: string[]): Promise<void> {
  try {
    // Dedup & keep only last 50 to avoid unbounded growth
    const unique = [...new Set(chatIds)].slice(-50);
    await miscStore.setItem('pendingReadReceipts', unique);
  } catch (e) {
    console.warn('[chatCache] setPendingReadReceipts error', e);
  }
}

export async function clearPendingReadReceipts(): Promise<void> {
  try {
    await miscStore.removeItem('pendingReadReceipts');
  } catch {}
}
