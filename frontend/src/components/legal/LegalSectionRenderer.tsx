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

import type React from 'react';
import { HelpCircle, AlertCircle, Info, ShieldAlert } from 'lucide-react';
import type { LegalSection } from '../../data/legal/types';

interface LegalSectionRendererProps {
  section: LegalSection;
  onQuestionSection?: (sectionRef: string) => void;
}

export const LegalSectionRenderer: React.FC<LegalSectionRendererProps> = ({
  section,
  onQuestionSection
}) => {
  const sectionRefString = `Section ${section.number} — ${section.title}`;

  return (
    <article
      id={section.id}
      className="scroll-mt-24 mb-12 pb-10 border-b border-zinc-200/80 dark:border-zinc-800/80 last:border-b-0 text-zinc-800 dark:text-zinc-200"
    >
      {/* Section Header with Neat Index Badge */}
      <div className="flex items-start justify-between gap-3 mb-5 group">
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2.5">
          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-md font-mono text-xs sm:text-sm font-bold bg-pink-50 text-pink-600 dark:bg-pink-950/60 dark:text-pink-300 border border-pink-200/80 dark:border-pink-800/80 shrink-0 select-none">
            § {section.number}
          </span>
          <span className="leading-snug">{section.title}</span>
        </h2>

        {onQuestionSection && (
          <button
            onClick={() => onQuestionSection(sectionRefString)}
            className="opacity-70 group-hover:opacity-100 transition-all p-1.5 rounded-lg hover:bg-pink-50 dark:hover:bg-pink-950/50 text-zinc-400 hover:text-pink-600 dark:hover:text-pink-400 shrink-0 border border-transparent hover:border-pink-200 dark:hover:border-pink-800/60"
            title={`Question or clarify ${sectionRefString}`}
            aria-label={`Question ${sectionRefString}`}
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Summary if present */}
      {section.summary && (
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-5 italic border-l-2 border-pink-400 dark:border-pink-600 pl-3">
          {section.summary}
        </p>
      )}

      {/* Important Legal Callout */}
      {section.callout && (
        <div
          className={`my-5 p-4 rounded-xl border-l-4 text-xs sm:text-sm leading-relaxed flex items-start gap-3 shadow-xs ${
            section.callout.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 text-amber-900 dark:text-amber-200'
              : section.callout.type === 'statutory'
              ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-500 text-rose-900 dark:text-rose-200'
              : 'bg-pink-50/50 dark:bg-pink-950/20 border-pink-600 text-zinc-900 dark:text-zinc-100'
          }`}
        >
          {section.callout.type === 'warning' ? (
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          ) : section.callout.type === 'statutory' ? (
            <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 text-pink-600 dark:text-pink-400 shrink-0 mt-0.5" />
          )}
          <div>
            {section.callout.title && (
              <span className="font-bold block mb-1">
                {section.callout.title}
              </span>
            )}
            <p>{section.callout.text}</p>
          </div>
        </div>
      )}

      {/* Main Paragraphs */}
      {section.paragraphs && section.paragraphs.length > 0 && (
        <div className="space-y-3.5 mb-5">
          {section.paragraphs.map((p, pIdx) => (
            <p
              key={pIdx}
              className="text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed font-normal"
            >
              {p}
            </p>
          ))}
        </div>
      )}

      {/* Bulleted Lists with Neat Pink Markers */}
      {section.bullets && section.bullets.length > 0 && (
        <ul className="space-y-2.5 mb-5 pl-2 text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
          {section.bullets.map((b, bIdx) => (
            <li key={bIdx} className="flex items-start gap-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-pink-500 shrink-0 mt-2.5" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Numbered Lists with Crisp Numbered Index Badges */}
      {section.numberedList && section.numberedList.length > 0 && (
        <ol className="space-y-2.5 mb-5 pl-1 text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
          {section.numberedList.map((item, nIdx) => (
            <li key={nIdx} className="flex items-start gap-3">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-md font-mono text-[11px] font-bold bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 shrink-0 mt-0.5 select-none">
                {nIdx + 1}
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      )}

      {/* Subsections & Clauses: Neatly Indexed with Left Guide Border */}
      {section.subsections && section.subsections.length > 0 && (
        <div className="mt-6 space-y-4 pl-0 sm:pl-4 sm:border-l-2 border-pink-200 dark:border-pink-900/50">
          {section.subsections.map((sub) => {
            const clauseRef = `${sectionRefString} (Clause ${sub.number || sub.title})`;
            return (
              <div
                key={sub.id}
                className="group/clause text-xs sm:text-sm bg-zinc-50/50 dark:bg-zinc-900/40 hover:bg-zinc-50 dark:hover:bg-zinc-900/80 p-3 sm:p-3.5 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                    {sub.number && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded font-mono font-bold text-[11px] text-pink-700 bg-pink-100/80 dark:bg-pink-950/60 dark:text-pink-300 border border-pink-200 dark:border-pink-800/80 shrink-0 select-none">
                        {sub.number}
                      </span>
                    )}
                    <span className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {sub.title}
                    </span>
                  </h3>

                  {onQuestionSection && (
                    <button
                      onClick={() => onQuestionSection(clauseRef)}
                      className="opacity-0 group-hover/clause:opacity-100 transition-opacity text-[11px] font-medium text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-pink-50 dark:hover:bg-pink-950/50"
                      title={`Clarify ${clauseRef}`}
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Clarify</span>
                    </button>
                  )}
                </div>

                {sub.content && (
                  <div className="space-y-2 text-zinc-600 dark:text-zinc-400 leading-relaxed pl-0.5">
                    {sub.content.map((c, cIdx) => (
                      <p key={cIdx}>{c}</p>
                    ))}
                  </div>
                )}

                {sub.bullets && (
                  <ul className="space-y-1.5 mt-2.5 pl-1 text-zinc-600 dark:text-zinc-400">
                    {sub.bullets.map((sb, sbIdx) => (
                      <li key={sbIdx} className="flex items-start gap-2">
                        <span className="w-1 h-1 rounded-full bg-pink-500 shrink-0 mt-2" />
                        <span>{sb}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Structured Table */}
      {section.table && (
        <div className="my-5 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <table className="w-full text-xs text-left text-zinc-800 dark:text-zinc-200">
            <thead className="bg-pink-50/60 dark:bg-pink-950/30 font-semibold text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                {section.table.headers.map((th, thIdx) => (
                  <th key={thIdx} className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100">
                    {th}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {section.table.rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-2.5">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
};
