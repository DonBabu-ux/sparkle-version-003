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

export type LegalDocCategory =
  | 'terms'
  | 'privacy'
  | 'community'
  | 'cookies'
  | 'copyright'
  | 'acceptable-use'
  | 'safety';

export type LegalDocStatus = 'Official' | 'Superseded' | 'Draft';

export interface LegalSubSection {
  id: string;
  number?: string;
  title: string;
  content: string[];
  bullets?: string[];
  notice?: string;
}

export interface LegalSection {
  id: string;
  number: string;
  title: string;
  summary?: string;
  paragraphs: string[];
  subsections?: LegalSubSection[];
  bullets?: string[];
  numberedList?: string[];
  callout?: {
    type: 'info' | 'warning' | 'notice' | 'statutory';
    title?: string;
    text: string;
  };
  table?: {
    headers: string[];
    rows: string[][];
  };
}

export interface DocumentVersionEntry {
  version: string;
  effectiveDate: string;
  lastUpdated: string;
  status: LegalDocStatus;
  summary: string;
  sha256Hash: string;
  changelogUrl?: string;
}

export interface CanonicalLegalDocument {
  id: string;
  title: string;
  shortTitle: string;
  category: LegalDocCategory;
  description: string;
  version: string;
  effectiveDate: string;
  lastUpdatedDate: string;
  jurisdiction: string;
  publisher: string;
  status: LegalDocStatus;
  officialReference: string;
  downloadUrl: string;
  sha256Hash: string;
  versionHistory: DocumentVersionEntry[];
  sections: LegalSection[];
  relatedDocumentIds: string[];
}

export type LegalConcernCategory =
  | 'clarification'
  | 'interpretation'
  | 'concern'
  | 'contradiction'
  | 'amendment'
  | 'other';

export interface LegalInquirySubmission {
  documentId: string;
  documentVersion: string;
  sectionReference?: string;
  category: LegalConcernCategory;
  description: string;
  contactEmail?: string;
  contactName?: string;
  userId?: string;
  attachmentUrl?: string;
}

export interface LegalInquiryRecord {
  id: string;
  referenceNumber: string;
  documentId: string;
  documentVersion: string;
  sectionReference?: string;
  category: LegalConcernCategory;
  description: string;
  contactEmail?: string;
  userId?: string;
  attachmentUrl?: string;
  status: 'Submitted' | 'Under Review' | 'Awaiting Clarification' | 'Resolved' | 'Closed';
  adminResponse?: string;
  createdAt: string;
  updatedAt: string;
}

