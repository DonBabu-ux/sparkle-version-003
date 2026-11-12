import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import api from '../api/api';
import { showError } from '../utils/toast';
import Spinner from '../components/ui/Spinner';

const ISSUE_CATEGORIES = [
  'Login and Registration',
  'Messaging',
  'Reels / Moments',
  'Home Feed and Posts',
  'Marketplace',
  'Groups / Circles',
  'Live Streaming',
  'Notifications',
  'Profile Management',
  'Privacy and Safety',
  'Performance & Glitches',
  'Other',
];

export default function ReportIssue() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketRef, setTicketRef] = useState('');

  const [form, setForm] = useState({
    category: '',
    title: '',
    description: '',
    steps: '',
    expected: '',
    actual: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.category) e.category = 'Please choose a category.';
    if (!form.title.trim() || form.title.trim().length < 5) e.title = 'Please enter a descriptive title (at least 5 characters).';
    if (!form.description.trim() || form.description.trim().length < 20) e.description = 'Please describe the problem in detail (at least 20 characters).';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const description = [
        `Category: ${form.category}`,
        `\nIssue Description:\n${form.description}`,
        form.steps ? `\nSteps to Reproduce:\n${form.steps}` : '',
        form.expected ? `\nExpected Behaviour:\n${form.expected}` : '',
        form.actual ? `\nActual Behaviour:\n${form.actual}` : '',
      ].filter(Boolean).join('\n');

      const { data } = await api.post('/support/tickets', {
        subject: form.title.trim(),
        category: 'technical',
        priority: 'medium',
        description,
        issueCategory: form.category,
      });

      if (data.success) {
        setTicketRef(data.ticketId || '');
        setSubmitted(true);
      } else {
        showError(data.error || 'Failed to submit report. Please try again.');
      }
    } catch (err: any) {
      showError(err?.response?.data?.error || 'Failed to submit report.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-dvh bg-[#f8e7ed] dark:bg-zinc-950 font-sans flex items-center justify-center p-6 pt-[var(--safe-area-inset-top)] pb-[var(--safe-area-inset-bottom)]">
        <div className="max-w-md w-full text-center bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-3xl p-8 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={36} className="text-emerald-500" />
          </div>
          <h2 className="text-2xl font-black text-[#18181b] dark:text-zinc-100 mb-2">Issue Reported</h2>
          <p className="text-xs text-slate-600 dark:text-zinc-400 mb-5 leading-relaxed">
            Thank you for bringing this to our attention. Our technical team will investigate this report.
          </p>
          {ticketRef && (
            <div className="bg-[#f8e7ed] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-2xl p-4 mb-6">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 mb-1">Ticket Reference</p>
              <p className="font-black text-[#ff1493] text-lg select-all">{ticketRef}</p>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1">You can quote this reference in support communications.</p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => navigate('/support')}
              className="w-full py-3 rounded-xl bg-[#ff1493] hover:bg-[#ff2d87] text-white font-bold text-sm transition-colors shadow-md shadow-[#ff1493]/20"
            >
              View My Tickets
            </button>
            <button
              onClick={() => navigate('/help')}
              className="w-full py-3 rounded-xl bg-transparent border border-[#e6d8e1] dark:border-zinc-700 text-[#18181b] dark:text-zinc-200 font-bold text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              Back to Help Centre
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#f8e7ed] dark:bg-zinc-950 font-sans">
      <div className="max-w-2xl mx-auto px-4 pt-[calc(var(--safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+6rem)]">
        {/* Navigation Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 shadow-sm hover:scale-105 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-[#18181b] dark:text-zinc-100 tracking-tight">Report an Issue</h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">Technical problems, glitches, or bugs</p>
          </div>
        </div>

        {/* Notice Card */}
        <div className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <ShieldAlert size={20} className="text-[#ff1493] shrink-0 mt-0.5" />
          <p className="text-xs text-slate-600 dark:text-zinc-300 leading-relaxed">
            Please be as specific as possible. Do not include passwords, payment cards, or sensitive personal credentials in your report.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Issue Category */}
          <div className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl p-4 sm:p-5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#18181b] dark:text-zinc-200 mb-2">
              Affected Sparkle Feature <span className="text-[#ff1493]">*</span>
            </label>
            <select
              value={form.category}
              onChange={e => { setForm(f => ({ ...f, category: e.target.value })); setErrors(er => ({ ...er, category: '' })); }}
              className="w-full bg-[#f8e7ed] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-[#18181b] dark:text-zinc-100 outline-none focus:border-[#ff1493]"
            >
              <option value="">Choose an affected area...</option>
              {ISSUE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.category && <p className="text-xs text-red-500 mt-1.5">{errors.category}</p>}
          </div>

          {/* Title */}
          <div className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl p-4 sm:p-5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#18181b] dark:text-zinc-200 mb-2">
              Issue Title <span className="text-[#ff1493]">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={e => { setForm(f => ({ ...f, title: e.target.value })); setErrors(er => ({ ...er, title: '' })); }}
              placeholder="e.g. Cannot post comment on Moment or video upload stalls"
              className="w-full bg-[#f8e7ed] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-[#18181b] dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 outline-none focus:border-[#ff1493]"
            />
            {errors.title && <p className="text-xs text-red-500 mt-1.5">{errors.title}</p>}
          </div>

          {/* Detailed Description */}
          <div className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl p-4 sm:p-5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#18181b] dark:text-zinc-200 mb-2">
              Detailed Description <span className="text-[#ff1493]">*</span>
            </label>
            <textarea
              rows={4}
              value={form.description}
              onChange={e => { setForm(f => ({ ...f, description: e.target.value })); setErrors(er => ({ ...er, description: '' })); }}
              placeholder="Explain exactly what happens and under what conditions..."
              className="w-full bg-[#f8e7ed] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-[#18181b] dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 outline-none focus:border-[#ff1493] resize-none"
            />
            {errors.description && <p className="text-xs text-red-500 mt-1.5">{errors.description}</p>}
          </div>

          {/* Steps to Reproduce */}
          <div className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl p-4 sm:p-5">
            <label className="block text-xs font-bold uppercase tracking-wider text-[#18181b] dark:text-zinc-200 mb-1">
              Steps to Reproduce <span className="text-slate-400 font-normal lowercase">(optional)</span>
            </label>
            <textarea
              rows={3}
              value={form.steps}
              onChange={e => setForm(f => ({ ...f, steps: e.target.value }))}
              placeholder="1. Go to Feed&#10;2. Click on What's on your mind&#10;3. Click upload photo"
              className="w-full bg-[#f8e7ed] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-xl px-4 py-3 text-sm text-[#18181b] dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 outline-none focus:border-[#ff1493] resize-none"
            />
          </div>

          {/* Expected vs Actual */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl p-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#18181b] dark:text-zinc-200 mb-1.5">
                Expected Behaviour
              </label>
              <textarea
                rows={2}
                value={form.expected}
                onChange={e => setForm(f => ({ ...f, expected: e.target.value }))}
                placeholder="What should have occurred?"
                className="w-full bg-[#f8e7ed] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-[#18181b] dark:text-zinc-100 outline-none focus:border-[#ff1493] resize-none"
              />
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-[#e6d8e1] dark:border-zinc-800 rounded-2xl p-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#18181b] dark:text-zinc-200 mb-1.5">
                Actual Behaviour
              </label>
              <textarea
                rows={2}
                value={form.actual}
                onChange={e => setForm(f => ({ ...f, actual: e.target.value }))}
                placeholder="What actually took place?"
                className="w-full bg-[#f8e7ed] dark:bg-zinc-800 border border-[#e6d8e1] dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-[#18181b] dark:text-zinc-100 outline-none focus:border-[#ff1493] resize-none"
              />
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-2xl bg-[#ff1493] hover:bg-[#ff2d87] disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-[#ff1493]/25 active:scale-[0.99]"
          >
            {submitting ? <><Spinner size="small" /> Submitting Report...</> : 'Submit Issue Report'}
          </button>
        </form>
      </div>
    </div>
  );
}

