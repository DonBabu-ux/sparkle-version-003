// frontend/src/components/chat/ExpandableMessageText.tsx
// Renders message text with collapsible "Read more" / "Read less" toggle.
// Handles URL detection, link opening via custom events, and SparklyMarkdown for bot messages.
import React, { useState, useRef, useEffect } from 'react';
import { SparklyMarkdown } from '../sparkly/SparklyMarkdown';
import { detectUrls } from '../../utils/linkUtils';

interface Props {
  text: string;
  isSparkly?: boolean;
  className?: string;
}

const COLLAPSE_THRESHOLD_PX = 110;

function openLink(url: string) {
  const normalized = url.startsWith('http') ? url : 'https://' + url;
  window.dispatchEvent(
    new CustomEvent('sparkle:open-link', { detail: { url: normalized } })
  );
}

/**
 * Render plain text with inline clickable links detected via detectUrls.
 */
function TextWithLinks({ text, className }: { text: string; className?: string }) {
  const urls = detectUrls(text);
  if (urls.length === 0) {
    return (
      <span
        className={className}
        style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}
      >
        {text}
      </span>
    );
  }

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  urls.forEach((u, idx) => {
    if (u.start > cursor) {
      parts.push(
        <span key={`t-${idx}`} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
          {text.slice(cursor, u.start)}
        </span>
      );
    }
    if (u.safe) {
      parts.push(
        <span
          key={`l-${idx}`}
          role="link"
          tabIndex={0}
          onClick={() => openLink(u.url)}
          onKeyDown={(e) => { if (e.key === 'Enter') openLink(u.url); }}
          style={{ color: '#ff1493', textDecoration: 'underline', cursor: 'pointer', wordBreak: 'break-all' }}
        >
          {u.url}
        </span>
      );
    } else {
      // Dangerous URL — render as plain text
      parts.push(
        <span key={`l-${idx}`} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
          {u.url}
        </span>
      );
    }
    cursor = u.end;
  });
  if (cursor < text.length) {
    parts.push(
      <span key="t-end" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
        {text.slice(cursor)}
      </span>
    );
  }

  return (
    <span className={className} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
      {parts}
    </span>
  );
}

export const ExpandableMessageText: React.FC<Props> = ({ text, isSparkly = false, className = '' }) => {
  const [expanded, setExpanded] = useState(false);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (el.scrollHeight > COLLAPSE_THRESHOLD_PX) {
      setNeedsCollapse(true);
    }
  }, [text]);

  const containerStyle: React.CSSProperties = needsCollapse && !expanded
    ? { maxHeight: `${COLLAPSE_THRESHOLD_PX}px`, overflow: 'hidden' }
    : {};

  return (
    <div>
      <div ref={contentRef} style={containerStyle}>
        {isSparkly ? (
          <SparklyMarkdown content={text} className={className} />
        ) : (
          <TextWithLinks text={text} className={className} />
        )}
      </div>
      {needsCollapse && (
        <button
          onClick={() => setExpanded((p) => !p)}
          style={{ color: '#ff1493', fontSize: '12px', fontWeight: 600, marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          {expanded ? 'Read less' : 'Read more'}
        </button>
      )}
    </div>
  );
};

export default ExpandableMessageText;
