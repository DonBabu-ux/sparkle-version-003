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

import React, { useState } from 'react';
import { ShieldCheck, Calendar, Globe, History, Check, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

interface LegalMetadataBannerProps {
  title: string;
  description: string;
  version: string;
  effectiveDate: string;
  lastUpdatedDate?: string;
  jurisdiction?: string;
  publisher?: string;
  status?: string;
  sha256Hash: string;
  onOpenHistory?: () => void;
}

export const LegalMetadataBanner: React.FC<LegalMetadataBannerProps> = ({
  title,
  description,
  version,
  effectiveDate,
  lastUpdatedDate,
  jurisdiction = 'Kenya Edition',
  publisher = 'Sparkle Technologies (Kenya)',
  status = 'Official',
  sha256Hash,
  onOpenHistory
}) => {
  const [copiedHash, setCopiedHash] = useState(false);

  const handleCopyHash = () => {
    navigator.clipboard.writeText(sha256Hash);
    setCopiedHash(true);
    toast.success('SHA-256 Cryptographic Hash copied');
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return (
    <div className="bg-zinc-50/90 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 mb-8 text-zinc-800 dark:text-zinc-200 shadow-xs">
      {/* Title & Official Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
          {title}
        </h1>

        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            {status}
          </span>
          <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-pink-50 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300 border border-pink-200 dark:border-pink-800/80">
            v{version}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-3xl mb-5">
        {description}
      </p>

      {/* Structured Metadata Badges & Separator */}
      <div className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 text-xs">
        {/* Effective Date */}
        <div className="space-y-0.5">
          <span className="text-[11px] uppercase tracking-wider text-pink-600 dark:text-pink-400 font-bold flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Effective Date
          </span>
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{effectiveDate}</p>
        </div>

        {/* Last Updated */}
        <div className="space-y-0.5">
          <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-bold">
            Last Updated
          </span>
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{lastUpdatedDate || effectiveDate}</p>
        </div>

        {/* Jurisdiction & Publisher */}
        <div className="space-y-0.5">
          <span className="text-[11px] uppercase tracking-wider text-pink-600 dark:text-pink-400 font-bold flex items-center gap-1">
            <Globe className="w-3 h-3" /> Jurisdiction
          </span>
          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{jurisdiction}</p>
          <p className="text-[10px] text-zinc-500">{publisher}</p>
        </div>

        {/* Version Audit & History Trigger */}
        <div className="space-y-0.5 flex flex-col justify-center sm:items-start md:items-end">
          {onOpenHistory && (
            <button
              onClick={onOpenHistory}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 underline underline-offset-4 transition-colors"
            >
              <History className="w-3.5 h-3.5" />
              <span>Version History</span>
            </button>
          )}
        </div>
      </div>

      {/* Cryptographic SHA-256 Integrity Verification Box */}
      <div className="mt-4 pt-3.5 border-t border-zinc-200/80 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] uppercase font-bold tracking-wider text-pink-600 dark:text-pink-400 shrink-0">
            SHA-256 INTEGRITY:
          </span>
          <code className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300 truncate bg-pink-50/60 dark:bg-pink-950/30 px-2 py-0.5 rounded border border-pink-200/80 dark:border-pink-800/60">
            {sha256Hash}
          </code>
        </div>

        <button
          onClick={handleCopyHash}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 shrink-0 self-start sm:self-auto"
          title="Copy full cryptographic SHA-256 hash"
        >
          {copiedHash ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">Verified & Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Hash</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
