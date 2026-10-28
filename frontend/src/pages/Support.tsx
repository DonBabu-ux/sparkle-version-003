import { showError } from '../utils/toast';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LifeBuoy, MessageSquare, BookOpen, ChevronRight, HelpCircle, Plus, Clock, CheckCircle, MessageCircle } from 'lucide-react';
import api from '../api/api';
import { logger } from '../utils/logger';

const FAQ = [
  { q: 'How do I reset my password?', a: 'Go to Settings → Security → Change Password. You can also use "Forgot Password" on the login screen.' },
  { q: 'My posts aren\'t showing up — what\'s wrong?', a: 'Check your internet connection. If the issue persists, try refreshing or clearing your app cache. Contact support if it continues.' },
  { q: 'How do I report a user or content?', a: 'Tap the ⋯ menu on any post or profile, then select "Report". Our moderation team reviews all reports within 24 hours.' },
  { q: 'How does the marketplace work?', a: 'Post items for sale, browse listings, and message sellers directly. All transactions are between students — always meet in safe campus locations.' },
  { q: 'Can I delete my account?', a: 'Yes. Go to Settings → Privacy & Security → Delete Account. This is permanent and cannot be undone.' },
];

interface SupportTicket {
    ticket_id: string;
    subject: string;
    category: string;
    status: string;
    created_at: string;
}

