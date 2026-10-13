// services/dataExport.service.js - Sparkle Secure Data Export Engine
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const pool = require('../config/database');
const logger = require('../utils/logger');
const emailService = require('./email.service');

const EXPORTS_DIR = path.join(__dirname, '../exports_storage');
if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true, mode: 0o700 });
}

// Neutralize spreadsheet formula injection (=, +, -, @, \t, \r)
function sanitizeCell(val) {
    if (val == null) return '';
    const str = String(val);
    if (/^[=+\-@\t\r]/.test(str)) {
        return `'${str}`;
    }
    return str;
}

/**
 * Manifest of Permitted Categories & Sanitized Fields
 */
const CATEGORY_MANIFEST = {
    profile: {
        title: 'Profile Information',
        query: `SELECT user_id, username, display_name, name, email, bio, campus, affiliation, major, interests,
                       followers_count, following_count, posts_count, created_at, updated_at
                FROM users WHERE user_id = ?`,
        formatters: (rows) => rows.map(r => ({
            'User ID': r.user_id,
            'Username': r.username,
            'Display Name': r.display_name || r.name,
            'Email': r.email,
            'Bio': r.bio || '',
            'Campus / Affiliation': r.campus || r.affiliation || '',
            'Field of Study / Major': r.major || '',
            'Followers Count': r.followers_count || 0,
            'Following Count': r.following_count || 0,
            'Account Created': r.created_at ? new Date(r.created_at).toISOString() : ''
        }))
    },
    posts: {
        title: 'Posts & Captions',
        query: `SELECT post_id, caption, location, sparks_count, comments_count, created_at
                FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 500`,
        formatters: (rows) => rows.map(r => ({
            'Post ID': r.post_id,
            'Caption': r.caption || '',
            'Location': r.location || '',
            'Sparks Count': r.sparks_count || 0,
            'Comments Count': r.comments_count || 0,
            'Posted At': r.created_at ? new Date(r.created_at).toISOString() : ''
        }))
    },
    comments: {
        title: 'Comments Authored',
        query: `SELECT comment_id, post_id, content, created_at
                FROM comments WHERE user_id = ? ORDER BY created_at DESC LIMIT 500`,
        formatters: (rows) => rows.map(r => ({
            'Comment ID': r.comment_id,
            'Post ID': r.post_id,
            'Content': r.content || '',
            'Created At': r.created_at ? new Date(r.created_at).toISOString() : ''
        }))
    },
    messages: {
        title: 'Sent Messages (Outbox)',
        query: `SELECT message_id, conversation_id, content, created_at
                FROM messages WHERE sender_id = ? ORDER BY created_at DESC LIMIT 500`,
        formatters: (rows) => rows.map(r => ({
            'Message ID': r.message_id,
            'Conversation Reference': r.conversation_id,
            'Content': r.content || '',
            'Sent At': r.created_at ? new Date(r.created_at).toISOString() : ''
        }))
    },
    moments: {
        title: 'Moments & Stories',
        query: `SELECT moment_id, caption, location, views_count, created_at
                FROM moments WHERE user_id = ? ORDER BY created_at DESC LIMIT 200`,
        formatters: (rows) => rows.map(r => ({
            'Moment ID': r.moment_id,
            'Caption': r.caption || '',
            'Location': r.location || '',
            'Views Count': r.views_count || 0,
            'Created At': r.created_at ? new Date(r.created_at).toISOString() : ''
        }))
    },
    groups: {
        title: 'Groups & Clubs Membership',
        query: `SELECT g.group_id, g.name AS group_name, gm.role, gm.joined_at
                FROM group_members gm
                JOIN groups g ON gm.group_id = g.group_id
                WHERE gm.user_id = ?`,
        formatters: (rows) => rows.map(r => ({
            'Group ID': r.group_id,
            'Group Name': r.group_name,
            'Member Role': r.role || 'member',
            'Joined Date': r.joined_at ? new Date(r.joined_at).toISOString() : ''
        }))
    },
    marketplace: {
        title: 'Marketplace Listings',
        query: `SELECT item_id, title, price, currency, category, condition_type, status, created_at
                FROM marketplace_items WHERE seller_id = ? ORDER BY created_at DESC LIMIT 100`,
        formatters: (rows) => rows.map(r => ({
            'Item ID': r.item_id,
            'Title': r.title,
            'Price': `${r.currency || 'USD'} ${r.price}`,
            'Category': r.category || 'General',
            'Condition': r.condition_type || '',
            'Status': r.status || 'active',
            'Listed At': r.created_at ? new Date(r.created_at).toISOString() : ''
        }))
    },
    consents_settings: {
        title: 'Settings & Consents',
        query: `SELECT high_contrast, video_autoplay, auto_suppress_notifications, data_saving_mode, request_filtering,
                       cellular_low_data, background_sync_throttling, email_notifications, push_notifications
                FROM users WHERE user_id = ?`,
        formatters: (rows) => rows.map(r => ({
            'High Contrast': !!r.high_contrast,
            'Video Autoplay': !!r.video_autoplay,
            'Auto Suppress Notifications': !!r.auto_suppress_notifications,
            'Data Saving Mode': !!r.data_saving_mode,
            'Request Filtering': !!r.request_filtering,
            'Cellular Low Data': !!r.cellular_low_data,
            'Background Sync Throttling': !!r.background_sync_throttling,
            'Email Notifications Enabled': !!r.email_notifications,
            'Push Notifications Enabled': !!r.push_notifications
        }))
    }
};

