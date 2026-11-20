import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface EmailVerificationBannerProps {
  userEmail?: string;
}

const EmailVerificationBanner: React.FC<EmailVerificationBannerProps> = ({ userEmail }) => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(
    sessionStorage.getItem('emailBannerDismissed') === '1'
  );

  if (dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem('emailBannerDismissed', '1');
    setDismissed(true);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 16px',
      background: 'var(--sparkle-surface, #1a1a2e)',
      borderLeft: '3px solid var(--sparkle-primary, #ff1493)',
      borderRadius: '8px',
      margin: '8px 12px',
    }}>
      <span style={{ fontSize: '18px' }}>✉️</span>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--sparkle-text, #fff)' }}>
          Verify your email
        </p>
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--sparkle-text-secondary, rgba(255,255,255,0.6))' }}>
          Claim your +25 Sparkle Points{userEmail ? ` — ${userEmail}` : ''}
        </p>
      </div>
      <button
        onClick={() => navigate('/verify-email')}
        style={{
          background: 'var(--sparkle-primary, #ff1493)',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          padding: '5px 12px',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Verify now
      </button>
      <button
        onClick={handleDismiss}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--sparkle-text-secondary, rgba(255,255,255,0.5))',
          fontSize: '16px',
          cursor: 'pointer',
          padding: '0 4px',
          lineHeight: 1,
        }}
        aria-label="Dismiss"
      >×</button>
    </div>
  );
};

export default EmailVerificationBanner;
