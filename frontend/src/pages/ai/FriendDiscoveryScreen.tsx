import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import './SparkleAIScreen.css';

export default function FriendDiscoveryScreen() {
  const navigate = useNavigate();
  return (
    <div className="sparkle-ai-container">
      <header className="sparkle-ai-header">
        <button className="sparkle-ai-feature-button" onClick={() => navigate('/ai')}>
          <span className="icon-wrapper"><ArrowLeft size={20} /></span>
          <span>Back</span>
        </button>
        <h1 className="sparkle-ai-title">Friend Discovery</h1>
        <p className="sparkle-ai-subtitle">Connect with new people</p>
      </header>
      <section className="sparkle-ai-chat">
        <div className="chat-placeholder">Friend discovery UI coming soon…</div>
      </section>
    </div>
  );
}
