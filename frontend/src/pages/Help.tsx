import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, Bot, Phone, FileText, AlertTriangle,
  Mail, ChevronRight, ChevronDown, BookOpen, Shield, Users, ShoppingBag,
  Zap, Video, Bell, Lock, X, MessageSquare, ExternalLink
} from 'lucide-react';
import api from '../api/api';
import Spinner from '../components/ui/Spinner';

interface FAQ {
  id: number;
  question: string;
  answer: string;
  category: string;
  helpful_count?: number;
}

const HELP_CATEGORIES = [
  { id: 'getting-started', label: 'Getting Started', icon: Zap, description: 'Registration, verification, and profile setup.' },
  { id: 'account', label: 'Account & Security', icon: Shield, description: 'Passwords, 2FA, PIN, and account controls.' },
  { id: 'feed', label: 'Home Feed & Posts', icon: BookOpen, description: 'Posting, feeds, moments, and reels.' },
  { id: 'messaging', label: 'Messaging & Calls', icon: MessageSquare, description: 'Direct chats, voice/video calls, and privacy.' },
  { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag, description: 'Listing, buying, selling, and campus safety.' },
  { id: 'live', label: 'Live Streaming', icon: Video, description: 'Eligibility, broadcasting, and viewing streams.' },
  { id: 'groups', label: 'Sparkle Circles', icon: Users, description: 'Joining, creating, and administering groups.' },
  { id: 'privacy', label: 'Privacy & Safety', icon: Lock, description: 'Blocking, reporting, ghost mode, and data.' },
  { id: 'technical', label: 'Technical Issues', icon: AlertTriangle, description: 'Troubleshooting glitches and bugs.' },
];

const DEFAULT_FAQS: FAQ[] = [
  {
    id: 1,
    question: 'How do I create and verify a Sparkle account?',
    answer: 'Tap "Sign Up" on the welcome screen. Enter your full name, student or personal email, and a secure password. We will send a confirmation email with a verification link. Tap the link to activate your account, then complete your profile with your campus, major, and profile avatar.',
    category: 'getting-started'
  },
  {
    id: 2,
    question: 'How do I reset my password if forgotten?',
    answer: 'On the login screen, click "Forgot Password". Provide your registered email address and submit. A single-use, time-limited password reset link will arrive in your inbox. Click the link and choose a strong new password.',
    category: 'account'
  },
  {
    id: 3,
    question: 'How do I go live on Sparkle?',
    answer: 'Live video broadcasting requires a community threshold of at least 1,000 followers. If eligible, open the Live Streams page, click "Go Live", grant runtime camera and microphone permissions, add a title, and begin broadcasting. Viewers can watch and engage in real time.',
    category: 'live'
  },
  {
    id: 4,
    question: 'How do I buy and sell safely on Sparkle Marketplace?',
    answer: 'Tap Marketplace from the bottom navigation. Browse campus items or tap "Sell Item" to list products. Always communicate through Sparkle chat, inspect items in person, and conduct handoffs in daylight at secure public campus locations.',
    category: 'marketplace'
  },
  {
    id: 5,
    question: 'How do I report harassment, inappropriate posts, or scams?',
    answer: 'Tap the three dots (⋯) in the corner of any post, message, listing, or profile and select "Report". Select the reason that applies. You can also file a formal ticket using our "Report an Issue" form in this Help Centre.',
    category: 'privacy'
  },
  {
    id: 6,
    question: 'How do I turn on Ghost Mode or hide my profile?',
    answer: 'Go to Settings → Account Control → Hide from Users. When Ghost Mode is active, your profile is hidden from search and discovery, but existing connections and messages remain available.',
    category: 'privacy'
  },
  {
    id: 7,
    question: 'What should I do if the app crashes or media fails to upload?',
    answer: 'First verify your internet connection. If uploads stall, verify that media files are under 15MB. Try pulling down to refresh or restart the app. If the problem persists, submit an issue report with steps to reproduce.',
    category: 'technical'
  },
  {
    id: 8,
    question: 'How do I speak to a human support representative?',
    answer: 'You can submit a support ticket via "Submit a Ticket" above, or send an email directly to lilbeelogics@gmail.com. Our support team reviews all requests.',
    category: 'general'
  }
];

