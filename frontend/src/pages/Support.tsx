import { Link } from 'react-router-dom';
import { LifeBuoy, MessageSquare, Mail, BookOpen, ChevronRight, HelpCircle } from 'lucide-react';
import Navbar from '../components/Navbar';

const FAQ = [
  { q: 'How do I reset my password?', a: 'Go to Settings → Security → Change Password. You can also use "Forgot Password" on the login screen.' },
  { q: 'My posts aren\'t showing up — what\'s wrong?', a: 'Check your internet connection. If the issue persists, try refreshing or clearing your app cache. Contact support if it continues.' },
  { q: 'How do I report a user or content?', a: 'Tap the ⋯ menu on any post or profile, then select "Report". Our moderation team reviews all reports within 24 hours.' },
  { q: 'How does the marketplace work?', a: 'Post items for sale, browse listings, and message sellers directly. All transactions are between students — always meet in safe campus locations.' },
  { q: 'Can I delete my account?', a: 'Yes. Go to Settings → Privacy & Security → Delete Account. This is permanent and cannot be undone.' },
];

export default function Support() {
  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="sup-content">
        <main className="sup-container">
          {/* Hero */}
          <div className="sup-hero">
            <div className="sup-hero-icon"><LifeBuoy size={36} /></div>
            <div>
              <h1>How can we help?</h1>
              <p>Find answers to common questions or get in touch with our team.</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="sup-quick-grid">
            <a href="mailto:support@sparkle.campus" className="sup-quick-card">
              <div className="sup-quick-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                <Mail size={22} />
              </div>
              <div>
                <div className="sup-quick-title">Email Support</div>
                <div className="sup-quick-sub">support@sparkle.campus</div>
              </div>
              <ChevronRight size={18} className="sup-quick-arrow" />
            </a>

            <Link to="/messages" className="sup-quick-card">
              <div className="sup-quick-icon" style={{ background: 'linear-gradient(135deg, #FF6B8B, #FF3D6D)' }}>
                <MessageSquare size={22} />
              </div>
              <div>
                <div className="sup-quick-title">Live Chat</div>
                <div className="sup-quick-sub">Message our support bot</div>
              </div>
              <ChevronRight size={18} className="sup-quick-arrow" />
            </Link>

            <a href="https://docs.sparkle.campus" target="_blank" rel="noopener noreferrer" className="sup-quick-card">
              <div className="sup-quick-icon" style={{ background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)' }}>
                <BookOpen size={22} />
              </div>
              <div>
                <div className="sup-quick-title">Documentation</div>
                <div className="sup-quick-sub">Browse all guides</div>
              </div>
              <ChevronRight size={18} className="sup-quick-arrow" />
            </a>
          </div>

          {/* FAQ */}
          <div className="sup-section-header">
            <HelpCircle size={22} className="sup-section-icon" />
            <h2>Frequently Asked Questions</h2>
          </div>

          <div className="sup-faq-list">
            {FAQ.map((item, i) => (
              <details key={i} className="sup-faq-item">
                <summary className="sup-faq-question">{item.q}</summary>
                <div className="sup-faq-answer">{item.a}</div>
              </details>
            ))}
          </div>

          {/* Contact Form */}
          <div className="sup-contact-card">
            <h2>Still need help?</h2>
            <p>Describe your issue and we'll get back to you within 24 hours.</p>
            <form className="sup-contact-form" onSubmit={(e) => { e.preventDefault(); alert('Message sent! We\'ll be in touch.'); }}>
              <div className="sup-form-row">
                <div className="sup-form-field">
                  <label>Subject</label>
                  <input type="text" placeholder="What's the issue?" required />
                </div>
                <div className="sup-form-field">
                  <label>Category</label>
                  <select>
                    <option>Account</option>
                    <option>Posting</option>
                    <option>Marketplace</option>
                    <option>Privacy</option>
                    <option>Bug Report</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div className="sup-form-field">
                <label>Message</label>
                <textarea rows={5} placeholder="Describe your problem in detail..." required />
              </div>
              <button type="submit" className="sup-submit-btn">Send Message</button>
            </form>
          </div>
        </main>
      </div>

      <style>{`
        .page-wrapper { display: flex; background: var(--bg-main, #f8fafc); min-height: 100vh; }
        .sup-content { flex: 1; overflow-y: auto; }
        .sup-container { max-width: 820px; margin: 0 auto; padding: 30px 24px 100px; }

        .sup-hero { display: flex; align-items: center; gap: 20px; background: linear-gradient(135deg, #FF6B8B, #FF3D6D); color: white; padding: 40px; border-radius: 28px; margin-bottom: 28px; box-shadow: 0 16px 40px rgba(255,61,109,0.2); }
        .sup-hero-icon { width: 70px; height: 70px; background: rgba(255,255,255,0.2); border-radius: 22px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sup-hero h1 { font-size: 2rem; font-weight: 900; margin: 0 0 6px; letter-spacing: -0.5px; }
        .sup-hero p { margin: 0; opacity: 0.9; font-size: 1rem; }

        .sup-quick-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 14px; margin-bottom: 36px; }
        .sup-quick-card { display: flex; align-items: center; gap: 16px; background: white; padding: 20px; border-radius: 20px; border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 4px 16px rgba(0,0,0,0.04); text-decoration: none; color: inherit; transition: 0.25s; }
        .sup-quick-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(0,0,0,0.08); }
        .sup-quick-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
        .sup-quick-title { font-weight: 800; font-size: 15px; color: #1e293b; margin-bottom: 2px; }
        .sup-quick-sub { font-size: 12px; color: #64748b; font-weight: 500; }
        .sup-quick-arrow { color: #cbd5e1; margin-left: auto; flex-shrink: 0; }

        .sup-section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
        .sup-section-icon { color: #FF3D6D; }
        .sup-section-header h2 { font-size: 1.3rem; font-weight: 900; color: #0f172a; margin: 0; }

        .sup-faq-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 36px; }
        .sup-faq-item { background: white; border-radius: 18px; border: 1px solid rgba(0,0,0,0.06); overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.04); }
        .sup-faq-question { padding: 18px 22px; font-weight: 700; font-size: 0.97rem; color: #1e293b; cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; transition: 0.2s; }
        .sup-faq-question::-webkit-details-marker { display: none; }
        .sup-faq-question::after { content: '+'; font-size: 1.2rem; color: #FF3D6D; font-weight: 900; }
        details[open] .sup-faq-question::after { content: '−'; }
        .sup-faq-question:hover { color: #FF3D6D; }
        .sup-faq-answer { padding: 0 22px 18px; font-size: 0.92rem; color: #64748b; line-height: 1.65; border-top: 1px solid #f1f5f9; padding-top: 14px; }

        .sup-contact-card { background: white; border-radius: 28px; padding: 36px; border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 8px 30px rgba(0,0,0,0.05); }
        .sup-contact-card h2 { font-size: 1.4rem; font-weight: 900; margin: 0 0 6px; color: #0f172a; }
        .sup-contact-card p { color: #64748b; margin: 0 0 28px; }
        .sup-contact-form { display: flex; flex-direction: column; gap: 0; }
        .sup-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; }
        .sup-form-field { margin-bottom: 18px; }
        .sup-form-field label { display: block; font-weight: 700; font-size: 0.88rem; color: #334155; margin-bottom: 8px; }
        .sup-form-field input, .sup-form-field select, .sup-form-field textarea { width: 100%; padding: 13px 15px; border: 2px solid #e2e8f0; border-radius: 16px; font-size: 0.95rem; color: #1e293b; background: #f8fafc; box-sizing: border-box; font-family: inherit; transition: 0.2s; }
        .sup-form-field input:focus, .sup-form-field select:focus, .sup-form-field textarea:focus { border-color: #FF3D6D; outline: none; background: white; }
        .sup-form-field textarea { resize: none; }
        .sup-submit-btn { background: linear-gradient(135deg, #FF6B8B, #FF3D6D); color: white; border: none; padding: 15px 32px; border-radius: 16px; font-weight: 800; font-size: 1rem; cursor: pointer; transition: 0.2s; box-shadow: 0 6px 18px rgba(255,61,109,0.25); }
        .sup-submit-btn:hover { opacity: 0.9; transform: translateY(-2px); }

        @media (max-width: 600px) {
          .sup-hero { flex-direction: column; text-align: center; }
          .sup-form-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
