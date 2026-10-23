import { showError } from '../utils/toast';
import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ShieldAlert, CheckCircle2, ShieldCheck } from 'lucide-react';
import api from '../api/api';
import { motion, AnimatePresence } from 'framer-motion';
import { logger } from '../utils/logger';

export default function ReportListing() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ , setListing ] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        const res = await api.get(`/marketplace/listings/${id}`);
        setListing(res.data.listing);
      } catch (err) {
        logger.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchListing();
  }, [id]);

  const reportReasons = [
    { id: 'scam', label: 'Scam or fraud', description: 'The seller or listing appears to be trying to defraud buyers.' },
    { id: 'misleading', label: 'Misleading listing', description: 'The item is not as described or the photos are misleading.' },
    { id: 'inappropriate', label: 'Inappropriate content', description: 'Offensive images or text that violates community standards.' },
    { id: 'duplicate', label: 'Duplicate listing', description: 'The same item has been posted more than once.' },
    { id: 'spam', label: 'Spam', description: 'The listing is repetitive, promotional, or irrelevant.' },
    { id: 'other', label: 'Something else', description: 'Another issue that does not fit the options above.' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || saving) return;

    setSaving(true);
    try {
      await api.post(`/marketplace/listings/${id}/report`, { reason, details });
      setSubmitted(true);
      setTimeout(() => navigate('/marketplace'), 3500);
    } catch (err: any) {
      logger.error(err);
      showError(err.response?.data?.message || 'Failed to submit report. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="min-h-dvh bg-white text-marketplace-text font-sans">
      <header className="sticky top-0 z-50 bg-white border-b border-marketplace-border px-4 py-3 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center text-marketplace-text hover:bg-marketplace-bg rounded-full transition-colors">
          <ChevronLeft size={24} strokeWidth={2.5} />
        </button>
        <h1 className="text-[19px] font-black tracking-tight">Report Listing</h1>
      </header>

      <main className="max-w-xl mx-auto px-6 py-10">
        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div 
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="flex items-center gap-4 mb-8 p-4 bg-red-50 border border-red-100 rounded-[32px]">
                <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center text-red-500">
                  <ShieldAlert size={24} />
                </div>
                <div className="flex-1">
                  <h2 className="font-black text-red-600">Sparkle Safety Center</h2>
                  <p className="text-[11px] font-bold text-red-400 uppercase tracking-wider">
                    Protecting Your Community -{' '}
                    <Link to="/legal/community-guidelines" target="_blank" className="underline hover:text-red-600">
                      Community Guidelines
                    </Link>
                  </p>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-2xl font-black mb-2 tracking-tight">What's wrong with this listing?</h3>
                <p className="text-marketplace-muted font-bold text-sm">Select the reason that most accurately describes the issue.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  {reportReasons.map((item) => (
                    <label 
                      key={item.id} 
                      className={`relative flex flex-col p-5 rounded-[24px] border-2 cursor-pointer transition-all ${reason === item.id ? 'border-red-500 bg-red-50/30' : 'border-marketplace-border hover:border-slate-300'}`}
                    >
                      <input 
                        type="radio" 
                        name="reason" 
                        value={item.id} 
                        onChange={(e) => setReason(e.target.value)}
                        className="absolute opacity-0"
                      />
                      <span className="font-black text-[15px] mb-1">{item.label}</span>
                      <span className="text-[11px] font-bold text-marketplace-muted uppercase tracking-wider">{item.description}</span>
                    </label>
                  ))}
                </div>

                <div className="mt-8">
                  <label className="text-[11px] font-black text-marketplace-muted uppercase tracking-widest mb-3 block">Additional Context (Optional)</label>
                  <textarea 
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Add details that will help our moderation team review this listing..."
                    className="w-full bg-marketplace-bg rounded-[24px] p-5 font-bold text-sm h-32 outline-none focus:ring-2 ring-red-500/20 transition-all border border-transparent focus:border-red-100"
                  />
                </div>

                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 mb-8 mt-10">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-slate-400 flex-shrink-0 shadow-sm">
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <h4 className="font-black text-sm text-slate-800 mb-1">Reports are reviewed by people</h4>
                      <p className="text-[11px] font-bold text-slate-400 leading-relaxed uppercase tracking-wider">
                        Your report is private. A moderator will review the listing. We cannot promise an immediate removal, and the seller will not see who reported them.
                      </p>
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={!reason || saving}
                  className="w-full py-5 bg-red-500 text-white font-black rounded-[24px] shadow-xl shadow-red-100 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:hover:scale-100"
                >
                  {saving ? 'Submitting...' : 'Submit Report'}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="w-24 h-24 bg-emerald-50 rounded-[40px] flex items-center justify-center text-emerald-500 mb-8 shadow-inner">
                <CheckCircle2 size={48} strokeWidth={2.5} />
              </div>
              <h2 className="text-3xl font-black mb-4 tracking-tight">Report Received</h2>
              <p className="text-marketplace-muted font-bold text-lg mb-8 max-w-sm">
                Thank you for protecting the Sparkle community. Our moderation team will review this listing.
              </p>
              <div className="flex items-center gap-2 px-6 py-3 bg-emerald-50 rounded-full border border-emerald-100 text-emerald-600">
                <ShieldCheck size={18} />
                <span className="text-xs font-black uppercase tracking-widest">Under Review</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
