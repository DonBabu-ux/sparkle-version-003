import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Book, MessageSquare, Shield, AlertTriangle, ChevronRight, Mail } from 'lucide-react';

export default function Help() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    { q: 'How do I switch accounts?', a: 'Tap your profile picture in the top right to open the menu, then click the dropdown arrow next to your name to see and switch accounts.' },
    { q: 'How do I verify my profile?', a: 'Go to Menu > See More > Sparkle Verified and follow the instructions to submit your identity documents.' },
    { q: 'What are Confessions?', a: 'Confessions are anonymous posts shared with Sparkle. You can share your secrets or thoughts without revealing your identity.' },
    { q: 'How do I report a problem?', a: 'You can report a post or user by clicking the three dots on the item, or use the "Report a problem" button in the Help Center.' }
  ];

  return (
    <div className="help-root">
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
                <div className="cat-icon bg-pink-500/10 text-[#ff1493] dark:bg-pink-500/15 dark:text-[#ff1493]"><Book size={24} /></div>
                <h4>Guides</h4>
                <p>Learn how Sparkle works</p>
              </div>
              <div className="cat-card responsive-card">
                <div className="cat-icon bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"><Shield size={24} /></div>
                <h4>Safety</h4>
                <p>Privacy & security tips</p>
              </div>
              <div className="cat-card responsive-card" onClick={() => navigate('/support')}>
                <div className="cat-icon bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400"><MessageSquare size={24} /></div>
                <h4>Support</h4>
                <p>Chat with our team</p>
              </div>
            </div>

            {/* FAQs */}
            <div className="faq-section">
              <h2 className="section-title">Frequently Asked Questions</h2>
              <div className="faq-list responsive-card">
                {faqs
                  .map((faq, i) => ({ faq, i }))
                  .filter(({ faq }) => {
                    const q = searchQuery.trim().toLowerCase();
                    return !q || faq.q.toLowerCase().includes(q) || faq.a.toLowerCase().includes(q);
                  })
                  .map(({ faq, i }) => (
                  <div key={i} className={`faq-item group ${openFaq === i ? 'open' : ''}`}>
                    <div
                      className="faq-question"
                      role="button"
                      tabIndex={0}
                      aria-expanded={openFaq === i}
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenFaq(openFaq === i ? null : i); } }}
                    >
                      <span>{faq.q}</span>
                      <ChevronRight size={18} className="text-slate-600 dark:text-zinc-300 group-hover:rotate-90 transition-transform" />
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
                  <button className="contact-btn" onClick={() => { window.location.href = 'mailto:support@sparkle.app'; }}>Send Email</button>
                </div>
                <div className="contact-card responsive-card">
                  <div className="contact-info">
                    <AlertTriangle size={20} />
                    <div>
                      <h5>Report a Bug</h5>
                      <span>Found a glitch?</span>
                    </div>
                  </div>
                  <button className="contact-btn" onClick={() => navigate('/support')}>Report Issue</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .help-root { display: flex; background: #f8e7ed; min-height: 100dvh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; transition: background 0.3s; }
        .dark .help-root { background: #18181b; }
        .help-content { flex: 1; height: 100dvh; overflow-y: auto; padding: 20px; }
        .help-container { max-width: 700px; margin: 40px auto; padding-bottom: 100px; }
        .help-header { display: flex; gap: 20px; margin-bottom: 30px; align-items: flex-start; }
        .back-btn { background: #fdf8fa; border: none; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #18181b; box-shadow: 0 4px 12px rgba(0,0,0,0.05); cursor: pointer; }
        .dark .back-btn { background: #27272a; color: #f4f4f5; border: 1px solid #3f3f46; }
        .header-info h1 { font-size: 2.2rem; font-weight: 800; color: #18181b; margin-bottom: 4px; font-family: 'Outfit', sans-serif; }
        .dark .header-info h1 { color: #f4f4f5; }
        .header-info p { color: #475569; font-size: 1.1rem; }
        .dark .header-info p { color: #d4d4d8; }

        .help-search { position: relative; margin-bottom: 40px; }
        .search-icon { position: absolute; left: 20px; top: 50%; transform: translateY(-50%); color: #475569; }
        .dark .search-icon { color: #d4d4d8; }
        .help-search input { width: 100%; padding: 18px 20px 18px 56px; border-radius: 24px; border: 1.5px solid #e6d8e1; background: #fdf8fa; outline: none; font-size: 1rem; box-shadow: 0 4px 12px rgba(0,0,0,0.03); transition: all 0.2s; }
        .dark .help-search input { background: #18181b; border-color: #3f3f46; color: #f4f4f5; }
        .help-search input:focus { border-color: #ff1493; box-shadow: 0 4px 20px rgba(255, 20, 147, 0.12); }
        .dark .help-search input:focus { border-color: #ff1493; }

        .help-categories { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 50px; }
        .cat-card { background: #fdf8fa; border-radius: 24px; padding: 24px; text-align: center; border: 1px solid #e6d8e1; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.03); }
        .dark .cat-card { background: #27272a; border-color: #3f3f46; }
        .cat-card:hover { transform: translateY(-5px); border-color: #e7dae3; }
        .dark .cat-card:hover { border-color: #52525b; }
        .cat-icon { width: 56px; height: 56px; border-radius: 18px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
        .cat-card h4 { font-weight: 800; color: #18181b; margin-bottom: 4px; }
        .dark .cat-card h4 { color: #f4f4f5; }
        .cat-card p { font-size: 0.8rem; color: #475569; }
        .dark .cat-card p { color: #d4d4d8; }

        .section-title { font-size: 1rem; font-weight: 800; color: #18181b; margin-bottom: 20px; padding-left: 10px; text-transform: uppercase; letter-spacing: 1px; }
        .dark .section-title { color: #f4f4f5; }
        .faq-list { background: #fdf8fa; border-radius: 28px; overflow: hidden; border: 1px solid #e6d8e1; box-shadow: 0 4px 12px rgba(0,0,0,0.03); margin-bottom: 50px; }
        .dark .faq-list { background: #27272a; border-color: #3f3f46; }
        .faq-item { border-bottom: 1px solid #ede3e9; }
        .dark .faq-item { border-bottom-color: #18181b; }
        .faq-item:last-child { border-bottom: none; }
        .faq-question { padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; font-weight: 700; color: #334155; transition: background 0.2s; }
        .dark .faq-question { color: #d4d4d8; }
        .faq-item:hover .faq-question { background: #f6eef3; }
        .dark .faq-item:hover .faq-question { background: #18181b; }
        .faq-answer { padding: 0 24px 20px; color: #475569; font-size: 0.95rem; line-height: 1.6; display: none; }
        .dark .faq-answer { color: #d4d4d8; }
        .faq-item:hover .faq-answer { display: block; }
        .faq-item.open .faq-answer { display: block; }
        .faq-item.open .faq-question { background: #f6eef3; }
        .dark .faq-item.open .faq-question { background: #18181b; }
        .faq-item.open .faq-question svg { transform: rotate(90deg); }

        .contact-cards { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
        .contact-card { background: #fdf8fa; border-radius: 24px; padding: 24px; border: 1px solid #e6d8e1; display: flex; flex-direction: column; justify-content: space-between; gap: 20px; }
        .dark .contact-card { background: #27272a; border-color: #3f3f46; }
        .contact-info { display: flex; gap: 12px; color: #18181b; }
        .dark .contact-info { color: #f4f4f5; }
        .contact-info h5 { font-weight: 800; margin-bottom: 2px; }
        .contact-info span { font-size: 0.8rem; color: #475569; }
        .contact-btn { width: 100%; padding: 12px; border-radius: 12px; border: 1.5px solid #e6d8e1; background: #fdf8fa; color: #18181b; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
        .dark .contact-btn { background: #18181b; border-color: #3f3f46; color: #f4f4f5; }
        .contact-btn:hover { background: #f6eef3; border-color: #18181b; }
        .dark .contact-btn:hover { background: #3f3f46; border-color: #f4f4f5; }

        @media (max-width: 640px) {
          .help-categories { grid-template-columns: 1fr; }
          .contact-cards { grid-template-columns: 1fr; }
        }

        .dark .contact-info span { color: #d4d4d8; }
      `}</style>
    </div>
  );
}