export default function Help() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [faqs, setFaqs] = useState<FAQ[]>(DEFAULT_FAQS);
  const [faqsLoading, setFaqsLoading] = useState(true);

  // AI Support Operator State
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchFaqs = async () => {
      try {
        setFaqsLoading(true);
        const { data } = await api.get('/support/faqs');
        if (!cancelled && data?.faqs && Array.isArray(data.faqs) && data.faqs.length > 0) {
          setFaqs(data.faqs);
        }
      } catch {
        // Fallback remains in place
      } finally {
        if (!cancelled) setFaqsLoading(false);
      }
    };
    fetchFaqs();
    return () => { cancelled = true; };
  }, []);

  const filteredFaqs = faqs.filter(faq => {
    const q = searchQuery.trim().toLowerCase();
    return !q || faq.question.toLowerCase().includes(q) || faq.answer.toLowerCase().includes(q);
  });

  const sendAiMessage = async (customPrompt?: string) => {
    const promptToSend = customPrompt || aiInput;
    if (!promptToSend.trim() || aiLoading) return;

    const userText = promptToSend.trim();
    if (!customPrompt) setAiInput('');

    setAiMessages(prev => [...prev, { role: 'user', content: userText }]);
    setAiLoading(true);
    setAiError(false);

    try {
      const { data } = await api.post('/support/ai/chat', {
        message: userText,
        history: aiMessages.slice(-8),
      });

      const reply = data?.reply || "I'm reviewing your request. For personalized assistance, you can also submit a support ticket.";
      setAiMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setAiError(true);
      setAiMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "I'm temporarily having trouble reaching our AI system. You can browse our FAQs below, submit a ticket, or email us at lilbeelogics@gmail.com."
        }
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#f8e7ed] dark:bg-zinc-950 font-sans text-[#18181b] dark:text-zinc-100">
      <div className="max-w-3xl mx-auto px-4 pt-[calc(var(--safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+6rem)]">
        {/* Top Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-full bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 shadow-sm hover:scale-105 active:scale-95 transition-all"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#18181b] dark:text-zinc-100">
              Help <span className="text-[#ff1493]">Centre</span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Documentation, customer support, and issue resolution
            </p>
          </div>
        </div>

        {/* Search Field */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" size={18} />
          <input
            type="text"
            placeholder="Search FAQs and guides..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-[#18181b] dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 outline-none focus:border-[#ff1493] focus:ring-2 focus:ring-[#ff1493]/10 shadow-sm transition-all"
          />
        </div>

        {/* Quick Support Action Cards (Solid Pink accents, clean cards) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {/* AI Support Operator */}
          <button
            onClick={() => setAiChatOpen(true)}
            className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl p-4 text-left hover:border-[#ff1493]/50 transition-all group flex flex-col justify-between"
          >
            <div className="w-10 h-10 rounded-xl bg-[#ff1493]/10 flex items-center justify-center text-[#ff1493] mb-3 group-hover:scale-105 transition-transform">
              <Bot size={20} />
            </div>
            <div>
              <div className="font-bold text-sm text-[#18181b] dark:text-zinc-100">AI Assistant</div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">Instant 24/7 help</div>
            </div>
          </button>

          {/* Speak to a Human */}
          <button
            onClick={() => navigate('/support')}
            className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl p-4 text-left hover:border-[#ff1493]/50 transition-all group flex flex-col justify-between"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3 group-hover:scale-105 transition-transform">
              <Phone size={20} />
            </div>
            <div>
              <div className="font-bold text-sm text-[#18181b] dark:text-zinc-100">Speak to Human</div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">Support tickets</div>
            </div>
          </button>

          {/* Submit a Ticket */}
          <button
            onClick={() => navigate('/support')}
            className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl p-4 text-left hover:border-[#ff1493]/50 transition-all group flex flex-col justify-between"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-3 group-hover:scale-105 transition-transform">
              <FileText size={20} />
            </div>
            <div>
              <div className="font-bold text-sm text-[#18181b] dark:text-zinc-100">Submit Ticket</div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">Track inquiries</div>
            </div>
          </button>

          {/* Report an Issue */}
          <button
            onClick={() => navigate('/report-issue')}
            className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl p-4 text-left hover:border-[#ff1493]/50 transition-all group flex flex-col justify-between"
          >
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 dark:text-red-400 mb-3 group-hover:scale-105 transition-transform">
              <AlertTriangle size={20} />
            </div>
            <div>
              <div className="font-bold text-sm text-[#18181b] dark:text-zinc-100">Report an Issue</div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">Bug or glitch</div>
            </div>
          </button>
        </div>

        {/* Documentation Categories */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Help Categories & Guides
            </h2>
          </div>
          <div className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl overflow-hidden divide-y divide-[#f0e5ec] dark:divide-zinc-800/80">
            {HELP_CATEGORIES.map(cat => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => navigate(`/help/category/${cat.id}`)}
                  className="w-full flex items-center gap-3.5 px-4 py-3.5 hover:bg-[#f6eef3] dark:hover:bg-zinc-800/50 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#ff1493]/10 flex items-center justify-center text-[#ff1493] shrink-0">
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-[#18181b] dark:text-zinc-100">{cat.label}</div>
                    <div className="text-xs text-slate-500 dark:text-zinc-400 truncate">{cat.description}</div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400 dark:text-zinc-500 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Frequently Asked Questions */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              {searchQuery ? `Search Results (${filteredFaqs.length})` : 'Frequently Asked Questions'}
            </h2>
          </div>

          {faqsLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size="small" color="text-primary" />
            </div>
          ) : filteredFaqs.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl p-8 text-center">
              <Search size={32} className="text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">No matching questions found</p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1 mb-4">Try different keywords or ask our AI Support Assistant.</p>
              <button
                onClick={() => setAiChatOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#ff1493] text-white text-xs font-bold transition-transform active:scale-95"
              >
                Ask AI Support
              </button>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl overflow-hidden divide-y divide-[#f0e5ec] dark:divide-zinc-800/80">
              {filteredFaqs.map(faq => (
                <div key={faq.id}>
                  <button
                    className="w-full px-4 py-4 flex items-start justify-between gap-3 text-left hover:bg-[#f6eef3] dark:hover:bg-zinc-800/50 transition-colors"
                    onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
                    aria-expanded={openFaq === faq.id}
                  >
                    <span className="text-sm font-bold text-[#18181b] dark:text-zinc-100 leading-snug">{faq.question}</span>
                    <ChevronDown
                      size={18}
                      className={`shrink-0 mt-0.5 text-slate-400 dark:text-zinc-500 transition-transform ${openFaq === faq.id ? 'rotate-180 text-[#ff1493]' : ''}`}
                    />
                  </button>
                  {openFaq === faq.id && (
                    <div className="px-4 pb-4 pt-1 text-xs sm:text-sm text-slate-600 dark:text-zinc-300 leading-relaxed border-t border-[#f0e5ec] dark:border-zinc-800/60 bg-[#fdf8fa] dark:bg-zinc-900/60">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Email Support Section */}
        <div className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ff1493]/10 flex items-center justify-center text-[#ff1493] shrink-0">
              <Mail size={20} />
            </div>
            <div>
              <div className="font-bold text-sm text-[#18181b] dark:text-zinc-100">Official Support Email</div>
              <div className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">lilbeelogics@gmail.com</div>
            </div>
          </div>
          <a
            href="mailto:lilbeelogics@gmail.com?subject=Sparkle Support Inquiry"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#ff1493] hover:bg-[#ff2d87] text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <span>Send Email</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* AI Support Operator Drawer/Modal */}
      {aiChatOpen && (
        <div className="fixed inset-0 z-[var(--z-modal)] flex flex-col bg-[#f8e7ed] dark:bg-zinc-950 pt-[var(--safe-area-inset-top)] pb-[var(--safe-area-inset-bottom)]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#e6d8e1] dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAiChatOpen(false)}
                className="w-9 h-9 rounded-full bg-[#f8e7ed] dark:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#ff1493] flex items-center justify-center text-white">
                  <Bot size={18} />
                </div>
                <div>
                  <div className="font-bold text-sm text-[#18181b] dark:text-zinc-100">Sparkle AI Support</div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">Online Assistant</span>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => setAiChatOpen(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
            >
              <X size={18} />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {aiMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto py-12">
                <div className="w-14 h-14 rounded-2xl bg-[#ff1493]/10 flex items-center justify-center text-[#ff1493] mb-4">
                  <Bot size={28} />
                </div>
                <h3 className="text-base font-black text-[#18181b] dark:text-zinc-100 mb-1">
                  How can I help you today?
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mb-5 leading-relaxed">
                  I can answer questions regarding Sparkle features, settings, live streaming, and account safety.
                </p>
                <div className="flex flex-col w-full gap-2">
                  {[
                    'How do I go live on Sparkle?',
                    'How do I reset my password?',
                    'How do I report an issue or user?'
                  ].map(prompt => (
                    <button
                      key={prompt}
                      onClick={() => sendAiMessage(prompt)}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 text-xs font-semibold text-[#18181b] dark:text-zinc-200 hover:border-[#ff1493]/50 transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {aiMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-[#ff1493] flex items-center justify-center text-white mr-2 mt-1 shrink-0">
                    <Bot size={14} />
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#ff1493] text-white rounded-br-none'
                      : 'bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 text-[#18181b] dark:text-zinc-100 rounded-bl-none shadow-sm'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {aiLoading && (
              <div className="flex justify-start items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#ff1493] flex items-center justify-center text-white shrink-0">
                  <Bot size={14} />
                </div>
                <div className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff1493] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff1493] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff1493] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          {/* Quick Fallback buttons if error or user wants human support */}
          {aiError && (
            <div className="px-4 py-2 border-t border-[#e6d8e1] dark:border-zinc-800 bg-[#fdf8fa] dark:bg-zinc-900 flex items-center gap-2 overflow-x-auto">
              <button
                onClick={() => { setAiChatOpen(false); navigate('/support'); }}
                className="px-3 py-1.5 rounded-full bg-[#ff1493] text-white text-xs font-bold shrink-0"
              >
                Submit Ticket
              </button>
              <a
                href="mailto:lilbeelogics@gmail.com"
                className="px-3 py-1.5 rounded-full bg-white dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 text-xs font-bold shrink-0"
              >
                Email Support
              </a>
            </div>
          )}

          {/* Input Bar */}
          <div className="px-4 py-3 border-t border-[#e6d8e1] dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-2">
            <input
              type="text"
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiMessage(); } }}
              placeholder="Ask Sparkle Support AI..."
              className="flex-1 bg-[#f8e7ed] dark:bg-zinc-800 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-[#18181b] dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 outline-none focus:ring-2 focus:ring-[#ff1493]/20"
            />
            <button
              onClick={() => sendAiMessage()}
              disabled={!aiInput.trim() || aiLoading}
              className="w-10 h-10 rounded-full bg-[#ff1493] hover:bg-[#ff2d87] disabled:opacity-40 flex items-center justify-center text-white transition-colors shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2 11 13" />
                <path d="M22 2 15 22 11 13 2 9l20-7z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