class DataExportService {
    /**
     * Create an Export Job Request
     */
    async requestExport({ userId, requestedCategories, format = 'pdf', deliveryEmail, isAlternate = false }) {
        if (!userId) throw new Error('User ID is required');

        // Check account existence and eligibility
        const [users] = await pool.query('SELECT user_id, email, name, account_status FROM users WHERE user_id = ?', [userId]);
        if (users.length === 0) throw new Error('User not found');
        const user = users[0];

        // Valid categories selection
        const availableKeys = Object.keys(CATEGORY_MANIFEST);
        let categories = (requestedCategories || []).filter(c => availableKeys.includes(c));
        if (categories.length === 0) categories = availableKeys; // default to all available

        const validFormats = ['pdf', 'xlsx', 'csv', 'json'];
        const targetFormat = validFormats.includes(format.toLowerCase()) ? format.toLowerCase() : 'pdf';

        const finalEmail = (isAlternate && deliveryEmail) ? String(deliveryEmail).trim().toLowerCase() : user.email;

        // Idempotency: If a pending or running job exists for this user, return it
        const [existing] = await pool.query(`
            SELECT job_id, status, created_at, token_expires_at, download_token
            FROM data_export_jobs
            WHERE user_id = ? AND status IN ('REQUESTED', 'QUEUED', 'PROCESSING')
            ORDER BY created_at DESC LIMIT 1
        `, [userId]);

        if (existing.length > 0) {
            return {
                jobId: existing[0].job_id,
                status: existing[0].status,
                message: 'An export job is already currently in progress for your account.',
                createdAt: existing[0].created_at
            };
        }

        const jobId = crypto.randomUUID();
        const downloadToken = crypto.randomBytes(32).toString('hex');

        await pool.query(`
            INSERT INTO data_export_jobs (
                job_id, user_id, categories, format, delivery_email, is_alternate_email,
                status, download_token, token_expires_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 'QUEUED', ?, DATE_ADD(NOW(), INTERVAL 48 HOUR), NOW())
        `, [
            jobId,
            userId,
            JSON.stringify(categories),
            targetFormat,
            finalEmail,
            isAlternate ? 1 : 0,
            downloadToken
        ]);

        // Kick off asynchronous export processing
        setImmediate(() => {
            this.processJob(jobId).catch(err => {
                logger.error(`[DataExport] Job ${jobId} failed during execution: ${err.message}`);
            });
        });

        return {
            jobId,
            status: 'QUEUED',
            categories,
            format: targetFormat,
            deliveryEmail: finalEmail,
            message: 'Export request queued successfully.'
        };
    }

    /**
     * Query data for selected categories
     */
    async collectData(userId, categories) {
        const dataset = {};
        for (const cat of categories) {
            const spec = CATEGORY_MANIFEST[cat];
            if (!spec) continue;
            try {
                const [rows] = await pool.query(spec.query, [userId]);
                dataset[cat] = {
                    title: spec.title,
                    rows: spec.formatters ? spec.formatters(rows) : rows
                };
            } catch (err) {
                logger.warn(`[DataExport] Collection warning for ${cat}: ${err.message}`);
                dataset[cat] = { title: spec.title, rows: [] };
            }
        }
        return dataset;
    }

