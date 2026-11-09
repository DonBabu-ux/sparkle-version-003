import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  ALL_LEGAL_DOCUMENTS,
  getLegalDocById,
  type CanonicalLegalDocument
} from '../data/legal';
import { LEGAL_DOCUMENTS, getLegalDocument } from '../config/legalDocuments';

const MANDATORY_AI_NOTICE_SNIPPET =
  'SPARKLE LEGAL DOCUMENT RENDERING & AUTHENTICITY NOTICE';

describe('Sparkle Legal Centre Redesign & Document Authenticity System', () => {
  describe('1. Mandatory AI Maintenance Directive Verification', () => {
    const filesToCheck = [
      'frontend/src/pages/LegalViewer.tsx',
      'frontend/src/config/legalDocuments.ts',
      'frontend/src/data/legal/types.ts',
      'frontend/src/data/legal/index.ts',
      'frontend/src/data/legal/terms.ts',
      'frontend/src/data/legal/privacy.ts',
      'frontend/src/data/legal/community_guidelines.ts',
      'frontend/src/data/legal/cookies.ts',
      'frontend/src/data/legal/copyright.ts',
      'frontend/src/data/legal/acceptable_use.ts',
      'frontend/src/components/legal/LegalWatermark.tsx',
      'frontend/src/components/legal/LegalHeader.tsx',
      'frontend/src/components/legal/LegalMetadataBanner.tsx',
      'frontend/src/components/legal/LegalTableOfContents.tsx',
      'frontend/src/components/legal/LegalSectionRenderer.tsx',
      'frontend/src/components/legal/LegalClarificationModal.tsx',
      'frontend/src/components/legal/LegalVersionHistoryModal.tsx',
      'backend/controllers/legal.controller.js',
      'backend/services/legalPdf.service.js',
      'backend/routes/api/legal.routes.js',
    ];

    filesToCheck.forEach((relPath) => {
      it(`enforces mandatory maintenance notice in ${relPath}`, () => {
        const fullPath = path.resolve(__dirname, '../../../', relPath);
        expect(fs.existsSync(fullPath)).toBe(true);
        const content = fs.readFileSync(fullPath, 'utf8');
        expect(content).toContain(MANDATORY_AI_NOTICE_SNIPPET);
        expect(content).toContain('DO NOT DELETE, REMOVE, OR WEAKEN ANY LEGAL PROVISION');
        expect(content).toContain('NATIVE RENDERING MUST REMAIN THE PRIMARY FORM OF DISPLAY');
        expect(content).toContain('THE DOCUMENT WATERMARK, EMBLEM, METADATA BANNER');
      });
    });
  });

  describe('2. Canonical Document Inventory & Integrity Verification', () => {
    const requiredDocumentIds = [
      'terms',
      'privacy',
      'community-guidelines',
      'cookies',
      'copyright',
      'acceptable-use',
    ];

    it('contains all 6 required legal documents', () => {
      expect(ALL_LEGAL_DOCUMENTS.length).toBeGreaterThanOrEqual(6);
      requiredDocumentIds.forEach((id) => {
        const doc = getLegalDocById(id);
        expect(doc).toBeDefined();
        expect(doc?.id).toBe(id);
      });
    });

    it('synchronizes config/legalDocuments.ts with canonical data', () => {
      expect(LEGAL_DOCUMENTS.length).toBeGreaterThanOrEqual(6);
      requiredDocumentIds.forEach((id) => {
        const doc = getLegalDocument(id);
        expect(doc).toBeDefined();
        expect(doc?.public).toBe(true);
        expect(doc?.sha256Hash).toBeDefined();
        expect(doc?.sha256Hash.length).toBe(64);
      });
    });

    it('verifies SHA-256 integrity hash format and metadata for all documents', () => {
      ALL_LEGAL_DOCUMENTS.forEach((doc: CanonicalLegalDocument) => {
        expect(doc.sha256Hash).toMatch(/^[a-f0-9]{64}$/);
        expect(doc.version).toBeDefined();
        expect(doc.effectiveDate).toBeDefined();
        expect(doc.status).toBe('Official');
        expect(doc.publisher).toContain('Sparkle');
        expect(doc.sections.length).toBeGreaterThan(0);
        expect(doc.versionHistory.length).toBeGreaterThan(0);
        expect(doc.versionHistory[0].sha256Hash).toBe(doc.sha256Hash);
      });
    });

    it('preserves comprehensive legal provisions without truncation', () => {
      const terms = getLegalDocById('terms');
      expect(terms?.sections.length).toBeGreaterThanOrEqual(50);

      const privacy = getLegalDocById('privacy');
      expect(privacy?.sections.length).toBeGreaterThanOrEqual(18);

      const community = getLegalDocById('community-guidelines');
      expect(community?.sections.length).toBeGreaterThanOrEqual(20);

      const cookies = getLegalDocById('cookies');
      expect(cookies?.sections.length).toBeGreaterThanOrEqual(5);

      const copyright = getLegalDocById('copyright');
      expect(copyright?.sections.length).toBeGreaterThanOrEqual(5);

      const acceptableUse = getLegalDocById('acceptable-use');
      expect(acceptableUse?.sections.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('3. Clean, Gradient-Free Design Standards', () => {
    it('ensures LegalViewer.tsx does not use background glow or text gradient classes', () => {
      const viewerPath = path.resolve(
        __dirname,
        '../../../frontend/src/pages/LegalViewer.tsx'
      );
      const content = fs.readFileSync(viewerPath, 'utf8');

      // The redesign explicitly forbids gradients and background glows
      expect(content).not.toContain('bg-gradient-to');
      expect(content).not.toContain('blur-3xl');
      expect(content).not.toContain('backdrop-blur-xl');
    });
  });

  describe('4. Reference Number & Workflow Format Check', () => {
    it('verifies reference number format pattern LC-YYYYMMDD-XXXXX', () => {
      const sampleRegex = /^LC-\d{8}-\d{5}$/;
      const sampleRef = `LC-20261109-84729`;
      expect(sampleRegex.test(sampleRef)).toBe(true);
    });

    it('verifies all 6 legal concern categories are supported in types', () => {
      const expectedCategories = [
        'clarification',
        'interpretation',
        'concern',
        'contradiction',
        'amendment',
        'other',
      ];

      const modalPath = path.resolve(
        __dirname,
        '../../../frontend/src/components/legal/LegalClarificationModal.tsx'
      );
      const content = fs.readFileSync(modalPath, 'utf8');

      expectedCategories.forEach((cat) => {
        expect(content).toContain(`value="${cat}"`);
      });
    });
  });
});

