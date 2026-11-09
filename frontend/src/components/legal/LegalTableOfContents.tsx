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

import { useState, useEffect } from 'react';
import type React from 'react';
import { ChevronDown, ChevronUp, ArrowUp, List } from 'lucide-react';
import type { LegalSection } from '../../data/legal/types';

interface LegalTableOfContentsProps {
  sections: LegalSection[];
  activeSectionId?: string;
  onSelectSection: (id: string) => void;
}

export const LegalTableOfContents: React.FC<LegalTableOfContentsProps> = ({
  sections,
  activeSectionId,
  onSelectSection
}) => {
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [currentActiveId, setCurrentActiveId] = useState<string>(activeSectionId || '');

  // Scroll spy with IntersectionObserver
  useEffect(() => {
    if (activeSectionId) {
      setCurrentActiveId(activeSectionId);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries.find((entry) => entry.isIntersecting);
        if (visibleEntry) {
          setCurrentActiveId(visibleEntry.target.id);
        }
      },
      {
        rootMargin: '-80px 0px -60% 0px',
        threshold: 0
      }
    );

    sections.forEach((sec) => {
      const el = document.getElementById(sec.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections, activeSectionId]);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSectionClick = (id: string) => {
    onSelectSection(id);
    setIsOpenMobile(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      {/* MOBILE ACCORDION (Small Screens) */}
      <div className="lg:hidden mb-6 bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <button
          onClick={() => setIsOpenMobile(!isOpenMobile)}
          className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60 transition-colors"
          aria-expanded={isOpenMobile}
        >
          <span className="flex items-center gap-2">
            <List className="w-4 h-4 text-zinc-500" />
            Table of Contents ({sections.length} Sections)
          </span>
          {isOpenMobile ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {isOpenMobile && (
          <div className="max-h-72 overflow-y-auto border-t border-zinc-200 dark:border-zinc-800 p-2 space-y-0.5">
            {sections.map((sec) => {
              const isActive = currentActiveId === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => handleSectionClick(sec.id)}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors flex items-start gap-2 ${
                    isActive
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-semibold'
                      : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <span className="font-mono text-[11px] opacity-70 shrink-0">
                    {sec.number}.
                  </span>
                  <span className="truncate">{sec.title}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* DESKTOP STICKY SIDEBAR (Large Screens) */}
      <aside className="hidden lg:block w-72 shrink-0 self-start sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 scrollbar-thin">
        <div className="bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <List className="w-3.5 h-3.5" />
              Table of Contents
            </span>
            <span className="text-[10px] text-zinc-500 font-mono">
              {sections.length} secs
            </span>
          </div>

          <nav className="space-y-0.5 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
            {sections.map((sec) => {
              const isActive = currentActiveId === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => handleSectionClick(sec.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md transition-colors flex items-start gap-1.5 leading-snug ${
                    isActive
                      ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 font-semibold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'
                  }`}
                  title={`${sec.number}. ${sec.title}`}
                >
                  <span className="font-mono text-[11px] opacity-70 shrink-0">
                    {sec.number}.
                  </span>
                  <span className="truncate">{sec.title}</span>
                </button>
              );
            })}
          </nav>

          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
            <button
              onClick={handleScrollToTop}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 transition-colors font-medium text-[11px]"
            >
              <ArrowUp className="w-3 h-3" />
              Return to Top
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