    /**
     * Process Job Asynchronously
     */
    async processJob(jobId) {
        const [jobs] = await pool.query(`
            SELECT j.*, u.name, u.email as user_email
            FROM data_export_jobs j
            JOIN users u ON j.user_id = u.user_id
            WHERE j.job_id = ?
        `, [jobId]);

        if (jobs.length === 0) return;
        const job = jobs[0];

        await pool.query('UPDATE data_export_jobs SET status = "PROCESSING" WHERE job_id = ?', [jobId]);

        try {
            const categories = typeof job.categories === 'string' ? JSON.parse(job.categories) : job.categories;
            const dataset = await this.collectData(job.user_id, categories);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const fileName = `sparkle_export_${job.user_id.slice(0, 8)}_${timestamp}.${job.format}`;
            const filePath = path.join(EXPORTS_DIR, fileName);

            // Generate specified format
            if (job.format === 'pdf') {
                await this.generatePdf(dataset, filePath, job);
            } else if (job.format === 'xlsx') {
                await this.generateXlsx(dataset, filePath, job);
            } else if (job.format === 'csv') {
                await this.generateCsv(dataset, filePath, job);
            } else {
                // json
                await fs.promises.writeFile(filePath, JSON.stringify({
                    metadata: {
                        archiveId: jobId,
                        exportedAt: new Date().toISOString(),
                        sparkleVersion: '2.0.0-production',
                        compliance: 'GDPR Article 15 / CCPA Compliant Report'
                    },
                    data: dataset
                }, null, 2), 'utf8');
            }

            const stats = await fs.promises.stat(filePath);

            await pool.query(`
                UPDATE data_export_jobs
                SET status = 'READY',
                    file_path = ?,
                    file_size_bytes = ?,
                    completed_at = NOW()
                WHERE job_id = ?
            `, [filePath, stats.size, jobId]);

            // Notify user with secure download link
            const appUrl = process.env.APP_URL || 'http://localhost:3000';
            const downloadUrl = `${appUrl}/api/users/data-centre/download/${job.download_token}`;

            const sizeMb = (stats.size / (1024 * 1024)).toFixed(2) + ' MB';
            await emailService.send({
                to: job.delivery_email,
                subject: 'Your Sparkle Data Archive is Ready',
                templateName: 'export-ready',
                templateData: {
                    name: job.name,
                    format: job.format,
                    fileSize: sizeMb,
                    downloadUrl,
                    expiryDate: '48 hours from receipt'
                }
            }).catch(e => logger.warn(`[DataExport] Email notify failed for ${jobId}: ${e.message}`));

            logger.info(`[DataExport] Job ${jobId} successfully finished and generated ${fileName} (${stats.size} bytes).`);
        } catch (err) {
            logger.error(`[DataExport] Fatal job generation error for ${jobId}:`, err);
            await pool.query(`
                UPDATE data_export_jobs
                SET status = 'FAILED', failure_reason = ?
                WHERE job_id = ?
            `, [err.message.slice(0, 450), jobId]);
        }
    }

