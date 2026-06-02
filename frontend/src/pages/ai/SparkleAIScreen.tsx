import { useNavigate } from 'react-router-dom';
import { Sparkles, BookOpen, Image, User, Search } from 'lucide-react';
import './SparkleAIScreen.css';
import { useState } from 'react';
import { useUserStore } from '../../store/userStore';

export default function SparkleAIScreen() {
  const navigate = useNavigate();

  const features = [
    { name: 'Study Assistant', icon: <BookOpen size={24} />, route: '/ai/study' },
    { name: 'Captions', icon: <Image size={24} />, route: '/ai/captions' },
    { name: 'Bio Generator', icon: <User size={24} />, route: '/ai/bio' },
    { name: 'Search Sparkle', icon: <Search size={24} />, route: '/ai/search' },
    { name: 'Friend Discovery', icon: <Sparkles size={24} />, route: '/ai/friend' },
  ];

  // Chat state
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const { token } = useUserStore();


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    const userMsg = { role: 'user', content: prompt };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Error: ' + (data.message || 'unknown') }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Network error' }]);
    } finally {
      setLoading(false);
      setPrompt('');
    }
  };


  return (
    <div className="sparkle-ai-container">
      <header className="sparkle-ai-header">
        <h1 className="sparkle-ai-title">Sparkle AI</h1>
        <p className="sparkle-ai-subtitle">What can I help you with today?</p>
      </header>
      <section className="sparkle-ai-features">
        {features.map((f) => (
          <button
            key={f.name}
            className="sparkle-ai-feature-button"
            onClick={() => navigate(f.route)}
          >
            <span className="icon-wrapper">{f.icon}</span>
            <span>{f.name}</span>
          </button>
        ))}
      </section>
      <section className="sparkle-ai-chat">
        <div className="chat-messages" style={{ width: '100%', maxHeight: '60vh', overflowY: 'auto', marginBottom: '1rem' }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ marginBottom: '0.5rem', textAlign: msg.role === 'assistant' ? 'left' : 'right' }}>
              <span style={{ background: msg.role === 'assistant' ? 'rgba(255,255,255,0.1)' : 'rgba(255,149,195,0.2)', padding: '0.5rem 0.75rem', borderRadius: '8px', display: 'inline-block' }}>{msg.content}</span>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Ask Sparkle AI..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            style={{ flexGrow: 1, padding: '0.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.2)', color: '#fff' }}
          />
          <button type="submit" disabled={loading} className="sparkle-ai-feature-button" style={{ padding: '0.5rem 1rem' }}>
            {loading ? '…' : 'Send'}
          </button>
        </form>
      </section>
    </div>
  );
}
