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

import React from 'react';
import { X, History, ShieldCheck, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import type { DocumentVersionEntry } from '../../data/legal/types';

interface LegalVersionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  versionHistory: DocumentVersionEntry[];
}

export const LegalVersionHistoryModal: React.FC<LegalVersionHistoryModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  versionHistory
}) => {
  const [copiedHash, setCopiedHash] = React.useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    toast.success('Version integrity hash copied');
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-pink-50 dark:bg-pink-950/50 flex items-center justify-center text-pink-600 dark:text-pink-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-zinc-100 leading-tight">
                Document Version History &amp; Audit Log
              </h2>
              <p className="text-[11px] text-zinc-500 truncate max-w-xs sm:max-w-sm">
                {documentTitle}
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

        {/* Timeline Content */}
        <div className="p-5 overflow-y-auto space-y-4">
          <p className="text-xs text-zinc-500 leading-relaxed">
            Sparkle maintains an immutable audit trail for every legal policy update. Each version is cryptographically signed and hashed (SHA-256) at publication.
          </p>

          <div className="relative border-l-2 border-pink-200 dark:border-pink-900/50 ml-3 pl-4 space-y-6">
            {versionHistory.map((entry, idx) => (
              <div key={idx} className="relative text-xs">
                {/* Dot */}
                <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-pink-600 border-2 border-white dark:border-zinc-900 shadow-xs" />

                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-pink-600 dark:text-pink-400 text-sm">
                      Version {entry.version}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      {entry.status}
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500">
                    Effective {entry.effectiveDate}
                  </span>
                </div>

                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
                  {entry.summary}
                </p>

                {entry.sha256Hash && (
                  <div className="p-2.5 rounded-xl bg-pink-50/50 dark:bg-pink-950/30 border border-pink-200/80 dark:border-pink-800/60 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[9px] uppercase tracking-wider text-pink-600 dark:text-pink-400 font-bold block">
                        SHA-256 Canonical Integrity Hash:
                      </span>
                      <code className="font-mono text-[10px] text-zinc-700 dark:text-zinc-300 truncate block">
                        {entry.sha256Hash}
                      </code>
                    </div>

                    <button
                      onClick={() => handleCopy(entry.sha256Hash)}
                      className="p-1 text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 shrink-0"
                      title="Copy SHA-256 hash"
                    >
                      {copiedHash === entry.sha256Hash ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-pink-600 text-white hover:bg-pink-700 transition-colors shadow-sm shadow-pink-600/30"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
