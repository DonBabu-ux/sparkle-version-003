import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Copy, Check, MessageCircle, Mail, Send, Smartphone } from 'lucide-react';
import Navbar from '../components/Navbar';

export default function Invite() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const inviteLink = "https://sparkle.app/join/ref=donbabu";
  const inviteMessage = `Let’s connect on Sparkle — fast, lightweight, and saves data. Download here: ${inviteLink}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join Sparkle',
          text: inviteMessage,
          url: inviteLink,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      copyToClipboard();
    }
  };

  const shareOptions = [
    { name: 'WhatsApp', icon: MessageCircle, color: '#25D366', action: () => window.open(`https://wa.me/?text=${encodeURIComponent(inviteMessage)}`) },
    { name: 'Telegram', icon: Send, color: '#0088cc', action: () => window.open(`https://t.me/share/url?url=${inviteLink}&text=${encodeURIComponent(inviteMessage)}`) },
    { name: 'Messenger', icon: MessageCircle, color: '#0084FF', action: () => window.open(`fb-messenger://share/?link=${encodeURIComponent(inviteLink)}`) },
    { name: 'Email', icon: Mail, color: '#EA4335', action: () => window.open(`mailto:?subject=Join me on Sparkle&body=${encodeURIComponent(inviteMessage)}`) }
  ];

  return (
    <div className="invite-root">
      <Navbar />
      <div className="invite-content">
        <div className="invite-container responsive-container">
          <header className="invite-header">
            <button onClick={() => navigate(-1)} className="back-btn">
              <ArrowLeft size={24} />
            </button>
            <div className="header-info">
              <h1>Invite Friends</h1>
              <p>Grow your Sparkle circle and earn premium rewards.</p>
            </div>
          </header>

          <div className="invite-main">
            <div className="invite-hero-card responsive-card">
              <div className="hero-icon">
                <Share2 size={48} className="text-white" />
              </div>
              <h2>Everything is better with friends</h2>
              <p>Sparkle is fast, lightweight, and saves data. Perfect for campus life!</p>
            </div>

            <div className="invite-link-section">
              <h3 className="section-title">Your Personal Link</h3>
              <div className="link-box responsive-card">
                <div className="link-text truncate">{inviteLink}</div>
                <button onClick={copyToClipboard} className={`copy-btn ${copied ? 'copied' : ''}`}>
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="share-methods">
              <h3 className="section-title">Share via</h3>
              <div className="methods-grid">
                {shareOptions.map(option => (
                  <button key={option.name} className="method-item group" onClick={option.action}>
                    <div className="method-icon" style={{ backgroundColor: option.color }}>
                      <option.icon size={24} className="text-white" />
                    </div>
                    <span>{option.name}</span>
                  </button>
                ))}
                <button className="method-item group" onClick={handleNativeShare}>
                  <div className="method-icon bg-slate-800">
                    <Smartphone size={24} className="text-white" />
                  </div>
                  <span>System Share</span>
                </button>
              </div>
            </div>

            <div className="invite-rewards">
              <h3 className="section-title">Grow & Earn</h3>
              <div className="rewards-card responsive-card">
                <div className="reward-item">
                  <div className="reward-circle">1</div>
                  <p>Send your link to 5 friends</p>
                </div>
                <div className="reward-item">
                  <div className="reward-circle">2</div>
                  <p>Wait for them to join Sparkle</p>
                </div>
                <div className="reward-item">
                  <div className="reward-circle">3</div>
                  <p>Unlock <strong>Sparkle Plus</strong> for 1 month!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .invite-root { display: flex; background: #F0F2F5; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .invite-content { flex: 1; height: 100vh; overflow-y: auto; padding: 20px; }
        .invite-container { max-width: 600px; margin: 40px auto; padding-bottom: 100px; }
        .invite-header { display: flex; gap: 20px; margin-bottom: 40px; align-items: flex-start; }
        .back-btn { background: white; border: none; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #1e293b; shadow: 0 4px 12px rgba(0,0,0,0.05); cursor: pointer; transition: transform 0.2s; }
        .back-btn:active { transform: scale(0.9); }
        .header-info h1 { font-size: 2.2rem; font-weight: 800; color: #0f172a; margin-bottom: 8px; font-family: 'Outfit', sans-serif; }
        .header-info p { color: #64748b; font-size: 1.1rem; line-height: 1.5; }

        .invite-hero-card { background: linear-gradient(135deg, #FF6B8B 0%, #FF3D6D 100%); border-radius: 28px; padding: 40px; text-align: center; color: white; margin-bottom: 40px; box-shadow: 0 20px 40px rgba(255, 61, 109, 0.2); }
        .hero-icon { width: 80px; height: 80px; border-radius: 24px; background: rgba(255, 255, 255, 0.2); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; backdrop-filter: blur(10px); }
        .invite-hero-card h2 { font-size: 1.5rem; font-weight: 800; margin-bottom: 12px; }
        .invite-hero-card p { opacity: 0.9; line-height: 1.6; }

        .section-title { font-size: 0.8rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; padding-left: 8px; }
        .link-box { display: flex; background: white; border-radius: 20px; padding: 10px; border: 1.5px solid #e2e8f0; align-items: center; margin-bottom: 40px; }
        .link-text { flex: 1; padding: 0 15px; color: #1e293b; font-weight: 600; font-size: 0.9rem; }
        .copy-btn { display: flex; align-items: center; gap: 8px; background: #1e293b; color: white; border: none; padding: 12px 20px; border-radius: 14px; font-weight: 800; font-size: 0.9rem; cursor: pointer; transition: all 0.2s; }
        .copy-btn.copied { background: #10b981; }
        .copy-btn:hover { transform: scale(1.05); }

        .methods-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 16px; margin-bottom: 40px; }
        .method-item { display: flex; flex-direction: column; align-items: center; gap: 10px; background: white; border: none; padding: 20px 10px; border-radius: 20px; cursor: pointer; transition: all 0.2s; border: 1px solid #f1f5f9; }
        .method-item:hover { transform: translateY(-5px); border-color: #e2e8f0; }
        .method-icon { width: 50px; height: 50px; border-radius: 15px; display: flex; align-items: center; justify-content: center; transition: transform 0.2s; }
        .method-item:hover .method-icon { transform: scale(1.1); }
        .method-item span { font-size: 0.75rem; font-weight: 800; color: #64748b; }

        .rewards-card { background: white; border-radius: 24px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 20px; }
        .reward-item { display: flex; align-items: center; gap: 16px; }
        .reward-circle { width: 32px; height: 32px; border-radius: 50%; background: #f1f5f9; color: #475569; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.9rem; flex-shrink: 0; }
        .reward-item p { color: #1e293b; font-weight: 700; font-size: 0.95rem; }
        .reward-item strong { color: #FF3D6D; }

        @media (max-width: 480px) {
          .methods-grid { grid-template-columns: repeat(3, 1fr); }
          .invite-hero-card { padding: 30px 20px; }
        }
      `}</style>
    </div>
  );
}
