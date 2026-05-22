import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Reply } from 'lucide-react';
import clsx from 'clsx';

interface SwipeableMessageProps {
  msg: any; // ChatMessage type
  isMe: boolean;
  onSwipeReply: (msg: any) => void;
  children: React.ReactNode;
}

/**
 * A lightweight wrapper that detects horizontal swipe gestures on a message bubble.
 * - Swipe right on received messages triggers a reply (quoting the message).
 * - Swipe left on sent messages can be used for future actions (currently no-op).
 *
 * The implementation uses native Pointer events for maximum performance and
 * avoids external heavy gesture libraries, keeping the bundle premium but lean.
 */
const SwipeableMessage: React.FC<SwipeableMessageProps> = ({ msg, isMe, onSwipeReply, children }) => {
  const [offsetX, setOffsetX] = useState(0);
  const startXRef = useRef(0);
  const threshold = 80; // pixels needed to consider it a swipe

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    setOffsetX(0);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const delta = e.clientX - startXRef.current;
    // Only allow horizontal movement within reasonable bounds
    if (!isMe && delta > 0) {
      // Received messages: allow right swipe
      setOffsetX(delta);
    } else if (isMe && delta < 0) {
      // Sent messages: left swipe (future use)
      setOffsetX(delta);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    // Determine if swipe distance exceeds threshold
    if (!isMe && offsetX > threshold) {
      onSwipeReply(msg);
    } else if (isMe && offsetX < -threshold) {
      // Placeholder for potential future left‑swipe actions on sent messages
    }
    // Reset visual offset
    setOffsetX(0);
  };

  return (
    <motion.div
      style={{ translateX: offsetX }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="relative"
    >
      {/* Reveal a subtle reply indicator while dragging */}
      {offsetX > 20 && (
        <div className="absolute left-0 top-0 h-full flex items-center pl-2 pointer-events-none">
          <Reply size={16} className="text-[#ff1493]" />
        </div>
      )}
      {children}
    </motion.div>
  );
};

export default SwipeableMessage;
