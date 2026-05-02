import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LifeBuoy, MessageSquare, Mail, BookOpen, ChevronRight, HelpCircle, Plus, Clock, CheckCircle, MessageCircle } from 'lucide-react';
import Navbar from '../components/Navbar';
import api from '../api/api';

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
      console.error('Failed to fetch tickets:', err);
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
      alert('Failed to submit ticket. Please try again.');
    } finally {
      setFormLoading(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
        case 'open': return 'bg-blue-100 text-blue-600';
        case 'in_progress': return 'bg-amber-100 text-amber-600';
        case 'resolved': return 'bg-green-100 text-green-600';
        case 'closed': return 'bg-gray-100 text-gray-600';
        default: return 'bg-gray-100 text-gray-600';
    }
  };

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
            <button onClick={() => setShowForm(!showForm)} className="sup-quick-card w-full text-left">
              <div className="sup-quick-icon" style={{ background: 'linear-gradient(135deg, #FF6B8B, #FF3D6D)' }}>
                <Plus size={22} />
              </div>
              <div>
                <div className="sup-quick-title">Create Ticket</div>
                <div className="sup-quick-sub">Open a new support request</div>
              </div>
              <ChevronRight size={18} className="sup-quick-arrow" />
            </button>

            <Link to="/messages" className="sup-quick-card">
              <div className="sup-quick-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
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

          {/* My Tickets Section */}
          <div className="mb-10">
            <div className="sup-section-header">
                <Clock size={22} className="sup-section-icon" />
                <h2>My Support Tickets</h2>
            </div>
            
            <div className="flex flex-col gap-3">
                {loading ? (
                    <div className="p-10 text-center text-gray-400">Loading your tickets...</div>
                ) : tickets.length > 0 ? (
                    tickets.map(ticket => (
                        <div 
                            key={ticket.ticket_id} 
                            onClick={() => navigate(`/support/ticket/${ticket.ticket_id}`)}
                            className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between"
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getStatusStyle(ticket.status)}`}>
                                    {ticket.status === 'resolved' ? <CheckCircle size={20} /> : <MessageCircle size={20} />}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900">{ticket.subject}</div>
                                    <div className="text-xs text-gray-500 uppercase font-semibold mt-0.5">{ticket.category} • {new Date(ticket.created_at).toLocaleDateString()}</div>
                                </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusStyle(ticket.status)}`}>
                                {ticket.status.replace('_', ' ')}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="bg-white/50 border-2 border-dashed border-gray-200 rounded-3xl p-10 text-center flex flex-col items-center">
                        <MessageCircle size={48} className="text-gray-300 mb-3" />
                        <div className="text-gray-500 font-medium">No active support tickets</div>
                        <button onClick={() => setShowForm(true)} className="mt-4 text-[#FF3D6D] font-bold text-sm">Need help? Create one now</button>
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
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                <div className="bg-white rounded-[32px] w-full max-w-xl p-8 shadow-2xl relative animate-scale-in">
                    <button 
                        onClick={() => setShowForm(false)}
                        className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <Plus className="rotate-45 text-gray-500" size={24} />
                    </button>

                    <h2 className="text-2xl font-black text-gray-900 mb-2">Need a hand?</h2>
                    <p className="text-gray-500 mb-8">Tell us what's going on and we'll jump in.</p>

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
        .page-wrapper { display: flex; background: var(--bg-main, #f0f2f5); min-height: 100vh; }
        .sup-content { flex: 1; overflow-y: auto; }
        .sup-container { max-width: 820px; margin: 0 auto; padding: 30px 24px 100px; }

        .sup-hero { display: flex; align-items: center; gap: 20px; background: linear-gradient(135deg, #FF6B8B, #FF3D6D); color: white; padding: 40px; border-radius: 32px; margin-bottom: 28px; box-shadow: 0 16px 40px rgba(255,61,109,0.2); }
        .sup-hero-icon { width: 70px; height: 70px; background: rgba(255,255,255,0.2); border-radius: 22px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .sup-hero h1 { font-size: 2.2rem; font-weight: 900; margin: 0 0 6px; letter-spacing: -1px; }
        .sup-hero p { margin: 0; opacity: 0.9; font-size: 1.1rem; }

        .sup-quick-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 48px; }
        .sup-quick-card { display: flex; align-items: center; gap: 16px; background: white; padding: 20px; border-radius: 24px; border: 1px solid rgba(0,0,0,0.04); box-shadow: 0 4px 16px rgba(0,0,0,0.03); text-decoration: none; color: inherit; transition: 0.25s; cursor: pointer; }
        .sup-quick-card:hover { transform: translateY(-4px); box-shadow: 0 16px 32px rgba(0,0,0,0.06); }
        .sup-quick-icon { width: 52px; height: 52px; border-radius: 16px; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
        .sup-quick-title { font-weight: 800; font-size: 16px; color: #0f172a; margin-bottom: 2px; }
        .sup-quick-sub { font-size: 13px; color: #64748b; font-weight: 500; }
        .sup-quick-arrow { color: #cbd5e1; margin-left: auto; flex-shrink: 0; }

        .sup-section-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .sup-section-icon { color: #FF3D6D; }
        .sup-section-header h2 { font-size: 1.4rem; font-weight: 900; color: #0f172a; margin: 0; letter-spacing: -0.3px; }

        .sup-faq-list { display: flex; flex-direction: column; gap: 12px; }
        .sup-faq-item { background: white; border-radius: 20px; border: 1px solid rgba(0,0,0,0.04); overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.02); transition: 0.2s; }
        .sup-faq-item:hover { border-color: #FF6B8B; }
        .sup-faq-question { padding: 20px 24px; font-weight: 700; font-size: 1rem; color: #1e293b; cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; }
        .sup-faq-question::-webkit-details-marker { display: none; }
        .sup-faq-question::after { content: '+'; font-size: 1.4rem; color: #FF3D6D; font-weight: 900; }
        details[open] .sup-faq-question::after { content: '−'; }
        .sup-faq-answer { padding: 0 24px 20px; font-size: 0.95rem; color: #64748b; line-height: 1.7; border-top: 1px solid #f8fafc; padding-top: 16px; }

        .sup-contact-form { display: flex; flex-direction: column; }
        .sup-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .sup-form-field { margin-bottom: 20px; }
        .sup-form-field label { display: block; font-weight: 800; font-size: 0.9rem; color: #1e293b; margin-bottom: 10px; }
        .sup-form-field input, .sup-form-field select, .sup-form-field textarea { width: 100%; padding: 16px 20px; border: 2px solid #f1f5f9; border-radius: 20px; font-size: 1rem; color: #1e293b; background: #f8fafc; box-sizing: border-box; font-family: inherit; transition: 0.25s; }
        .sup-form-field input:focus, .sup-form-field select:focus, .sup-form-field textarea:focus { border-color: #FF3D6D; outline: none; background: white; box-shadow: 0 0 0 4px rgba(255,61,109,0.1); }
        .sup-form-field textarea { resize: none; }
        .sup-submit-btn { background: linear-gradient(135deg, #FF6B8B, #FF3D6D); color: white; border: none; padding: 18px 32px; border-radius: 20px; font-weight: 800; font-size: 1.1rem; cursor: pointer; transition: 0.3s; box-shadow: 0 10px 25px rgba(255,61,109,0.3); }
        .sup-submit-btn:hover { transform: translateY(-2px); box-shadow: 0 15px 35px rgba(255,61,109,0.4); }
        .sup-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
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
