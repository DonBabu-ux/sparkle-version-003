/*
 * ============================================================================
 * SPARKLE LEGAL DOCUMENT RENDERING & AUTHENTICITY NOTICE
 * ============================================================================
 * CRITICAL INSTRUCTION FOR ALL FUTURE AI AGENTS, DEVELOPERS, AND MAINTAINERS:
 *
 * 1. DO NOT DELETE, REMOVE, OR WEAKEN ANY LEGAL PROVISION, SECTION, CLAUSE, OR
 *    DISCLOSURE PRESENT IN SPARKLE LEGAL DOCUMENTS.
 *
 * 2. ANY AMENDMENT, ADDITION, OR UPDATE MUST PRESERVE THE COMPLETE HISTORICAL
 *    RECORD, REVISE THE VERSION NUMBER, UPDATE THE EFFECTIVE DATE, RECALCULATE
 *    THE CANONICAL SHA-256 INTEGRITY HASH, AND LOG THE REVISION IN THE AUDIT TRAIL.
 *
 * 3. NATIVE RENDERING MUST REMAIN THE PRIMARY FORM OF DISPLAY. EMBEDDED PDF
 *    IFRAMES OR EXTERNAL PDF VIEWERS MUST NOT REPLACE NATIVE WEB EXPERIENCES.
 *    PDFS REMAIN DOWNLOADABLE COPIES ONLY.
 *
 * 4. THE DOCUMENT WATERMARK, EMBLEM, METADATA BANNER, INTEGRITY HASH, AND
 *    OFFICIAL FOOTER MUST REMAIN VISIBLE AND UNALTERED ACROSS ALL BREAKPOINTS
 *    AND COLOR THEMES (LIGHT AND DARK MODES).
 *
 * 5. THE LEGAL CLARIFICATION AND COMPLAINT SUBMISSION PIPELINE, INCLUDING
 *    SECTION REFERENCE LINKING AND REFERENCE NUMBER GENERATION, MUST REMAIN
 *    FULLY OPERATIONAL.
 *
 * FAILURE TO COMPLY WITH THESE DIRECTIVES VOIDS DOCUMENT INTEGRITY CHECKS AND
 * CONSTITUTES AN UNAUTHORIZED MODIFICATION OF COMPLIANCE INFRASTRUCTURE.
 * ============================================================================
 */

import { useState } from 'react';
import type React from 'react';
import { X, Send, Search, CheckCircle2, Copy, Clock, ShieldCheck, HelpCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ALL_LEGAL_DOCUMENTS } from '../../data/legal';
import type { LegalConcernCategory } from '../../data/legal/types';

interface LegalClarificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDocumentId?: string;
  initialSectionReference?: string;
}

