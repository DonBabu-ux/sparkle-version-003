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
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Download, HelpCircle, Shield, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface LegalHeaderProps {
  title?: string;
  isIndex?: boolean;
  downloadUrl?: string;
  onOpenClarification?: () => void;
}

export const LegalHeader: React.FC<LegalHeaderProps> = ({
  title,
  isIndex = false,
  downloadUrl,
  onOpenClarification
}) => {
  const navigate = useNavigate();

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: title ? `Sparkle Legal — ${title}` : 'Sparkle Legal Centre',
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Document link copied to clipboard');
      }
    } catch {
      // User cancelled or share failed
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-950/95 border-b border-zinc-200 dark:border-zinc-800 backdrop-blur-sm transition-colors pt-[calc(0.75rem+var(--safe-area-inset-top,env(safe-area-inset-top,0px)))] pb-3 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Back and Brand */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            onClick={() => isIndex ? navigate(-1) : navigate('/legal')}
            className="p-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors border border-zinc-200/80 dark:border-zinc-800"
            aria-label="Back"
            title={isIndex ? 'Go back' : 'Back to Legal Centre'}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <Link to="/legal" className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 hover:opacity-85 transition-opacity">
            <div className="w-7 h-7 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs">
              <Shield className="w-3.5 h-3.5 fill-current" />
            </div>
            <div className="hidden xs:block">
              <span className="font-bold text-sm tracking-tight block leading-tight">Sparkle</span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium tracking-wide uppercase">Legal Centre</span>
            </div>
          </Link>
        </div>

        {/* Centered Document Title */}
        {!isIndex && title && (
          <div className="flex-1 text-center px-2 min-w-0">
            <h1 className="text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">
              {title}
            </h1>
          </div>
        )}

        {/* Document Actions Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {!isIndex && onOpenClarification && (
            <button
              onClick={onOpenClarification}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors border border-zinc-200 dark:border-zinc-800"
              title="Question or clarify a provision"
            >
              <HelpCircle className="w-3.5 h-3.5 text-zinc-500" />
              <span className="hidden sm:inline">Clarify</span>
            </button>
          )}

          {!isIndex && (
            <button
              onClick={handleShare}
              className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
              title="Share or copy document link"
              aria-label="Share document link"
            >
              <Share2 className="w-4 h-4" />
            </button>
          )}

          {!isIndex && downloadUrl && (
            <a
              href={downloadUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 transition-colors shadow-sm"
              title="Download official PDF copy"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
};

