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

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../config/database');
const logger = require('../utils/logger');
const { generateLegalPdf } = require('../services/legalPdf.service');

const LEGAL_DATA_DIR = path.join(__dirname, '../data/legal');

let tableEnsured = false;
async function ensureLegalTables() {
  if (tableEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS legal_inquiries (
        inquiry_id VARCHAR(36) PRIMARY KEY,
        reference_number VARCHAR(30) UNIQUE NOT NULL,
        user_id VARCHAR(36) NULL,
        document_id VARCHAR(50) NOT NULL,
        document_version VARCHAR(20) NOT NULL,
        section_reference VARCHAR(100) NULL,
        concern_category VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        contact_email VARCHAR(150) NULL,
        contact_name VARCHAR(150) NULL,
        attachment_url VARCHAR(500) NULL,
        status VARCHAR(40) DEFAULT 'Submitted',
        admin_response TEXT NULL,
        admin_id VARCHAR(36) NULL,
        responded_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_legal_inq_ref (reference_number),
        INDEX idx_legal_inq_user (user_id),
        INDEX idx_legal_inq_doc (document_id),
        INDEX idx_legal_inq_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    tableEnsured = true;
  } catch (err) {
    logger.warn('Failed to auto-ensure legal_inquiries table:', err.message);
  }
}
ensureLegalTables();

function canonicalStringify(val) {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return '[' + val.map(canonicalStringify).join(',') + ']';
  }
  const sortedKeys = Object.keys(val).sort();
  return '{' + sortedKeys.map(k => JSON.stringify(k) + ':' + canonicalStringify(val[k])).join(',') + '}';
}

/**
 * Helper to compute SHA-256 integrity hash from canonical sections.
 */
function computeCanonicalHash(sections) {
  const canonical = canonicalStringify(sections);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/**
 * Generate a unique, compliant reference number: LC-YYYYMMDD-XXXXX
 */
function generateReferenceNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(10000 + Math.random() * 90000);
  return `LC-${dateStr}-${randomSuffix}`;
}

/**
 * GET /api/legal/documents
 * List all officially published legal documents with metadata and integrity hashes.
 */
async function getLegalDocuments(req, res) {
  try {
    const manifestPath = path.join(LEGAL_DATA_DIR, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return res.status(500).json({ error: 'Legal documents manifest not found.' });
    }
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    res.json({
      documents: manifest,
      publisher: 'Sparkle Technologies (Kenya)',
      jurisdiction: 'Kenya Edition',
      systemStatus: 'Verified Official'
    });
  } catch (err) {
    logger.error('Error in getLegalDocuments:', err);
    res.status(500).json({ error: 'Failed to retrieve legal documents.' });
  }
}

/**
 * GET /api/legal/documents/:id
 * Retrieve a specific canonical legal document with SHA-256 integrity check.
 */
