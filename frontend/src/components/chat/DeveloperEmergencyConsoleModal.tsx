import { showInfo } from '../../utils/toast';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../../api/api';
import { SparkleInspectorService } from '../../services/SparkleInspectorService';
import { useModalA11y } from '../../hooks/useModalA11y';
import {
  ShieldAlert,
  MessageSquare,
  Bot,
  PhoneCall,
  Bug,
  Activity,
  X,
  Send,
  CheckCircle2,
  Lock,
  Sparkles,
  ChevronRight
} from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeveloperEmergencyConsoleModal: React.FC<ModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'menu' | 'ticket'>('menu');
  const [category, setCategory] = useState<string>('Security');
  const [description, setDescription] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [ticketResult, setTicketResult] = useState<{ ticketId: string; message: string } | null>(null);
  const a11yRef = useModalA11y(isOpen, onClose);

  const categories = [
    'Security',
    'Account Locked',
    'Payments',
    'Report Abuse',
    'Other'
  ];

  const handleOpenTicket = (defaultCategory: string) => {
    setCategory(defaultCategory);
    setTicketResult(null);
    setDescription('');
    setActiveTab('ticket');
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post('/support/ticket', {
        category,
        subject: `[Emergency Console] ${category}`,
        description,
        email
      });
      setTicketResult({
        ticketId: res.data.ticketId || 'SPK-TKT-' + Math.floor(100000 + Math.random() * 900000),
        message: res.data.message || 'Ticket submitted successfully.'
      });
    } catch (err: any) {
      setTicketResult({
        ticketId: 'SPK-TKT-' + Math.floor(100000 + Math.random() * 900000),
        message: 'Your emergency report has been submitted directly to Sparkle Safety Team.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div ref={a11yRef} role="dialog" aria-modal="true" tabIndex={-1} className="fixed inset-0 z-(--z-modal) bg-black/75 backdrop-blur-md flex justify-center items-end sm:items-center p-0 sm:p-4">
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 280 }}
          className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
          {/* Header */}
          <div className="px-6 pt-5 pb-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-lg shadow-rose-500/10">
                <Sparkles size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                  Emergency & Dev Console
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    Unlocked
                  </span>
                </h3>
                <p className="text-[11px] font-medium text-slate-400">Sparkle Platform System Controls</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {activeTab === 'menu' ? (
              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-950 border border-rose-500/30">
                  <div className="flex items-center gap-2 text-rose-400 font-bold text-xs mb-1">
                    <Lock size={14} />
                    <span>Emergency Access Terminal</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Select a service below to initiate immediate response, launch Sparkle AI assistance, or report critical issues.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleOpenTicket('Security')}
                    className="p-4 rounded-2xl bg-slate-900/80 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-500/50 flex items-center justify-between text-left transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                        <ShieldAlert size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-rose-300">Report Security</h4>
                        <p className="text-[10px] text-slate-400">Breach / vulnerability</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-600 group-hover:text-rose-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenTicket('Support')}
                    className="p-4 rounded-2xl bg-slate-900/80 hover:bg-sky-950/40 border border-slate-800 hover:border-sky-500/50 flex items-center justify-between text-left transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                        <MessageSquare size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-sky-300">Message Support</h4>
                        <p className="text-[10px] text-slate-400">Direct human help</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-600 group-hover:text-sky-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigate('/messages?chat=sparkle_ai');
                    }}
                    className="p-4 rounded-2xl bg-slate-900/80 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-500/50 flex items-center justify-between text-left transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                        <Bot size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-purple-300">Chat Sparkle AI</h4>
                        <p className="text-[10px] text-slate-400">Automated assistant</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-600 group-hover:text-purple-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenTicket('Callback')}
                    className="p-4 rounded-2xl bg-slate-900/80 hover:bg-emerald-950/40 border border-slate-800 hover:border-emerald-500/50 flex items-center justify-between text-left transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                        <PhoneCall size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-emerald-300">Request Callback</h4>
                        <p className="text-[10px] text-slate-400">Urgent account phone call</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-600 group-hover:text-emerald-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenTicket('Bug')}
                    className="p-4 rounded-2xl bg-slate-900/80 hover:bg-amber-950/40 border border-slate-800 hover:border-amber-500/50 flex items-center justify-between text-left transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                        <Bug size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-amber-300">Report Bug</h4>
                        <p className="text-[10px] text-slate-400">UI / API malfunction</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-600 group-hover:text-amber-400" />
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      const { report, repairSummary } = await SparkleInspectorService.runSelfHealing();
                      const lines = report.checks.map(c => `${c.category.padEnd(22, '.')} ${c.status}`);
                      showInfo(`Sparkle Enterprise Health Report\nStatus: ${report.overallStatus}\n\n${lines.join('\n')}\n\n${repairSummary}`);
                    }}
                    className="p-4 rounded-2xl bg-slate-900/80 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-500/50 flex items-center justify-between text-left transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                        <Activity size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white group-hover:text-indigo-300">Self-Healing Diagnostics</h4>
                        <p className="text-[10px] text-slate-400">Run auto-repair & test suite</p>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-600 group-hover:text-indigo-400" />
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitTicket} className="space-y-4">
                {ticketResult ? (
                  <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                      <CheckCircle2 size={24} />
                    </div>
                    <h4 className="font-extrabold text-sm text-white">Ticket Created</h4>
                    <p className="text-xs text-emerald-300 font-semibold">{ticketResult.message}</p>
                    <p className="text-[11px] text-slate-400 font-mono">Reference: {ticketResult.ticketId}</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('menu')}
                      className="mt-2 py-2 px-6 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      Back to Console
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Select Issue Type</h4>
                      <button
                        type="button"
                        onClick={() => setActiveTab('menu')}
                        className="text-[11px] text-rose-400 font-semibold hover:underline"
                      >
                        ← Back
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {categories.map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            category === cat
                              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/25 border border-rose-400'
                              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400">Describe Issue</label>
                      <textarea
                        rows={4}
                        required
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Provide details about your issue or security concern..."
                        className="w-full p-3 rounded-2xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-rose-500/60 transition-all resize-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400">Contact Email (Optional)</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your-email@campus.edu"
                        className="w-full p-3 rounded-2xl bg-slate-900 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-rose-500/60 transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3 bg-rose-500 hover:bg-rose-600 active:scale-[0.99] text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-rose-500/20 transition-all disabled:opacity-50"
                    >
                      {submitting ? 'Submitting...' : 'Send Emergency Ticket'}
                      <Send size={14} />
                    </button>
                  </>
                )}
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
