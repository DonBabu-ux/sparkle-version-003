import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import './SparkleAIScreen.css';

export default function SearchSparkleScreen() {
  const navigate = useNavigate();
  return (
    <div className="sparkle-ai-container">
      <header className="sparkle-ai-header">
        <button className="sparkle-ai-feature-button" onClick={() => navigate('/ai')}>
          <span className="icon-wrapper"><ArrowLeft size={20} /></span>
          <span>Back</span>
        </button>
        <h1 className="sparkle-ai-title">Search Sparkle</h1>
        <p className="sparkle-ai-subtitle">Find anything across Sparkle</p>
      </header>
      <section className="sparkle-ai-chat">
        <div className="chat-placeholder">Search UI coming soon…</div>
      </section>
    </div>
  );
}