export const LegalClarificationModal: React.FC<LegalClarificationModalProps> = ({
  isOpen,
  onClose,
  initialDocumentId = 'terms',
  initialSectionReference = ''
}) => {
  const [activeTab, setActiveTab] = useState<'submit' | 'track'>('submit');

  // Submit Form State
  const [documentId, setDocumentId] = useState(initialDocumentId);
  const [sectionReference, setSectionReference] = useState(initialSectionReference);
  const [category, setCategory] = useState<LegalConcernCategory>('clarification');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedReference, setSubmittedReference] = useState<string | null>(null);

  // Tracking State
  const [trackRefInput, setTrackRefInput] = useState('');
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackedRecord, setTrackedRecord] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || description.trim().length < 15) {
      toast.error('Please describe your concern with at least 15 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const activeDoc = ALL_LEGAL_DOCUMENTS.find(d => d.id === documentId);
      const res = await axios.post('/api/legal/inquiries', {
        documentId,
        documentVersion: activeDoc?.version || '1.0',
        sectionReference: sectionReference.trim() || undefined,
        category,
        description: description.trim(),
        contactEmail: contactEmail.trim() || undefined,
      });

      if (res.data?.referenceNumber) {
        setSubmittedReference(res.data.referenceNumber);
        toast.success('Inquiry submitted successfully');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit legal inquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTrackInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRef = trackRefInput.trim().toUpperCase();
    if (!cleanRef) return;

    setTrackingLoading(true);
    setTrackedRecord(null);
    try {
      const res = await axios.get(`/api/legal/inquiries/track/${cleanRef}`);
      setTrackedRecord(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Inquiry reference not found.');
    } finally {
      setTrackingLoading(false);
    }
  };

  const copyRefToClipboard = (ref: string) => {
    navigator.clipboard.writeText(ref);
    toast.success('Reference number copied to clipboard');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full sm:max-w-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-pink-50 dark:bg-pink-950/50 flex items-center justify-center text-pink-600 dark:text-pink-400">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                Legal Clarification &amp; Support
              </h2>
              <p className="text-[11px] text-zinc-500">
                Official Sparkle Legal Inquiries &amp; Review Pipeline
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 px-5 text-xs font-semibold bg-zinc-50/50 dark:bg-zinc-900/40">
          <button
            onClick={() => setActiveTab('submit')}
            className={`py-2.5 px-3 border-b-2 transition-colors ${
              activeTab === 'submit'
                ? 'border-pink-600 text-pink-600 dark:border-pink-500 dark:text-pink-400 font-bold'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            Submit Concern / Clarification
          </button>
          <button
            onClick={() => setActiveTab('track')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'track'
                ? 'border-pink-600 text-pink-600 dark:border-pink-500 dark:text-pink-400 font-bold'
                : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Track Inquiry</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {activeTab === 'submit' ? (
            submittedReference ? (
              /* Success View */
              <div className="text-center py-6 space-y-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    Inquiry Successfully Lodged
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    Your inquiry has been registered in the Sparkle Legal Audit Ledger. Retain your reference number to track response progress.
                  </p>
                </div>

                <div className="p-3 bg-pink-50 dark:bg-pink-950/40 rounded-xl inline-flex items-center gap-3 border border-pink-200 dark:border-pink-800/60 shadow-xs">
                  <span className="font-mono text-sm font-bold text-pink-700 dark:text-pink-300">
                    {submittedReference}
                  </span>
                  <button
                    onClick={() => copyRefToClipboard(submittedReference)}
                    className="p-1 hover:text-pink-800 dark:hover:text-pink-200 transition-colors text-pink-600 dark:text-pink-400"
                    title="Copy reference number"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>

                <div className="pt-2 flex justify-center gap-3">
                  <button
                    onClick={() => {
                      setSubmittedReference(null);
                      setDescription('');
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 transition-colors"
                  >
                    Submit Another
                  </button>
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-pink-600 text-white hover:bg-pink-700 transition-colors shadow-sm shadow-pink-600/30"
                  >
                    Close Window
                  </button>
                </div>
              </div>
            ) : (
              /* Form View */
              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                {/* Document Selector */}
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Applicable Legal Document
                  </label>
                  <select
                    value={documentId}
                    onChange={(e) => setDocumentId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 font-medium"
                  >
                    {ALL_LEGAL_DOCUMENTS.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.title} (v{doc.version})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Section / Provision Reference */}
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Referenced Section or Clause (Optional)
                  </label>
                  <input
                    type="text"
                    value={sectionReference}
                    onChange={(e) => setSectionReference(e.target.value)}
                    placeholder="e.g. Section 6 (Clause 6.02) or Clause 14"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500"
                  />
                </div>

                {/* Category Selector (All 6 Required Categories) */}
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Concern Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as LegalConcernCategory)}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500 font-medium"
                  >
                    <option value="clarification">Request clarification</option>
                    <option value="interpretation">Request interpretation</option>
                    <option value="concern">Report a concern</option>
                    <option value="contradiction">Report a contradiction</option>
                    <option value="amendment">Suggest an amendment</option>
                    <option value="other">Other legal concern</option>
                  </select>
                </div>

                {/* Question / Description */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-bold text-zinc-700 dark:text-zinc-300">
                      Description / Specific Question
                    </label>
                    <span className="text-[10px] text-zinc-400">
                      {description.length} chars (min 15)
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detail your question, perceived contradiction, suggested amendment, or compliance inquiry..."
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500"
                    required
                  />
                </div>

                {/* Contact Email */}
                <div>
                  <label className="block font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                    Contact Email (Optional for updates)
                  </label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="your.email@example.com"
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500"
                  />
                </div>

                {/* Notice */}
                <p className="text-[11px] text-zinc-500 leading-normal">
                  Inquiries are logged in the Sparkle Legal Audit Ledger. You will receive an official reference number (<code className="font-mono text-pink-600 dark:text-pink-400 font-bold">LC-YYYYMMDD-XXXXX</code>) to monitor compliance review.
                </p>

                {/* Submit Action */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 px-4 rounded-lg bg-pink-600 text-white font-bold flex items-center justify-center gap-2 hover:bg-pink-700 disabled:opacity-50 transition-colors shadow-sm shadow-pink-600/30 text-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Submitting...' : 'Submit Legal Inquiry'}</span>
                  </button>
                </div>
              </form>
            )
          ) : (
            /* Track Inquiry Tab */
            <div className="space-y-4 text-xs">
              <form onSubmit={handleTrackInquiry} className="flex gap-2">
                <input
                  type="text"
                  value={trackRefInput}
                  onChange={(e) => setTrackRefInput(e.target.value)}
                  placeholder="Enter reference (e.g. LC-20261109-12345)"
                  className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-pink-500 focus:border-pink-500"
                />
                <button
                  type="submit"
                  disabled={trackingLoading || !trackRefInput.trim()}
                  className="px-4 py-2 rounded-lg bg-pink-600 text-white font-bold hover:bg-pink-700 disabled:opacity-50 transition-colors shadow-sm shadow-pink-600/30"
                >
                  {trackingLoading ? 'Checking...' : 'Track'}
                </button>
              </form>

              {trackedRecord && (
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 pb-2">
                    <div>
                      <span className="font-mono font-bold text-pink-600 dark:text-pink-400 block text-sm">
                        {trackedRecord.referenceNumber}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {trackedRecord.documentId} (v{trackedRecord.documentVersion})
                      </span>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      trackedRecord.status === 'Resolved'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : trackedRecord.status === 'Under Review'
                        ? 'bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-950/60 dark:text-pink-300'
                        : 'bg-zinc-200 text-zinc-800 border-zinc-300 dark:bg-zinc-700 dark:text-zinc-200'
                    }`}>
                      {trackedRecord.status}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-zinc-500">Category:</span>
                    <p className="font-medium capitalize">{trackedRecord.category}</p>
                  </div>

                  {trackedRecord.sectionReference && (
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold text-zinc-500">Referenced Provision:</span>
                      <p className="font-mono text-zinc-700 dark:text-zinc-300">{trackedRecord.sectionReference}</p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-zinc-500">Your Submitted Question:</span>
                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed bg-white dark:bg-zinc-900 p-2.5 rounded border border-zinc-200 dark:border-zinc-700">
                      {trackedRecord.description}
                    </p>
                  </div>

                  {trackedRecord.adminResponse ? (
                    <div className="space-y-1 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                      <span className="text-[10px] uppercase font-bold text-pink-600 dark:text-pink-400 flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Official Sparkle Legal Response:
                      </span>
                      <p className="text-zinc-800 dark:text-zinc-100 leading-relaxed bg-pink-50/50 dark:bg-pink-950/20 p-2.5 rounded border border-pink-200 dark:border-pink-800/50">
                        {trackedRecord.adminResponse}
                      </p>
                      {trackedRecord.respondedAt && (
                        <span className="text-[10px] text-zinc-500 block text-right">
                          Responded on {new Date(trackedRecord.respondedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                      <Clock className="w-3.5 h-3.5 text-pink-500" />
                      <span>Currently pending evaluation by Sparkle Legal &amp; Compliance.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
