import { useEffect, useRef } from 'react';
import { useSocket } from './useSocket';
import { useUserStore } from '../store/userStore';

/**
 * Custom React hook implementing Architecture Pillar #6 & #15:
 * Strict Tri-Condition Read Receipts.
 *
 * Read receipts are ONLY sent when ALL THREE conditions are met:
 * 1. App/Tab is in foreground (`document.visibilityState === 'visible'`)
 * 2. Window is focused (`document.hasFocus()`)
 * 3. Message element is >= 50% visible in the viewport
 */
export const useMessageVisibilityObserver = (
  chatId: string | null,
  containerRef: React.RefObject<HTMLElement | null>
) => {
  const socket = useSocket();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const pendingReadMessageIds = useRef<Set<string>>(new Set());
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!chatId || !socket) return;

    const flushReadReceipts = () => {
      if (pendingReadMessageIds.current.size === 0) return;

      const messageIds = Array.from(pendingReadMessageIds.current);
      pendingReadMessageIds.current.clear();

      socket.emit('message-read-ack', {
        chatId,
        messageIds,
        sessionId: (socket as any).sessionId || null
      });
    };

    const isTriConditionMet = () => {
      const isForeground = document.visibilityState === 'visible';
      const isFocused = document.hasFocus();
      return isForeground && isFocused;
    };

    const handleIntersection: IntersectionObserverCallback = (entries) => {
      if (!isTriConditionMet()) return;

      let hasNew = false;
      const myUserId = useUserStore.getState().user?.user_id || useUserStore.getState().user?.id;

      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          const target = entry.target as HTMLElement;
          const messageId = target.dataset.messageId;
          const senderId = target.dataset.senderId;

          // Only send read ACK for messages sent by the partner/other users
          if (messageId && senderId !== myUserId) {
            pendingReadMessageIds.current.add(messageId);
            hasNew = true;
          }
        }
      });

      if (hasNew) {
        if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
        batchTimeoutRef.current = setTimeout(flushReadReceipts, 300);
      }
    };

    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: containerRef.current,
      threshold: 0.5
    });

    const container = containerRef.current;
    if (container) {
      const messageElements = container.querySelectorAll('[data-message-id]');
      messageElements.forEach((el) => observerRef.current?.observe(el));
    }

    const handleFocusOrVisibilityChange = () => {
      if (isTriConditionMet() && containerRef.current) {
        const messageElements = containerRef.current.querySelectorAll('[data-message-id]');
        messageElements.forEach((el) => observerRef.current?.observe(el));
      }
    };

    window.addEventListener('focus', handleFocusOrVisibilityChange);
    document.addEventListener('visibilitychange', handleFocusOrVisibilityChange);

    return () => {
      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
      flushReadReceipts();
      observerRef.current?.disconnect();
      window.removeEventListener('focus', handleFocusOrVisibilityChange);
      document.removeEventListener('visibilitychange', handleFocusOrVisibilityChange);
    };
  }, [chatId, socket, containerRef]);
};
