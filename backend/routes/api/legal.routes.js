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

const express = require('express');
const router = express.Router();
const legalController = require('../../controllers/legal.controller');
const { authMiddleware, optionalAuth } = require('../../middleware/auth.middleware');
const { adminMiddleware } = require('../../middleware/admin.middleware');

// Public Document Endpoints
router.get('/documents', legalController.getLegalDocuments);
router.get('/documents/:id', legalController.getLegalDocumentById);
router.get('/documents/:id/download', legalController.downloadLegalDocumentPdf);

// Legal Inquiry & Clarification Endpoints
router.post('/inquiries', optionalAuth, legalController.submitLegalInquiry);
router.get('/inquiries/track/:reference', legalController.trackLegalInquiry);
router.get('/inquiries/my', authMiddleware, legalController.getMyLegalInquiries);

// Admin Management Endpoints
router.get('/inquiries/admin', authMiddleware, adminMiddleware, legalController.getAdminLegalInquiries);
router.patch('/inquiries/:id', authMiddleware, adminMiddleware, legalController.updateAdminLegalInquiry);

module.exports = router;