export default function Support() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    subject: '',
    category: 'marketplace',
    description: '',
    priority: 'medium'
  });

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await api.get('/support/tickets');
      if (res.data.success) {
        setTickets(res.data.tickets);
      }
    } catch (err) {
      logger.error('Failed to fetch tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    try {
      const res = await api.post('/support/tickets', formData);
      if (res.data.success) {
        setShowForm(false);
        setFormData({ subject: '', category: 'marketplace', description: '', priority: 'medium' });
        fetchTickets();
        // Option to navigate to the ticket immediately
        // navigate(`/support/ticket/${res.data.ticketId}`);
      }
    } catch (err) {
      showError('Failed to submit ticket. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
        case 'open': return 'bg-pink-500/10 text-pink-600 dark:text-pink-400';
        case 'in_progress': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
        case 'resolved': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
        default: return 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400';
    }
  };

  const getStatusIconColor = (status: string) => {
    switch(status) {
        case 'open': return 'text-[#ff1493]';
        case 'in_progress': return 'text-amber-500';
        case 'resolved': return 'text-emerald-500';
        default: return 'text-slate-600 dark:text-zinc-400';
    }
  };

  return (
    <div className="page-wrapper">
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
            <button onClick={() => setShowForm(!showForm)} className="sup-quick-card w-full text-left">
              <div className="sup-quick-icon">
                <Plus size={22} />
              </div>
              <div>
                <div className="sup-quick-title">Create Ticket</div>
                <div className="sup-quick-sub">Open a new support request</div>
              </div>
              <ChevronRight size={18} className="sup-quick-arrow" />
            </button>

            <Link to="/messages" className="sup-quick-card">
              <div className="sup-quick-icon">
                <MessageSquare size={22} />
              </div>
              <div>
                <div className="sup-quick-title">Live Chat</div>
                <div className="sup-quick-sub">Message our support bot</div>
              </div>
              <ChevronRight size={18} className="sup-quick-arrow" />
            </Link>

            <a href="https://docs.sparkle.campus" target="_blank" rel="noopener noreferrer" className="sup-quick-card">
              <div className="sup-quick-icon">
                <BookOpen size={22} />
              </div>
              <div>
                <div className="sup-quick-title">Documentation</div>
                <div className="sup-quick-sub">Browse all guides</div>
              </div>
              <ChevronRight size={18} className="sup-quick-arrow" />
            </a>
          </div>

          {/* My Tickets Section */}
          <div className="mb-10">
            <div className="sup-section-header">
                <Clock size={22} className="sup-section-icon" />
                <h2>My Support Tickets</h2>
            </div>
            
            <div className="flex flex-col gap-3">
                {loading ? (
                    <div className="p-10 text-center text-slate-600 dark:text-zinc-400">Loading your tickets...</div>
                ) : tickets.length > 0 ? (
                    tickets.map(ticket => (
                        <div 
                            key={ticket.ticket_id} 
                            onClick={() => navigate(`/support/ticket/${ticket.ticket_id}`)}
                            className="bg-[#fdf8fa] dark:bg-zinc-800 p-4 rounded-2xl border border-[#e6d8e1] dark:border-zinc-700 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 flex items-center justify-center shrink-0 ${getStatusIconColor(ticket.status)}`}>
                                    {ticket.status === 'resolved' ? <CheckCircle size={20} /> : <MessageCircle size={20} />}
                                </div>
                                <div>
                                    <div className="font-bold text-[#18181b] dark:text-zinc-100">{ticket.subject}</div>
                                    <div className="text-xs text-slate-600 dark:text-zinc-400 uppercase font-semibold mt-0.5">{ticket.category} • {new Date(ticket.created_at).toLocaleDateString()}</div>
                                </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusStyle(ticket.status)}`}>
                                {ticket.status.replace('_', ' ')}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="bg-[#f6eef3] border-2 border-dashed border-[#e6d8e1] dark:border-zinc-700 rounded-3xl p-10 text-center flex flex-col items-center">
                        <MessageCircle size={48} className="text-slate-600 dark:text-zinc-400 mb-3" />
                        <div className="text-slate-600 dark:text-zinc-400 font-medium">No active support tickets</div>
                        <button onClick={() => setShowForm(true)} className="mt-4 text-[#ff1493] font-bold text-sm">Need help? Create one now</button>
                    </div>
                )}
            </div>
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

          {/* Contact Form / Modal Style */}
          {showForm && (
            <div className="fixed inset-0 z-(--z-sheet) flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-[#fdf8fa] dark:bg-zinc-800 rounded-[32px] w-full max-w-xl p-8 shadow-2xl relative animate-scale-in">
                    <button 
                        onClick={() => setShowForm(false)}
                        className="absolute top-6 right-6 p-2 hover:bg-[#f6eef3] dark:hover:bg-zinc-700 rounded-full transition-colors"
                    >
                        <Plus className="rotate-45 text-gray-500 dark:text-zinc-400" size={24} />
                    </button>

                    <h2 className="text-2xl font-black text-[#18181b] dark:text-zinc-100 mb-2">Need a hand?</h2>
                    <p className="text-slate-600 dark:text-zinc-400 mb-8">Tell us what's going on and we'll jump in.</p>

                    <form className="sup-contact-form" onSubmit={handleSubmit}>
                        <div className="sup-form-field">
                            <label>Subject</label>
                            <input 
                                type="text" 
                                placeholder="Short summary of the issue" 
                                value={formData.subject}
                                onChange={(e) => setFormData({...formData, subject: e.target.value})}
                                required 
                            />
                        </div>
                        
                        <div className="sup-form-row">
                            <div className="sup-form-field">
                                <label>Category</label>
                                <select 
                                    value={formData.category}
                                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                                >
                                    <option value="marketplace">Marketplace</option>
                                    <option value="account">Account & Security</option>
                                    <option value="moment">Moments/Feed</option>
                                    <option value="group">Groups</option>
                                    <option value="billing">Billing/Payouts</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="sup-form-field">
                                <label>Priority</label>
                                <select
                                    value={formData.priority}
                                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                                >
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                    <option value="urgent">Urgent</option>
                                </select>
                            </div>
                        </div>

                        <div className="sup-form-field">
                            <label>Description</label>
                            <textarea 
                                rows={4} 
                                placeholder="Give us as much detail as possible..." 
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                                required 
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={formLoading}
                            className="sup-submit-btn w-full flex items-center justify-center gap-2"
                        >
                            {formLoading ? 'Submitting...' : 'Send Support Request'}
                        </button>
                    </form>
                </div>
            </div>
          )}
        </main>
      </div>

      <style>{`
        .page-wrapper { display: flex; background: var(--bg-main); min-height: 100dvh; }
        .sup-content { flex: 1; overflow-y: auto; }
        .sup-container { max-width: 820px; margin: 0 auto; padding: 30px 24px 100px; }

        .sup-hero { display: flex; align-items: center; gap: 20px; background: #fdf8fa; color: #18181b; padding: 32px; border-radius: 32px; margin-bottom: 28px; border: 1px solid #e6d8e1; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
        .sup-hero-icon { color: #ff1493; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sup-hero h1 { font-size: 2rem; font-weight: 900; margin: 0 0 6px; letter-spacing: -1px; color: #18181b; }
        .sup-hero p { margin: 0; color: #475569; font-size: 1.05rem; }

        .sup-quick-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 48px; }
        .sup-quick-card { display: flex; align-items: center; gap: 16px; background: #fdf8fa; padding: 20px; border-radius: 24px; border: 1px solid #e6d8e1; box-shadow: 0 4px 16px rgba(0,0,0,0.03); text-decoration: none; color: inherit; transition: 0.25s; cursor: pointer; }
        .sup-quick-card:hover { transform: translateY(-4px); box-shadow: 0 16px 32px rgba(0,0,0,0.06); }
        .sup-quick-icon { display: flex; align-items: center; justify-content: center; color: #ff1493; flex-shrink: 0; }
        .sup-quick-title { font-weight: 800; font-size: 16px; color: #18181b; margin-bottom: 2px; }
        .sup-quick-sub { font-size: 13px; color: #475569; font-weight: 500; }
        .sup-quick-arrow { color: #475569; margin-left: auto; flex-shrink: 0; }

        .sup-section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .sup-section-icon { color: #ff1493; }
        .sup-section-header h2 { font-size: 1.4rem; font-weight: 900; color: #18181b; margin: 0; letter-spacing: -0.3px; }

        .sup-faq-list { display: flex; flex-direction: column; gap: 12px; }
        .sup-faq-item { background: #fdf8fa; border-radius: 20px; border: 1px solid #e6d8e1; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.02); transition: 0.2s; }
        .sup-faq-item:hover { border-color: #ff1493; }
        .sup-faq-question { padding: 20px 24px; font-weight: 700; font-size: 1rem; color: #18181b; cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; }
        .sup-faq-question::-webkit-details-marker { display: none; }
        .sup-faq-question::after { content: '+'; font-size: 1.4rem; color: #ff1493; font-weight: 900; }
        details[open] .sup-faq-question::after { content: '−'; }
        .sup-faq-answer { padding: 0 24px 20px; font-size: 0.95rem; color: #475569; line-height: 1.7; border-top: 1px solid #ede3e9; padding-top: 16px; }

        .sup-contact-form { display: flex; flex-direction: column; }
        .sup-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .sup-form-field { margin-bottom: 20px; }
        .sup-form-field label { display: block; font-weight: 800; font-size: 0.9rem; color: #18181b; margin-bottom: 10px; }
        .sup-form-field input, .sup-form-field select, .sup-form-field textarea { width: 100%; padding: 16px 20px; border: 2px solid #e6d8e1; border-radius: 20px; font-size: 1rem; color: #18181b; background: #f6eef3; box-sizing: border-box; font-family: inherit; transition: 0.25s; }
        .sup-form-field input::placeholder, .sup-form-field textarea::placeholder { color: #475569; }
        .sup-form-field input:focus, .sup-form-field select:focus, .sup-form-field textarea:focus { border-color: #ff1493; outline: none; background: #fdf8fa; box-shadow: 0 0 0 4px rgba(255,20,147,0.15); }
        .sup-form-field textarea { resize: none; }
        .sup-submit-btn { background: #ff1493; color: white; border: none; padding: 18px 32px; border-radius: 20px; font-weight: 800; font-size: 1.1rem; cursor: pointer; transition: 0.3s; box-shadow: 0 10px 25px rgba(255,20,147,0.25); }
        .sup-submit-btn:hover { transform: translateY(-2px); box-shadow: 0 15px 35px rgba(255,20,147,0.35); }
        .sup-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        /* Dark mode: these surfaces were authored light-only */
        .dark .sup-hero { background: #27272a; border-color: #3f3f46; box-shadow: none; }
        .dark .sup-hero h1 { color: #f4f4f5; }
        .dark .sup-hero p { color: #a1a1aa; }
        .dark .sup-quick-card, .dark .sup-faq-item { background: #27272a; border-color: #3f3f46; }
        .dark .sup-quick-title, .dark .sup-section-header h2, .dark .sup-faq-question, .dark .sup-form-field label { color: #f4f4f5; }
        .dark .sup-quick-sub, .dark .sup-faq-answer { color: #a1a1aa; }
        .dark .sup-faq-answer { border-top-color: #18181b; }
        .dark .sup-quick-arrow { color: #a1a1aa; }
        .dark .sup-form-field input, .dark .sup-form-field select, .dark .sup-form-field textarea { background: #18181b; border-color: #3f3f46; color: #f4f4f5; }
        .dark .sup-form-field input:focus, .dark .sup-form-field select:focus, .dark .sup-form-field textarea:focus { background: #18181b; }
        .dark .sup-form-field input::placeholder, .dark .sup-form-field textarea::placeholder { color: #a1a1aa; }

        .animate-scale-in { animation: scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

        @media (max-width: 600px) {
          .sup-hero { flex-direction: column; text-align: center; padding: 32px 24px; }
          .sup-hero-icon { margin-bottom: 12px; }
          .sup-form-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}



