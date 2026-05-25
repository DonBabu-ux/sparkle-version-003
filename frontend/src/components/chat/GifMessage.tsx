// src/components/chat/GifMessage.tsx
import React from 'react';
import { designTokens } from '../../theme/designTokens';

interface GifMessageProps {
  media_url: string;
  alt?: string;
}

export const GifMessage: React.FC<GifMessageProps> = ({ media_url, alt = 'GIF' }) => {
  return (
    <div className="max-w-[80%]" style={{ overflow: 'hidden' }}>
      <img
        src={media_url}
        alt={alt}
        loading="lazy"
        style={designTokens.gif}
        className="w-full h-auto object-cover rounded-lg"
      />
    </div>
  );
};
