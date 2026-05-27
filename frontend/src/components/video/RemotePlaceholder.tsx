// src/components/video/RemotePlaceholder.tsx
import React from 'react';
import { designTokens } from '../../theme/designTokens';
import './RemotePlaceholder.css';

/**
 * Simulated remote video feed.
 * Displays a blurred avatar with animated gradient overlay to mimic a weak
 * connection / loading state.
 */
export const RemotePlaceholder: React.FC<{ avatarUrl?: string }> = ({ avatarUrl }) => {
  const placeholder = avatarUrl ?? '/placeholder-avatar.png'; // fallback image in public assets
  return (
    <div className="remote-placeholder" style={{
      backgroundImage: `url(${placeholder})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}>
      <div className="gradient-overlay" />
    </div>
  );
};
