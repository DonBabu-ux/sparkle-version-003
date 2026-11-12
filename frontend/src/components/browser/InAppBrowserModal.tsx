// frontend/src/components/browser/InAppBrowserModal.tsx
// Full-screen in-app browser modal for safely opening links within Sparkle.
import React, { useState, useEffect } from 'react';
import api from '../../api/api';

type RiskLevel = 'SAFE' | 'SUSPICIOUS' | 'DANGEROUS';

interface SafetyResult {
  safe: boolean;
  risk: RiskLevel;
  reason: string;
}

interface InAppBrowserModalProps {
  url: string;
  onClose: () => void;
}

function getDomain(url: string): string {
  try {
    return new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

function openInChrome(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

function copyLink(url: string) {
  navigator.clipboard?.writeText(url).catch(() => {});
}

export const InAppBrowserModal: React.FC<InAppBrowserModalProps> = ({ url, onClose }) => {
  const [safety, setSafety] = useState<SafetyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [suspiciousDismissed, setSuspiciousDismissed] = useState(false);

  const domain = getDomain(url);

  useEffect(() => {
    setLoading(true);
    setSafety(null);
    setIframeLoaded(false);

    api
      .get(`/link-preview/safety?url=${encodeURIComponent(url)}`)
      .then((res) => {
        setSafety(res.data as SafetyResult);
      })
      .catch(() => {
        // Default to safe on error
        setSafety({ safe: true, risk: 'SAFE', reason: 'Could not check safety; proceeding.' });
      })
      .finally(() => setLoading(false));
  }, [url]);

  const riskBadge = () => {
    if (!safety) return null;
    const badge: Record<RiskLevel, { icon: string; color: string; label: string }> = {
      SAFE: { icon: '🟢', color: '#22c55e', label: 'Safe' },
      SUSPICIOUS: { icon: '🟡', color: '#eab308', label: 'Suspicious' },
      DANGEROUS: { icon: '🔴', color: '#ef4444', label: 'Dangerous' },
    };
    const b = badge[safety.risk] || badge['SAFE'];
    return (
      <span style={{ fontSize: '12px', color: b.color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
        {b.icon} {b.label}
      </span>
    );
  };

  const isDangerous = safety?.risk === 'DANGEROUS';
  const isSuspicious = safety?.risk === 'SUSPICIOUS' && !suspiciousDismissed;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        background: '#0d0d14',
      }}
    >
      {/* Top Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 14px',
          background: '#13131c',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {domain}
          </div>
          <div>{riskBadge()}</div>
        </div>

        {/* Menu */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen((p) => !p)}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px', fontSize: '18px' }}
            aria-label="More options"
          >
            ⋮
          </button>
          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '100%',
                background: '#1e1e2e',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '10px',
                overflow: 'hidden',
                minWidth: '170px',
                zIndex: 10000,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              {[
                { label: '🌐 Open in Chrome', action: () => { openInChrome(url); setMenuOpen(false); } },
                { label: '📋 Copy Link', action: () => { copyLink(url); setMenuOpen(false); } },
                { label: '↗ Share', action: () => {
                  if (navigator.share) navigator.share({ url }).catch(() => {});
                  setMenuOpen(false);
                }},
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={item.action}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    fontSize: '13px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '36px', height: '36px', border: '3px solid rgba(255,20,147,0.3)', borderTopColor: '#ff1493', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {!loading && isDangerous && (
          <div style={{ position: 'absolute', inset: 0, background: '#1a0000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔴</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#ef4444', marginBottom: '8px' }}>Dangerous Link Blocked</div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>{safety?.reason}</div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '24px', wordBreak: 'break-all' }}>{url}</div>
            <button
              onClick={onClose}
              style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 24px', fontWeight: 600, fontSize: '14px', cursor: 'pointer', marginBottom: '12px' }}
            >
              Return to chat
            </button>
            <button
              onClick={() => openInChrome(url)}
              style={{ background: 'none', color: 'rgba(255,255,255,0.4)', border: 'none', fontSize: '12px', cursor: 'pointer' }}
            >
              Report false positive
            </button>
          </div>
        )}

        {!loading && !isDangerous && (
          <>
            {isSuspicious && (
              <div style={{ background: '#7c5c00', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: '#fde047' }}>⚠️ Proceed with caution — this link may be suspicious.</span>
                <button
                  onClick={() => setSuspiciousDismissed(true)}
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}
                >
                  Continue anyway
                </button>
              </div>
            )}
            {(!isSuspicious || suspiciousDismissed) && (
              <>
                {!iframeLoaded && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ width: '36px', height: '36px', border: '3px solid rgba(255,20,147,0.3)', borderTopColor: '#ff1493', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                  </div>
                )}
                <iframe
                  src={url}
                  title="In-App Browser"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                  onLoad={() => setIframeLoaded(true)}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default InAppBrowserModal;
