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
      className="scroll-mt-24 mb-10 pb-8 border-b border-zinc-200/80 dark:border-zinc-800/80 last:border-b-0 text-zinc-800 dark:text-zinc-200"
    >
      {/* Section Header */}
      <div className="flex items-start justify-between gap-3 mb-4 group">
        <h2 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-baseline gap-2">
          <span className="font-mono text-zinc-400 dark:text-zinc-500 font-semibold text-base sm:text-lg">
            {section.number}.
          </span>
          <span>{section.title}</span>
        </h2>

        {onQuestionSection && (
          <button
            onClick={() => onQuestionSection(sectionRefString)}
            className="opacity-70 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 shrink-0"
            title={`Question or clarify ${sectionRefString}`}
            aria-label={`Question ${sectionRefString}`}
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Summary if present */}
      {section.summary && (
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-4 italic">
          {section.summary}
        </p>
      )}

      {/* Important Legal Callout */}
      {section.callout && (
        <div
          className={`my-4 p-4 rounded-lg border-l-4 text-xs sm:text-sm leading-relaxed flex items-start gap-3 ${
            section.callout.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-500 text-amber-900 dark:text-amber-200'
              : section.callout.type === 'statutory'
              ? 'bg-red-50 dark:bg-red-950/30 border-red-500 text-red-900 dark:text-red-200'
              : 'bg-zinc-100 dark:bg-zinc-900/60 border-zinc-900 dark:border-zinc-200 text-zinc-900 dark:text-zinc-100'
          }`}
        >
          {section.callout.type === 'warning' ? (
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          ) : section.callout.type === 'statutory' ? (
            <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 text-zinc-700 dark:text-zinc-300 shrink-0 mt-0.5" />
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
        <div className="space-y-3 mb-4">
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

      {/* Bulleted Lists */}
      {section.bullets && section.bullets.length > 0 && (
        <ul className="list-disc pl-5 space-y-2 mb-4 text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
          {section.bullets.map((b, bIdx) => (
            <li key={bIdx}>{b}</li>
          ))}
        </ul>
      )}

      {/* Numbered Lists */}
      {section.numberedList && section.numberedList.length > 0 && (
        <ol className="list-decimal pl-5 space-y-2 mb-4 text-sm sm:text-base text-zinc-700 dark:text-zinc-300 leading-relaxed">
          {section.numberedList.map((item, nIdx) => (
            <li key={nIdx}>{item}</li>
          ))}
        </ol>
      )}

      {/* Subsections / Clauses */}
      {section.subsections && section.subsections.length > 0 && (
        <div className="mt-5 space-y-4 pl-0 sm:pl-3 sm:border-l-2 border-zinc-200 dark:border-zinc-800">
          {section.subsections.map((sub) => {
            const clauseRef = `${sectionRefString} (Clause ${sub.number || sub.title})`;
            return (
              <div key={sub.id} className="group/clause text-xs sm:text-sm">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <h3 className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-baseline gap-1.5">
                    {sub.number && (
                      <span className="font-mono text-zinc-500 font-medium text-xs">
                        {sub.number}
                      </span>
                    )}
                    <span>{sub.title}</span>
                  </h3>

                  {onQuestionSection && (
                    <button
                      onClick={() => onQuestionSection(clauseRef)}
                      className="opacity-0 group-hover/clause:opacity-100 transition-opacity text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-1"
                      title={`Clarify ${clauseRef}`}
                    >
                      <HelpCircle className="w-3 h-3" />
                      <span className="hidden sm:inline">Clarify</span>
                    </button>
                  )}
                </div>

                {sub.content && (
                  <div className="space-y-2 text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {sub.content.map((c, cIdx) => (
                      <p key={cIdx}>{c}</p>
                    ))}
                  </div>
                )}

                {sub.bullets && (
                  <ul className="list-disc pl-5 mt-2 space-y-1 text-zinc-600 dark:text-zinc-400">
                    {sub.bullets.map((sb, sbIdx) => (
                      <li key={sbIdx}>{sb}</li>
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
        <div className="my-4 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-xs text-left text-zinc-800 dark:text-zinc-200">
            <thead className="bg-zinc-100 dark:bg-zinc-900 font-semibold text-zinc-900 dark:text-zinc-100">
              <tr>
                {section.table.headers.map((th, thIdx) => (
                  <th key={thIdx} className="px-3.5 py-2.5 border-b border-zinc-200 dark:border-zinc-800">
                    {th}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {section.table.rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3.5 py-2">
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

