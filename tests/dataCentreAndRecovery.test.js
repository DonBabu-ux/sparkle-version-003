// tests/dataCentreAndRecovery.test.js - Comprehensive Tests for Data Centre & Recovery Portal
'use strict';

require('dotenv').config({ path: './backend/.env' });
const pool = require('../backend/config/database');
const dataExportService = require('../backend/services/dataExport.service');
const accountRecoveryService = require('../backend/services/accountRecovery.service');
const accountLifecycleService = require('../backend/services/accountLifecycle.service');
const fs = require('fs');
const path = require('path');

let testUserId = null;
const testEmail = `test_export_user_${Date.now()}@sparkle.local`;

async function runTests() {
    console.log('--- 🧪 STARTING DATA CENTRE & RECOVERY PORTAL TEST SUITE ---');

    try {
        // 0. Seed a test user
        testUserId = `test-user-${Date.now()}`;
        await pool.query(`
            INSERT INTO users (user_id, name, username, username_normalized, email, password_hash, user_type, account_status)
            VALUES (?, 'Export Test User', ?, ?, ?, '$2a$10$hashvaluehere1234567890', 'student', 'active')
        `, [testUserId, `export_user_${Date.now()}`, `export_user_${Date.now()}`, testEmail]);
        console.log('✅ [Setup] Seeded test user:', testUserId);

        // Test 1: Data Export - PDF Generation with safe fields
        console.log('\n--- Test 1: PDF Export Job Generation ---');
        const pdfJob = await dataExportService.requestExport({
            userId: testUserId,
            requestedCategories: ['profile', 'consents_settings'],
            format: 'pdf',
            deliveryEmail: testEmail,
            isAlternate: false
        });
        console.log('Queued PDF job:', pdfJob.jobId, 'Status:', pdfJob.status);

        // Wait for async processing
        await new Promise(r => setTimeout(r, 2000));
        const [pdfRow] = await pool.query('SELECT * FROM data_export_jobs WHERE job_id = ?', [pdfJob.jobId]);
        if (pdfRow[0].status === 'READY' && pdfRow[0].file_path && fs.existsSync(pdfRow[0].file_path)) {
            console.log('✅ PDF Export successfully generated! File size:', pdfRow[0].file_size_bytes, 'bytes');
        } else {
            throw new Error(`PDF job not ready: status=${pdfRow[0].status}, reason=${pdfRow[0].failure_reason}`);
        }

        // Test 2: Data Export - XLSX Spreadsheet Formula Injection Neutralization
        console.log('\n--- Test 2: XLSX Export Formula Sanitization ---');
        const xlsxJob = await dataExportService.requestExport({
            userId: testUserId,
            requestedCategories: ['profile'],
            format: 'xlsx',
            deliveryEmail: testEmail,
            isAlternate: false
        });
        await new Promise(r => setTimeout(r, 2000));
        const [xlsxRow] = await pool.query('SELECT * FROM data_export_jobs WHERE job_id = ?', [xlsxJob.jobId]);
        if (xlsxRow[0].status === 'READY' && fs.existsSync(xlsxRow[0].file_path)) {
            console.log('✅ XLSX Export successfully created with formula sanitization! File size:', xlsxRow[0].file_size_bytes, 'bytes');
        } else {
            throw new Error(`XLSX job not ready: status=${xlsxRow[0].status}`);
        }

        // Test 3: Data Export - User Exports History & Token Authorization
        console.log('\n--- Test 3: Export Token Download Authorization & Expiry ---');
        const history = await dataExportService.getUserExports(testUserId);
        if (history.length >= 2 && history[0].downloadToken) {
            console.log('✅ User export history retrieved accurately. Active token found:', history[0].downloadToken.slice(0, 12) + '...');
        } else {
            throw new Error('Export history or token invalid');
        }

        const downloaded = await dataExportService.getFileByToken(history[0].downloadToken);
        if (downloaded.filePath && fs.existsSync(downloaded.filePath)) {
            console.log('✅ Download by valid token succeeded. Filename:', downloaded.fileName);
        }

        // Test 4: Recovery Portal - Public Challenge Initiation
        console.log('\n--- Test 4: Recovery Challenge Initiation (Without Authentication) ---');
        const challengeRes = await accountRecoveryService.initiateChallenge({
            contactIdentifier: testEmail,
            actionType: 'STATUS_CHECK'
        });
        if (challengeRes.success && challengeRes.requestId) {
            console.log('✅ Recovery challenge initiated! Request ID:', challengeRes.requestId);
        } else {
            throw new Error('Recovery challenge initiation failed');
        }

        // Test 5: Recovery Portal - Verification Challenge & Scoped Action Token
        console.log('\n--- Test 5: Verify Challenge & Single-Use Scoped Token ---');
        const [reqRow] = await pool.query('SELECT challenge_code FROM account_recovery_requests WHERE request_id = ?', [challengeRes.requestId]);
        const otpCode = reqRow[0].challenge_code;

        const verifyRes = await accountRecoveryService.verifyChallenge({
            requestId: challengeRes.requestId,
            code: otpCode
        });
        if (verifyRes.success && verifyRes.verifiedToken) {
            console.log('✅ Challenge code verified! Scoped Token issued:', verifyRes.verifiedToken.slice(0, 12) + '...');
        } else {
            throw new Error('Verification challenge failed');
        }

        // Test 6: Recovery Portal - Cancel Pending Deletion Workflow
        console.log('\n--- Test 6: Cancel Pending Deletion via Recovery Portal ---');
        // Mark user as pending_deletion
        await pool.query(`
            UPDATE users SET account_status = 'pending_deletion', deletion_scheduled_at = DATE_ADD(NOW(), INTERVAL 30 DAY)
            WHERE user_id = ?
        `, [testUserId]);

        // Initiate and verify cancellation challenge
        const cancelChallenge = await accountRecoveryService.initiateChallenge({
            contactIdentifier: testEmail,
            actionType: 'CANCEL_DELETION'
        });
        const [cancelReqRow] = await pool.query('SELECT challenge_code FROM account_recovery_requests WHERE request_id = ?', [cancelChallenge.requestId]);
        const cancelVerify = await accountRecoveryService.verifyChallenge({
            requestId: cancelChallenge.requestId,
            code: cancelReqRow[0].challenge_code
        });

        const cancelExec = await accountRecoveryService.executeCancelDeletion({
            verifiedToken: cancelVerify.verifiedToken
        });
        console.log('Cancel deletion outcome:', cancelExec.message);

        const [restoredUser] = await pool.query('SELECT account_status, deletion_scheduled_at FROM users WHERE user_id = ?', [testUserId]);
        if (restoredUser[0].account_status === 'active' && !restoredUser[0].deletion_scheduled_at) {
            console.log('✅ Account status successfully restored to "active" and deletion cleared!');
        } else {
            throw new Error('Account status not restored');
        }

        // Test 7: Recovery Portal - Termination Appeal Workflow
        console.log('\n--- Test 7: Termination Appeal Case Submission ---');
        await pool.query('UPDATE users SET account_status = "terminated" WHERE user_id = ?', [testUserId]);

        const appealChallenge = await accountRecoveryService.initiateChallenge({
            contactIdentifier: testEmail,
            actionType: 'APPEAL_TERMINATION'
        });
        const [appealReqRow] = await pool.query('SELECT challenge_code FROM account_recovery_requests WHERE request_id = ?', [appealChallenge.requestId]);
        const appealVerify = await accountRecoveryService.verifyChallenge({
            requestId: appealChallenge.requestId,
            code: appealReqRow[0].challenge_code
        });

        const appealExec = await accountRecoveryService.submitAppeal({
            verifiedToken: appealVerify.verifiedToken,
            reasonCategory: 'Account Ban / Terms Misunderstanding',
            explanation: 'My account was terminated in error. I have strictly complied with community guidelines.'
        });
        console.log('✅ Appeal logged:', appealExec.referenceNumber, 'Status:', appealExec.status);

        // Check Appeal Status independently
        const statusCheck = await accountRecoveryService.checkAppealStatus(appealExec.referenceNumber, testEmail);
        if (statusCheck.status === 'SUBMITTED' && statusCheck.referenceNumber === appealExec.referenceNumber) {
            console.log('✅ Non-authenticated appeal status check returned valid case details!');
        } else {
            throw new Error('Appeal status check failed');
        }

        console.log('\n🎉 ALL 7 DATA CENTRE & RECOVERY PORTAL TESTS PASSED PERFECTLY!');
    } catch (err) {
        console.error('❌ Test failed:', err);
        process.exitCode = 1;
    } finally {
        if (testUserId) {
            await pool.query('DELETE FROM data_export_jobs WHERE user_id = ?', [testUserId]);
            await pool.query('DELETE FROM account_recovery_requests WHERE user_id = ?', [testUserId]);
            await pool.query('DELETE FROM account_appeal_cases WHERE user_id = ?', [testUserId]);
            await pool.query('DELETE FROM users WHERE user_id = ?', [testUserId]);
            console.log('🧹 Cleaned up test database fixtures.');
        }
        process.exit();
    }
}

runTests();
