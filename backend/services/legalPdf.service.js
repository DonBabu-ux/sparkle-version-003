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

const PDFDocument = require('pdfkit');

/**
 * Generates an official, watermarked Sparkle legal PDF document stream.
 * @param {Object} docData Canonical legal document structure
 * @param {import('stream').Writable} outputStream Stream to write PDF bytes into
 */
function generateLegalPdf(docData, outputStream) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 54, bottom: 54, left: 48, right: 48 },
    bufferPages: true,
    info: {
      Title: docData.title,
      Author: docData.publisher || 'Sparkle Technologies (Kenya)',
      Subject: docData.description,
      Keywords: `Sparkle, Legal, ${docData.shortTitle}, Kenya, Compliance`,
      CreationDate: new Date(docData.effectiveDate || Date.now())
    }
  });

  doc.pipe(outputStream);

  // Document Title Header
  doc
    .fontSize(10)
    .font('Helvetica-Bold')
    .fillColor('#db2777')
    .text('SPARKLE LEGAL CENTRE  •  OFFICIAL PUBLICATION', { tracking: 1.5 });

  doc.moveDown(0.5);

  doc
    .fontSize(22)
    .font('Helvetica-Bold')
    .fillColor('#18181b')
    .text(docData.title);

  doc.moveDown(0.3);

  doc
    .fontSize(10)
    .font('Helvetica')
    .fillColor('#52525b')
    .text(docData.description, { lineGap: 3 });

  doc.moveDown(0.8);

  // Metadata Table Box
  const boxTop = doc.y;
  doc
    .rect(48, boxTop, 499, 74)
    .fillAndStroke('#f4f4f5', '#e4e4e7');

  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#27272a')
    .text('DOCUMENT ID:', 58, boxTop + 10)
    .font('Helvetica')
    .fillColor('#52525b')
    .text(docData.id, 140, boxTop + 10)
    .font('Helvetica-Bold')
    .fillColor('#27272a')
    .text('VERSION:', 260, boxTop + 10)
    .font('Helvetica')
    .fillColor('#52525b')
    .text(docData.version, 320, boxTop + 10)
    .font('Helvetica-Bold')
    .fillColor('#27272a')
    .text('STATUS:', 390, boxTop + 10)
    .font('Helvetica-Bold')
    .fillColor('#166534')
    .text(docData.status || 'Official', 445, boxTop + 10);

  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#27272a')
    .text('EFFECTIVE DATE:', 58, boxTop + 26)
    .font('Helvetica')
    .fillColor('#52525b')
    .text(docData.effectiveDate, 140, boxTop + 26)
    .font('Helvetica-Bold')
    .fillColor('#27272a')
    .text('JURISDICTION:', 260, boxTop + 26)
    .font('Helvetica')
    .fillColor('#52525b')
    .text(docData.jurisdiction || 'Kenya Edition', 340, boxTop + 26);

  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#27272a')
    .text('SHA-256 HASH:', 58, boxTop + 42)
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor('#3f3f46')
    .text(docData.sha256Hash || 'N/A', 140, boxTop + 43);

  doc
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .fillColor('#27272a')
    .text('PUBLISHER:', 58, boxTop + 58)
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor('#52525b')
    .text(docData.publisher || 'Sparkle Technologies (Kenya)', 140, boxTop + 58)
    .font('Helvetica-Bold')
    .fillColor('#27272a')
    .text('REFERENCE:', 340, boxTop + 58)
    .font('Helvetica')
    .fillColor('#52525b')
    .text(docData.officialReference || 'SPK-LEG-DOC', 415, boxTop + 58);

  doc.y = boxTop + 90;
  doc.moveDown(0.5);

  // Render Sections
  if (Array.isArray(docData.sections)) {
    for (const section of docData.sections) {
      if (doc.y > 680) {
        doc.addPage();
      }

      doc
        .fontSize(13)
        .font('Helvetica-Bold')
        .fillColor('#18181b')
        .text(`${section.number ? section.number + '. ' : ''}${section.title}`);

      doc
        .moveTo(48, doc.y + 2)
        .lineTo(547, doc.y + 2)
        .strokeColor('#fbcfe8')
        .lineWidth(0.75)
        .stroke();

      doc.moveDown(0.4);

      if (Array.isArray(section.paragraphs)) {
        for (const p of section.paragraphs) {
          if (doc.y > 720) {
            doc.addPage();
          }
          doc
            .fontSize(9.5)
            .font('Helvetica')
            .fillColor('#27272a')
            .text(p, { lineGap: 3.5, align: 'justify' });
          doc.moveDown(0.3);
        }
      }

      if (Array.isArray(section.subsections)) {
        for (const sub of section.subsections) {
          if (doc.y > 720) {
            doc.addPage();
          }

          doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .fillColor('#27272a')
            .text(`${sub.number ? sub.number + ' ' : ''}${sub.title}`);

          doc.moveDown(0.2);

          if (Array.isArray(sub.content)) {
            for (const c of sub.content) {
              if (doc.y > 720) {
                doc.addPage();
              }
              doc
                .fontSize(9)
                .font('Helvetica')
                .fillColor('#3f3f46')
                .text(c, { lineGap: 3, align: 'justify' });
              doc.moveDown(0.25);
            }
          }
        }
      }

      doc.moveDown(0.6);
    }
  }

  // Two-pass formatting: Add Header, Footer, and Authenticity Watermark on every page
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);

    // Running Header
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#a1a1aa')
      .text(
        `Official Sparkle Legal Document | Version ${docData.version} | sparkleweb.app`,
        48,
        28,
        { width: 499, align: 'left' }
      );

    doc
      .moveTo(48, 40)
      .lineTo(547, 40)
      .strokeColor('#f4f4f5')
      .lineWidth(0.5)
      .stroke();

    // Running Footer
    doc
      .moveTo(48, 792)
      .lineTo(547, 792)
      .strokeColor('#e4e4e7')
      .lineWidth(0.5)
      .stroke();

    doc
      .fontSize(7.5)
      .font('Helvetica')
      .fillColor('#71717a')
      .text(
        `Official Sparkle Legal Document | Version ${docData.version} | sparkleweb.app`,
        48,
        800,
        { width: 280, align: 'left' }
      );

    doc
      .fontSize(7.5)
      .font('Helvetica-Bold')
      .fillColor('#71717a')
      .text(
        `Page ${i + 1} of ${pages.count}`,
        48,
        800,
        { width: 499, align: 'right' }
      );

    // Subtle Authenticity Watermark with Sparkle Pink tone (Centered, 45 degree angle)
    doc.save();
    doc.opacity(0.045);
    doc.translate(297, 420);
    doc.rotate(-45);
    doc
      .fontSize(38)
      .font('Helvetica-Bold')
      .fillColor('#be185d')
      .text('SPARKLE LEGAL DOCUMENT', -240, -20, { align: 'center', width: 480 });

    doc
      .fontSize(14)
      .font('Helvetica')
      .fillColor('#be185d')
      .text(
        `AUTHENTIC OFFICIAL COPY  •  ${docData.id.toUpperCase()} v${docData.version}  •  ${docData.sha256Hash ? docData.sha256Hash.slice(0, 16) : ''}...`,
        -240,
        25,
        { align: 'center', width: 480 }
      );
    doc.restore();
  }

  doc.end();
}

module.exports = {
  generateLegalPdf
};

