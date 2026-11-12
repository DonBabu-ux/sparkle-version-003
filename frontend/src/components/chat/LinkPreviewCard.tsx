// frontend/src/components/chat/LinkPreviewCard.tsx
// Compact link preview card shown below message text when a URL is detected.
import React from 'react';

interface LinkPreviewCardProps {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  favicon?: string;
  domain?: string;
  onOpen?: () => void;
}

export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({
  url,
  title,
  description,
  image,
  favicon,
  domain,
  onOpen,
}) => {
  const handleClick = () => {
    if (onOpen) {
      onOpen();
    } else {
      window.dispatchEvent(new CustomEvent('sparkle:open-link', { detail: { url } }));
    }
  };

  const displayDomain = domain || (() => {
    try { return new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace('www.', ''); } catch { return url; }
  })();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter') handleClick(); }}
      style={{
        marginTop: '8px',
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderLeft: '3px solid #ff1493',
        overflow: 'hidden',
        cursor: 'pointer',
        maxWidth: '100%',
      }}
    >
      {image && (
        <img
          src={image}
          alt={title || 'Link preview'}
          style={{ width: '100%', maxHeight: '120px', objectFit: 'cover', display: 'block' }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <div style={{ padding: '8px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          {favicon && (
            <img
              src={favicon}
              alt=""
              width={16}
              height={16}
              style={{ borderRadius: '2px', flexShrink: 0 }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayDomain}
          </span>
        </div>
        {title && (
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#fff',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: '1.4',
            marginBottom: '2px',
          }}>
            {title}
          </div>
        )}
        {description && (
          <div style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.6)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: '1.4',
          }}>
            {description}
          </div>
        )}
      </div>
    </div>
  );
};

export default LinkPreviewCard;