async function getLegalDocumentById(req, res) {
  try {
    const docId = (req.params.id || '').trim().toLowerCase();
    const docPath = path.join(LEGAL_DATA_DIR, `${docId}.json`);

    if (!fs.existsSync(docPath)) {
      return res.status(404).json({ error: `Legal document '${docId}' not found.` });
    }

    const docData = JSON.parse(fs.readFileSync(docPath, 'utf8'));
    const computedHash = computeCanonicalHash(docData.sections);
    const integrityVerified = computedHash === docData.sha256Hash;

    res.json({
      document: docData,
      integrityVerified,
      computedHash,
      storedHash: docData.sha256Hash,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.error(`Error in getLegalDocumentById (${req.params.id}):`, err);
    res.status(500).json({ error: 'Failed to retrieve document details.' });
  }
}

/**
 * GET /api/legal/documents/:id/download
 * Download an authentic watermarked PDF generated from canonical data.
 */
async function downloadLegalDocumentPdf(req, res) {
  try {
    const docId = (req.params.id || '').trim().toLowerCase();
    const docPath = path.join(LEGAL_DATA_DIR, `${docId}.json`);

    if (!fs.existsSync(docPath)) {
      return res.status(404).json({ error: `Legal document '${docId}' not found.` });
    }

    const docData = JSON.parse(fs.readFileSync(docPath, 'utf8'));
    const filename = `Sparkle_${docData.shortTitle.replace(/[^a-zA-Z0-9]/g, '_')}_v${docData.version}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');

    generateLegalPdf(docData, res);
  } catch (err) {
    logger.error(`Error downloading legal PDF for ${req.params.id}:`, err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate downloadable PDF document.' });
    }
  }
}

/**
 * POST /api/legal/inquiries
 * Submit a legal clarification, interpretation request, contradiction report, or amendment.
 */
async function submitLegalInquiry(req, res) {
  await ensureLegalTables();
  try {
    const {
      documentId,
      documentVersion,
      sectionReference,
      category,
      description,
      contactEmail,
      contactName,
      attachmentUrl
    } = req.body;

    if (!documentId || !description || !category) {
      return res.status(400).json({
        error: 'Missing required fields: documentId, category, and description are required.'
      });
    }

    const validCategories = [
      'clarification',
      'interpretation',
      'concern',
      'contradiction',
      'amendment',
      'other'
    ];

    if (!validCategories.includes(category)) {
      return res.status(400).json({
        error: `Invalid category. Must be one of: ${validCategories.join(', ')}`
      });
    }

    if (description.trim().length < 15) {
      return res.status(400).json({
        error: 'Description must be at least 15 characters long.'
      });
    }

    const userId = req.user?.user_id || req.user?.userId || null;
    const inquiryId = crypto.randomUUID();
    const referenceNumber = generateReferenceNumber();

    await pool.query(
      `INSERT INTO legal_inquiries
       (inquiry_id, reference_number, user_id, document_id, document_version,
        section_reference, concern_category, description, contact_email,
        contact_name, attachment_url, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted')`,
      [
        inquiryId,
        referenceNumber,
        userId,
        documentId.trim().toLowerCase(),
        documentVersion || '1.0',
        sectionReference ? sectionReference.trim() : null,
        category,
        description.trim(),
        contactEmail ? contactEmail.trim() : (req.user?.email || null),
        contactName ? contactName.trim() : (req.user?.name || null),
        attachmentUrl || null
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Legal inquiry submitted successfully. Please retain your reference number.',
      inquiryId,
      referenceNumber,
      status: 'Submitted',
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    logger.error('Error submitting legal inquiry:', err);
    res.status(500).json({ error: 'Failed to submit legal inquiry. Please try again later.' });
  }
}

/**
 * GET /api/legal/inquiries/track/:reference
 * Track the status of a legal inquiry by reference number.
 */
async function trackLegalInquiry(req, res) {
  await ensureLegalTables();
  try {
    const reference = (req.params.reference || '').trim().toUpperCase();
    if (!reference) {
      return res.status(400).json({ error: 'Reference number is required.' });
    }

    const [rows] = await pool.query(
      `SELECT inquiry_id, reference_number, document_id, document_version,
              section_reference, concern_category, description, status,
              admin_response, responded_at, created_at, updated_at
       FROM legal_inquiries
       WHERE reference_number = ?`,
      [reference]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: `Inquiry '${reference}' not found.` });
    }

    const item = rows[0];
    res.json({
      referenceNumber: item.reference_number,
      documentId: item.document_id,
      documentVersion: item.document_version,
      sectionReference: item.section_reference,
      category: item.concern_category,
      status: item.status,
      adminResponse: item.admin_response,
      respondedAt: item.responded_at,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    });
  } catch (err) {
    logger.error('Error tracking legal inquiry:', err);
    res.status(500).json({ error: 'Failed to track inquiry.' });
  }
}

/**
 * GET /api/legal/inquiries/my
 * List inquiries submitted by the authenticated user.
 */
async function getMyLegalInquiries(req, res) {
  await ensureLegalTables();
  try {
    const userId = req.user?.user_id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const [rows] = await pool.query(
      `SELECT inquiry_id, reference_number, document_id, document_version,
              section_reference, concern_category, description, status,
              admin_response, responded_at, created_at, updated_at
       FROM legal_inquiries
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ inquiries: rows });
  } catch (err) {
    logger.error('Error in getMyLegalInquiries:', err);
    res.status(500).json({ error: 'Failed to retrieve your inquiries.' });
  }
}

/**
 * GET /api/legal/inquiries/admin
 * Admin list & filter all legal inquiries.
 */
async function getAdminLegalInquiries(req, res) {
  await ensureLegalTables();
  try {
    const { status, category, documentId, search } = req.query;
    let query = `SELECT * FROM legal_inquiries WHERE 1=1`;
    const params = [];

    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    if (category) {
      query += ` AND concern_category = ?`;
      params.push(category);
    }
    if (documentId) {
      query += ` AND document_id = ?`;
      params.push(documentId);
    }
    if (search) {
      query += ` AND (reference_number LIKE ? OR description LIKE ? OR contact_email LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY created_at DESC LIMIT 100`;

    const [rows] = await pool.query(query, params);
    res.json({ inquiries: rows, count: rows.length });
  } catch (err) {
    logger.error('Error in getAdminLegalInquiries:', err);
    res.status(500).json({ error: 'Failed to retrieve administrative inquiries.' });
  }
}

/**
 * PATCH /api/legal/inquiries/:id
 * Admin review, status update, and response for a legal inquiry.
 */
async function updateAdminLegalInquiry(req, res) {
  await ensureLegalTables();
  try {
    const { id } = req.params;
    const { status, adminResponse } = req.body;
    const adminId = req.user?.user_id || req.user?.userId;

    const validStatuses = ['Submitted', 'Under Review', 'Awaiting Clarification', 'Resolved', 'Closed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    await pool.query(
      `UPDATE legal_inquiries
       SET status = COALESCE(?, status),
           admin_response = COALESCE(?, admin_response),
           admin_id = ?,
           responded_at = NOW(),
           updated_at = NOW()
       WHERE inquiry_id = ?`,
      [status || null, adminResponse || null, adminId, id]
    );

    res.json({ success: true, message: 'Inquiry updated successfully.' });
  } catch (err) {
    logger.error('Error in updateAdminLegalInquiry:', err);
    res.status(500).json({ error: 'Failed to update inquiry.' });
  }
}

module.exports = {
  getLegalDocuments,
  getLegalDocumentById,
  downloadLegalDocumentPdf,
  submitLegalInquiry,
  trackLegalInquiry,
  getMyLegalInquiries,
  getAdminLegalInquiries,
  updateAdminLegalInquiry
};
