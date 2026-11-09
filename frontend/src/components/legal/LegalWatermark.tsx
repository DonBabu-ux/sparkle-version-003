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

interface LegalWatermarkProps {
  documentId: string;
  version: string;
  sha256Hash?: string;
}

export const LegalWatermark: React.FC<LegalWatermarkProps> = ({
  documentId,
  version,
  sha256Hash
}) => {
  const hashPrefix = sha256Hash ? sha256Hash.slice(0, 16) : '';

  return (
    <div
      className="pointer-events-none select-none fixed inset-0 z-0 overflow-hidden flex items-center justify-center"
      aria-hidden="true"
    >
      {/* Repeating Diagonal Watermark Grid with Subtle Sparkle Pink Tint */}
      <div className="absolute inset-0 flex flex-col justify-around opacity-[0.038] dark:opacity-[0.048] transform -rotate-12 scale-110 text-pink-900 dark:text-pink-300">
        {[0, 1, 2, 3, 4].map((row) => (
          <div
            key={row}
            className="flex justify-around items-center whitespace-nowrap font-sans tracking-widest font-black"
          >
            {[0, 1, 2].map((col) => (
              <div key={col} className="flex flex-col items-center mx-12 my-8">
                {/* Sparkle Official Emblem SVG */}
                <svg
                  className="w-16 h-16 mb-2 text-current fill-current"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
                </svg>
                <span className="text-xl sm:text-2xl font-extrabold uppercase">
                  SPARKLE LEGAL DOCUMENT
                </span>
                <span className="text-xs font-bold tracking-wider text-current opacity-85 mt-1">
                  OFFICIAL PUBLICATION • {documentId.toUpperCase()} v{version} {hashPrefix ? `• ${hashPrefix}...` : ''}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
