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

import {
  ALL_LEGAL_DOCUMENTS,
  type CanonicalLegalDocument,
  getLegalDocById as getCanonicalDocById,
} from '../data/legal';

export interface LegalDocument {
  id: string;
  title: string;
  shortTitle: string;
  category: 'terms' | 'privacy' | 'community' | 'cookies' | 'copyright' | 'acceptable-use' | 'safety' | 'other';
  description: string;
  version: string;
  effectiveDate: string;
  lastUpdatedDate?: string;
  file: string;
  routes: string[];
  public: boolean;
  jurisdiction?: string;
  officialReference?: string;
  sha256Hash: string;
}

export const LEGAL_DOCUMENTS: LegalDocument[] = ALL_LEGAL_DOCUMENTS.map((doc: CanonicalLegalDocument) => ({
  id: doc.id,
  title: doc.title,
  shortTitle: doc.shortTitle,
  category: doc.category as LegalDocument['category'],
  description: doc.description,
  version: doc.version,
  effectiveDate: doc.effectiveDate,
  lastUpdatedDate: doc.lastUpdatedDate,
  file: doc.downloadUrl,
  routes: doc.id === 'terms'
    ? ['/signup', '/login', '/settings', '/about', '/marketplace']
    : doc.id === 'privacy'
    ? ['/signup', '/login', '/settings', '/messages', '/about']
    : doc.id === 'community-guidelines'
    ? ['/moments/create', '/afterglow/create', '/marketplace/report', '/support']
    : ['/settings', '/about', '/legal'],
  public: doc.status === 'Official',
  jurisdiction: doc.jurisdiction,
  officialReference: doc.officialReference,
  sha256Hash: doc.sha256Hash,
}));

export function getLegalDocument(id?: string): LegalDocument | undefined {
  if (!id) return undefined;
  const cleanId = id.trim().toLowerCase();
  return LEGAL_DOCUMENTS.find(doc => doc.id === cleanId && doc.public);
}

export function getAllLegalDocuments(): LegalDocument[] {
  return LEGAL_DOCUMENTS;
}

export function getPublicLegalDocuments(): LegalDocument[] {
  return LEGAL_DOCUMENTS.filter(doc => doc.public);
}

export { getCanonicalDocById, ALL_LEGAL_DOCUMENTS };