    /**
     * PDF Generator (Streaming with PDFKit)
     */
    generatePdf(dataset, outputPath, job) {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            const stream = fs.createWriteStream(outputPath);
            doc.pipe(stream);

            // Cover Header
            doc.rect(0, 0, doc.page.width, 100).fill('#0f172a');
            doc.fillColor('#ffffff').fontSize(22).font('Helvetica-Bold').text('SPARKLE PERSONAL DATA REPORT', 40, 35);
            doc.fontSize(10).font('Helvetica').text(`GDPR Article 15 & CCPA Account Export Archive`, 40, 65);

            doc.fillColor('#334155').fontSize(11).font('Helvetica-Bold').text('EXPORT DETAILS', 40, 120);
            doc.font('Helvetica').fontSize(9).fillColor('#64748b')
               .text(`Account Reference: ${job.user_id}`, 40, 138)
               .text(`Date of Compilation: ${new Date().toUTCString()}`, 40, 152)
               .text(`Export Request ID: ${job.job_id}`, 40, 166);

            doc.moveTo(40, 185).lineTo(doc.page.width - 40, 185).strokeColor('#e2e8f0').stroke();

            let y = 205;

            // Render each category
            for (const [catKey, catData] of Object.entries(dataset)) {
                if (y > 680) { doc.addPage(); y = 50; }

                doc.fillColor('#0284c7').fontSize(13).font('Helvetica-Bold').text(catData.title.toUpperCase(), 40, y);
                y += 20;

                if (!catData.rows || catData.rows.length === 0) {
                    doc.fillColor('#94a3b8').fontSize(9).font('Helvetica-Oblique').text('No recorded activity or data in this category.', 45, y);
                    y += 25;
                    continue;
                }

                // Render list rows
                for (const row of catData.rows) {
                    if (y > 720) { doc.addPage(); y = 50; }

                    doc.rect(40, y, doc.page.width - 80, 2).fill('#f1f5f9');
                    y += 8;

                    for (const [field, val] of Object.entries(row)) {
                        if (y > 750) { doc.addPage(); y = 50; }
                        const strVal = String(val == null ? '' : val);
                        doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold').text(`${field}: `, 45, y, { continued: true });
                        doc.fillColor('#1e293b').font('Helvetica').text(strVal);
                        y += 13;
                    }
                    y += 8;
                }
                y += 15;
            }

            // Pagination footer
            const range = doc.bufferedPageRange();
            for (let i = range.start; i < range.start + range.count; i++) {
                doc.switchToPage(i);
                doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
                   .text(`Sparkle Secure Export • Page ${i + 1} of ${range.count}`, 40, doc.page.height - 30, {
                       align: 'center',
                       width: doc.page.width - 80
                   });
            }

            doc.end();
            stream.on('finish', resolve);
            stream.on('error', reject);
        });
    }

    /**
     * Excel XLSX Generator (ExcelJS)
     */
    async generateXlsx(dataset, outputPath, job) {
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Sparkle Data Engine';
        workbook.created = new Date();

        for (const [catKey, catData] of Object.entries(dataset)) {
            const sheetName = catData.title.slice(0, 30).replace(/[*?:/\\[\]]/g, '');
            const sheet = workbook.addWorksheet(sheetName);

            if (!catData.rows || catData.rows.length === 0) {
                sheet.addRow(['No data recorded for this category']);
                continue;
            }

            const headers = Object.keys(catData.rows[0]);
            sheet.columns = headers.map(h => ({ header: h, key: h, width: Math.max(h.length + 5, 20) }));

            sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };

            for (const item of catData.rows) {
                const safeRow = {};
                for (const h of headers) {
                    safeRow[h] = sanitizeCell(item[h]);
                }
                sheet.addRow(safeRow);
            }
        }

        await workbook.xlsx.writeFile(outputPath);
    }

    /**
     * CSV Generator (Sanitized format)
     */
    async generateCsv(dataset, outputPath, job) {
        let fullCsv = `# SPARKLE PERSONAL DATA ARCHIVE\n# User Reference: ${job.user_id}\n# Export ID: ${job.job_id}\n\n`;

        for (const [catKey, catData] of Object.entries(dataset)) {
            fullCsv += `\n### CATEGORY: ${catData.title}\n`;
            if (!catData.rows || catData.rows.length === 0) {
                fullCsv += `No records available.\n`;
                continue;
            }

            const headers = Object.keys(catData.rows[0]);
            fullCsv += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(',') + '\n';

            for (const item of catData.rows) {
                const line = headers.map(h => {
                    const clean = sanitizeCell(item[h]);
                    return `"${clean.replace(/"/g, '""')}"`;
                }).join(',');
                fullCsv += line + '\n';
            }
        }

        await fs.promises.writeFile(outputPath, fullCsv, 'utf8');
    }

    /**
     * Get User Export History
     */
    async getUserExports(userId) {
        const [rows] = await pool.query(`
            SELECT job_id, categories, format, delivery_email, status,
                   file_size_bytes, download_token, token_expires_at, created_at, completed_at
            FROM data_export_jobs
            WHERE user_id = ?
            ORDER BY created_at DESC LIMIT 20
        `, [userId]);

        return rows.map(r => ({
            jobId: r.job_id,
            categories: typeof r.categories === 'string' ? JSON.parse(r.categories) : r.categories,
            format: r.format,
            deliveryEmail: r.delivery_email,
            status: r.status,
            fileSizeBytes: r.file_size_bytes,
            downloadToken: r.status === 'READY' && new Date(r.token_expires_at) > new Date() ? r.download_token : null,
            expiresAt: r.token_expires_at,
            createdAt: r.created_at,
            completedAt: r.completed_at
        }));
    }

    /**
     * Secure Download by Token
     */
    async getFileByToken(token) {
        const [jobs] = await pool.query(`
            SELECT job_id, file_path, status, token_expires_at, format, user_id
            FROM data_export_jobs
            WHERE download_token = ?
        `, [token]);

        if (jobs.length === 0) throw new Error('Invalid or non-existent download token.');
        const job = jobs[0];

        if (job.status !== 'READY' || !job.file_path || !fs.existsSync(job.file_path)) {
            throw new Error('Requested file is not available or has been purged.');
        }

        if (new Date(job.token_expires_at) <= new Date()) {
            throw new Error('Download link has expired.');
        }

        await pool.query('UPDATE data_export_jobs SET download_count = download_count + 1 WHERE job_id = ?', [job.job_id]);

        return {
            filePath: job.file_path,
            format: job.format,
            fileName: path.basename(job.file_path)
        };
    }
}

module.exports = new DataExportService();
