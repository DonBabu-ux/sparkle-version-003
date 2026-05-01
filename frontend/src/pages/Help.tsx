import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Book, MessageSquare, Shield, AlertTriangle, ChevronRight, Mail } from 'lucide-react';
import Navbar from '../components/Navbar';

export default function Help() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const faqs = [
    { q: 'How do I switch accounts?', a: 'Tap your profile picture in the top right to open the menu, then click the dropdown arrow next to your name to see and switch accounts.' },
    { q: 'How do I verify my profile?', a: 'Go to Menu > See More > Sparkle Verified and follow the instructions to submit your identity documents.' },
    { q: 'What are Confessions?', a: 'Confessions are anonymous posts shared with Sparkle. You can share your secrets or thoughts without revealing your identity.' },
    { q: 'How do I report a problem?', a: 'You can report a post or user by clicking the three dots on the item, or use the "Report a problem" button in the Help Center.' }
  ];

  return (
    <div className="help-root">
      <Navbar />
      <div className="help-content">
        <div className="help-container responsive-container">
          <header className="help-header">
            <button onClick={() => navigate(-1)} className="back-btn">
              <ArrowLeft size={24} />
            </button>
            <div className="header-info">
              <h1>Help Center</h1>
              <p>Find answers, report issues, and get the most out of Sparkle.</p>
            </div>
          </header>

          <div className="help-main">
            {/* Search Bar */}
            <div className="help-search">
              <Search size={20} className="search-icon" />
              <input 
                type="text" 
                placeholder="Search for help articles..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Quick Categories */}
            <div className="help-categories responsive-grid">
              <div className="cat-card responsive-card">
                <div className="cat-icon bg-blue-50 text-blue-500"><Book size={24} /></div>
                <h4>Guides</h4>
                <p>Learn how Sparkle works</p>
              </div>
              <div className="cat-card responsive-card">
                <div className="cat-icon bg-purple-50 text-purple-500"><Shield size={24} /></div>
                <h4>Safety</h4>
                <p>Privacy & security tips</p>
              </div>
              <div className="cat-card responsive-card" onClick={() => navigate('/support')}>
                <div className="cat-icon bg-rose-50 text-rose-500"><MessageSquare size={24} /></div>
                <h4>Support</h4>
                <p>Chat with our team</p>
              </div>
            </div>

            {/* FAQs */}
            <div className="faq-section">
              <h2 className="section-title">Frequently Asked Questions</h2>
              <div className="faq-list responsive-card">
                {faqs.map((faq, i) => (
                  <div key={i} className="faq-item group">
                    <div className="faq-question">
                      <span>{faq.q}</span>
                      <ChevronRight size={18} className="text-slate-300 group-hover:rotate-90 transition-transform" />
                    </div>
                    <div className="faq-answer">{faq.a}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Direct Contact */}
            <div className="contact-section">
              <h2 className="section-title">Still need help?</h2>
              <div className="contact-cards responsive-grid">
                <div className="contact-card responsive-card">
                  <div className="contact-info">
                    <Mail size={20} />
                    <div>
                      <h5>Email Support</h5>
                      <span>support@sparkle.app</span>
                    </div>
                  </div>
                  <button className="contact-btn">Send Email</button>
                </div>
                <div className="contact-card responsive-card">
                  <div className="contact-info">
                    <AlertTriangle size={20} />
                    <div>
                      <h5>Report a Bug</h5>
                      <span>Found a glitch?</span>
                    </div>
                  </div>
                  <button className="contact-btn">Report Issue</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .help-root { display: flex; background: #F8FAFC; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
        .help-content { flex: 1; height: 100vh; overflow-y: auto; padding: 20px; }
        .help-container { max-width: 700px; margin: 40px auto; padding-bottom: 100px; }
        .help-header { display: flex; gap: 20px; margin-bottom: 30px; align-items: flex-start; }
        .back-btn { background: white; border: none; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #1e293b; shadow: 0 4px 12px rgba(0,0,0,0.05); cursor: pointer; }
        .header-info h1 { font-size: 2.2rem; font-weight: 800; color: #0f172a; margin-bottom: 4px; font-family: 'Outfit', sans-serif; }
        .header-info p { color: #64748b; font-size: 1.1rem; }

        .help-search { position: relative; margin-bottom: 40px; }
        .search-icon { position: absolute; left: 20px; top: 50%; transform: translateY(-50%); color: #94a3b8; }
        .help-search input { width: 100%; padding: 18px 20px 18px 56px; border-radius: 24px; border: 1.5px solid #e2e8f0; background: white; outline: none; font-size: 1rem; box-shadow: 0 4px 12px rgba(0,0,0,0.03); transition: all 0.2s; }
        .help-search input:focus { border-color: #1d9bf0; box-shadow: 0 4px 20px rgba(29, 155, 240, 0.1); }

        .help-categories { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 50px; }
        .cat-card { background: white; border-radius: 24px; padding: 24px; text-align: center; border: 1px solid #f1f5f9; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .cat-card:hover { transform: translateY(-5px); border-color: #e2e8f0; }
        .cat-icon { width: 56px; height: 56px; border-radius: 18px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
        .cat-card h4 { font-weight: 800; color: #1e293b; margin-bottom: 4px; }
        .cat-card p { font-size: 0.8rem; color: #64748b; }

        .section-title { font-size: 1rem; font-weight: 800; color: #1e293b; margin-bottom: 20px; padding-left: 10px; text-transform: uppercase; letter-spacing: 1px; }
        .faq-list { background: white; border-radius: 28px; overflow: hidden; border: 1px solid #f1f5f9; box-shadow: 0 4px 12px rgba(0,0,0,0.03); margin-bottom: 50px; }
        .faq-item { border-bottom: 1px solid #f1f5f9; }
        .faq-item:last-child { border-bottom: none; }
        .faq-question { padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-weight: 700; color: #334155; transition: background 0.2s; }
        .faq-item:hover .faq-question { background: #f8fafc; }
        .faq-answer { padding: 0 24px 20px; color: #64748b; font-size: 0.95rem; line-height: 1.6; display: none; }
        .faq-item:hover .faq-answer { display: block; }

        .contact-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
        .contact-card { background: white; border-radius: 24px; padding: 24px; border: 1px solid #f1f5f9; display: flex; flex-direction: column; justify-content: space-between; gap: 20px; }
        .contact-info { display: flex; gap: 12px; color: #1e293b; }
        .contact-info h5 { font-weight: 800; margin-bottom: 2px; }
        .contact-info span { font-size: 0.8rem; color: #64748b; }
        .contact-btn { width: 100%; padding: 12px; border-radius: 12px; border: 1.5px solid #e2e8f0; background: white; color: #1e293b; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
        .contact-btn:hover { background: #f8fafc; border-color: #1e293b; }

        @media (max-width: 640px) {
          .help-categories { grid-template-columns: 1fr; }
          .contact-cards { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
