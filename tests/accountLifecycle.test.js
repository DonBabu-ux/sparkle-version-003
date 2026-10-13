// tests/accountLifecycle.test.js
// Comprehensive Integration Tests for Sparkle Account Lifecycle System:
// Suspend, Terminate, Delete, Authentication Enforcement, and Email Reuse
'use strict';

require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../backend/config/database');
const accountLifecycleService = require('../backend/services/accountLifecycle.service');
const accountLifecycleWorker = require('../backend/workers/accountLifecycleWorker');
const authService = require('../backend/services/auth.service');
const { JWT_SECRET } = require('../backend/config/constants');
const { authMiddleware } = require('../backend/middleware/auth.middleware');

async function runAccountLifecycleTests() {
    console.log('🧪 Starting Sparkle Account Lifecycle Master Test Suite...\n');
    let passed = 0;
    let failed = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`  ✅ PASS: ${message}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${message}`);
            failed++;
        }
    }

    // Mock Express req/res/next for testing authMiddleware
    function mockAuthRequest(token) {
        const req = {
            headers: { authorization: `Bearer ${token}` },
            cookies: {},
            user: null
        };
        let statusCode = 200;
        let responseBody = null;
        let nextCalled = false;

        const res = {
            status: (code) => {
                statusCode = code;
                return res;
            },
            json: (body) => {
                responseBody = body;
                return res;
            },
            setHeader: () => {},
            cookie: () => {}
        };
        const next = () => { nextCalled = true; };

        return {
            req,
            res,
            next,
            getResult: () => ({ statusCode, responseBody, nextCalled, user: req.user })
        };
    }

    const testPassword = 'Password123!';
    const passwordHash = await bcrypt.hash(testPassword, 10);

    // Test IDs and emails
    const timestamp = Date.now();
    const suspendUserId = crypto.randomUUID();
    const suspendEmail = `suspend_user_${timestamp}@test.sparkle`;
    const terminateUserId = crypto.randomUUID();
    const terminateEmail = `terminate_user_${timestamp}@test.sparkle`;
    const deleteUserId = crypto.randomUUID();
    const deleteEmail = `delete_user_${timestamp}@test.sparkle`;
    const adminSuspendUserId = crypto.randomUUID();
    const adminSuspendEmail = `admin_suspend_${timestamp}@test.sparkle`;

    try {
        console.log('--- 0. TEST SETUP ---');
        // Clean up any stale records
        await pool.query('DELETE FROM users WHERE email LIKE ?', ['%@test.sparkle']);

        // Insert test user 1 (for Suspend flow)
        await pool.query(`
            INSERT INTO users (user_id, name, username, username_normalized, email, password_hash, user_type, account_status, token_version)
            VALUES (?, 'Suspend Tester', 'user_suspend', 'user_suspend', ?, ?, 'student', 'active', 1)
        `, [suspendUserId, suspendEmail, passwordHash]);

        // Insert test user 2 (for Terminate flow)
        await pool.query(`
            INSERT INTO users (user_id, name, username, username_normalized, email, password_hash, user_type, account_status, token_version)
            VALUES (?, 'Terminate Tester', 'user_terminate', 'user_terminate', ?, ?, 'student', 'active', 1)
        `, [terminateUserId, terminateEmail, passwordHash]);

        // Insert test user 3 (for Delete flow)
        await pool.query(`
            INSERT INTO users (user_id, name, username, username_normalized, email, password_hash, user_type, account_status, token_version)
            VALUES (?, 'Delete Tester', 'user_delete', 'user_delete', ?, ?, 'student', 'active', 1)
        `, [deleteUserId, deleteEmail, passwordHash]);

        // Insert test user 4 (for Admin Suspend flow)
        await pool.query(`
            INSERT INTO users (user_id, name, username, username_normalized, email, password_hash, user_type, account_status, token_version)
            VALUES (?, 'Admin Suspend Tester', 'user_admin_suspend', 'user_admin_suspend', ?, ?, 'student', 'active', 1)
        `, [adminSuspendUserId, adminSuspendEmail, passwordHash]);

        assert(true, 'Test users seeded in database successfully');

        // ==========================================
        // SECTION 1: SUSPENSION WORKFLOW
        // ==========================================
        console.log('\n--- 1. SUSPEND ACCOUNT WORKFLOW ---');

        // Seed a session and refresh token for suspend user
        await pool.query('INSERT INTO user_sessions (session_id, user_id, device_name) VALUES (?, ?, ?)', [crypto.randomUUID(), suspendUserId, 'Mobile Chrome']);
        await pool.query('INSERT INTO refresh_tokens (token_id, user_id, token, device_id, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))', [crypto.randomUUID(), suspendUserId, 'test_refresh_token_1', 'mobile', ]);

        const activeToken = jwt.sign({ userId: suspendUserId, email: suspendEmail, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '15m' });

        // Verify active token works before suspension
        const preAuth = mockAuthRequest(activeToken);
        await authMiddleware(preAuth.req, preAuth.res, preAuth.next);
        assert(preAuth.getResult().nextCalled === true, 'Active user token passes authMiddleware');

        // Execute suspension
        const suspendResult = await accountLifecycleService.suspendAccount({
            userId: suspendUserId,
            reason: 'Studying for university exams',
            actorId: 'self',
            actorRole: 'user'
        });
        assert(suspendResult.success === true, 'suspendAccount returned success');
        assert(suspendResult.status === 'suspended', 'suspendAccount status is suspended');

        // Verify database state
        const [suspendDb] = await pool.query('SELECT account_status, suspended_at, suspension_reason, suspended_by, token_version FROM users WHERE user_id = ?', [suspendUserId]);
        assert(suspendDb[0].account_status === 'suspended', 'DB account_status is updated to suspended');
        assert(suspendDb[0].suspended_at !== null, 'suspended_at timestamp is populated');
        assert(suspendDb[0].suspension_reason === 'Studying for university exams', 'suspension_reason is persisted');
        assert(suspendDb[0].token_version === 2, 'token_version was incremented (sessions revoked)');

        // Verify sessions and refresh tokens deleted
        const [remainingSessions] = await pool.query('SELECT * FROM user_sessions WHERE user_id = ?', [suspendUserId]);
        const [remainingRefresh] = await pool.query('SELECT * FROM refresh_tokens WHERE user_id = ?', [suspendUserId]);
        assert(remainingSessions.length === 0, 'Active user_sessions were deleted on suspension');
        assert(remainingRefresh.length === 0, 'Refresh tokens were revoked on suspension');

        // Verify authMiddleware rejects suspended user
        const postAuth = mockAuthRequest(activeToken);
        await authMiddleware(postAuth.req, postAuth.res, postAuth.next);
        const postAuthResult = postAuth.getResult();
        assert(postAuthResult.statusCode === 403, 'authMiddleware returns 403 for suspended account');
        assert(postAuthResult.responseBody?.code === 'ACCOUNT_SUSPENDED', 'authMiddleware returns ACCOUNT_SUSPENDED code');

        // Verify Audit Log
        const [suspendAudit] = await pool.query('SELECT * FROM account_lifecycle_audit WHERE user_id = ? AND action = ?', [suspendUserId, 'SUSPEND']);
        assert(suspendAudit.length > 0, 'account_lifecycle_audit record created for SUSPEND');
        assert(suspendAudit[0].new_status === 'suspended', 'Audit log new_status is suspended');

        // Reactivate suspended account
        const reactivateResult = await accountLifecycleService.reactivateAccount({
            userId: suspendUserId,
            actorId: 'self',
            actorRole: 'user'
        });
        assert(reactivateResult.success === true, 'reactivateAccount returned success');
        assert(reactivateResult.status === 'active', 'reactivateAccount status restored to active');

        const [reactivateDb] = await pool.query('SELECT account_status, suspended_at FROM users WHERE user_id = ?', [suspendUserId]);
        assert(reactivateDb[0].account_status === 'active', 'DB status restored to active after reactivation');
        assert(reactivateDb[0].suspended_at === null, 'suspended_at reset to NULL');

        // Admin suspension check: Ordinary user cannot lift administrative suspension
        await accountLifecycleService.suspendAccount({
            userId: adminSuspendUserId,
            reason: 'Terms violation (Spamming)',
            actorId: 'admin_officer_42',
            actorRole: 'admin'
        });
        let adminLiftBlocked = false;
        try {
            await accountLifecycleService.reactivateAccount({
                userId: adminSuspendUserId,
                actorId: adminSuspendUserId,
                actorRole: 'user' // Ordinary user attempting to lift admin suspension
            });
        } catch (err) {
            adminLiftBlocked = true;
        }
        assert(adminLiftBlocked === true, 'Ordinary user cannot lift administrator-enforced suspension');

        // ==========================================
        // SECTION 2: TERMINATION WORKFLOW
        // ==========================================
        console.log('\n--- 2. TERMINATE ACCOUNT WORKFLOW ---');

        await pool.query('INSERT INTO user_sessions (session_id, user_id, device_name) VALUES (?, ?, ?)', [crypto.randomUUID(), terminateUserId, 'MacBook Pro']);
        const termToken = jwt.sign({ userId: terminateUserId, email: terminateEmail, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '15m' });

        const termResult = await accountLifecycleService.terminateAccount({
            userId: terminateUserId,
            reason: 'User decided to leave the platform permanently',
            actorId: 'self',
            actorRole: 'user'
        });
        assert(termResult.success === true, 'terminateAccount returned success');
        assert(termResult.status === 'terminated', 'terminateAccount status is terminated');

        const [termDb] = await pool.query('SELECT account_status, terminated_at, termination_reason, token_version FROM users WHERE user_id = ?', [terminateUserId]);
        assert(termDb[0].account_status === 'terminated', 'DB account_status is updated to terminated');
        assert(termDb[0].terminated_at !== null, 'terminated_at timestamp is populated');
        assert(termDb[0].token_version === 2, 'token_version was incremented on termination');

        // Auth middleware rejects terminated account
        const termAuth = mockAuthRequest(termToken);
        await authMiddleware(termAuth.req, termAuth.res, termAuth.next);
        const termAuthResult = termAuth.getResult();
        assert(termAuthResult.statusCode === 403, 'authMiddleware returns 403 for terminated account');
        assert(termAuthResult.responseBody?.code === 'ACCOUNT_TERMINATED', 'authMiddleware returns ACCOUNT_TERMINATED code');

        // Verify data is preserved (posts/profile not destroyed on termination)
        const [termUserRecord] = await pool.query('SELECT user_id, email, username FROM users WHERE user_id = ?', [terminateUserId]);
        assert(termUserRecord.length === 1, 'User record is retained for audit & lifecycle policy, not destroyed');

        // Repeated termination is idempotent
        const termRepeat = await accountLifecycleService.terminateAccount({
            userId: terminateUserId,
            reason: 'Duplicate call'
        });
        assert(termRepeat.success === true && termRepeat.alreadyTerminated === true, 'Repeated termination is safe and idempotent');

        // Ordinary reactivation is blocked on terminated account
        let termReactivateBlocked = false;
        try {
            await accountLifecycleService.reactivateAccount({ userId: terminateUserId });
        } catch (err) {
            termReactivateBlocked = true;
        }
        assert(termReactivateBlocked === true, 'Ordinary reactivation is strictly denied for terminated account');

        // ==========================================
        // SECTION 3: DELETION & 30-DAY GRACE PERIOD
        // ==========================================
        console.log('\n--- 3. DELETION & 30-DAY GRACE PERIOD WORKFLOW ---');

        const delToken = jwt.sign({ userId: deleteUserId, email: deleteEmail, tokenVersion: 1 }, JWT_SECRET, { expiresIn: '15m' });

        // Step 3.1: Request deletion
        const deleteReqResult = await accountLifecycleService.requestDeletion({
            userId: deleteUserId,
            reason: 'Privacy request',
            actorId: 'self',
            actorRole: 'user'
        });
        assert(deleteReqResult.success === true, 'requestDeletion returned success');
        assert(deleteReqResult.status === 'pending_deletion', 'Account status transitioned to pending_deletion');

        const [delDb] = await pool.query('SELECT account_status, deletion_requested_at, deletion_scheduled_at FROM users WHERE user_id = ?', [deleteUserId]);
        assert(delDb[0].account_status === 'pending_deletion', 'DB account_status is pending_deletion');
        assert(delDb[0].deletion_scheduled_at !== null, 'deletion_scheduled_at set 30 days in future');

        // Auth middleware rejects pending_deletion
        const delAuth = mockAuthRequest(delToken);
        await authMiddleware(delAuth.req, delAuth.res, delAuth.next);
        const delAuthResult = delAuth.getResult();
        assert(delAuthResult.statusCode === 403, 'authMiddleware returns 403 for pending_deletion account');
        assert(delAuthResult.responseBody?.code === 'ACCOUNT_PENDING_DELETION', 'authMiddleware returns ACCOUNT_PENDING_DELETION code');

        // Step 3.2: Cancel deletion during grace period
        const cancelResult = await accountLifecycleService.cancelDeletion({
            userId: deleteUserId,
            actorId: 'self'
        });
        assert(cancelResult.success === true, 'cancelDeletion returned success');
        assert(cancelResult.status === 'active', 'cancelDeletion restored status to active');

        const [delCancelDb] = await pool.query('SELECT account_status, deletion_scheduled_at FROM users WHERE user_id = ?', [deleteUserId]);
        assert(delCancelDb[0].account_status === 'active', 'DB status is active after cancellation');
        assert(delCancelDb[0].deletion_scheduled_at === null, 'deletion_scheduled_at reset to NULL');

        // Step 3.3: Re-request deletion and test Hard Deletion (Grace period expired)
        await accountLifecycleService.requestDeletion({
            userId: deleteUserId,
            reason: 'Permanent delete confirmed'
        });

        // Execute hard delete
        const hardDeleteResult = await accountLifecycleService.processHardDelete(deleteUserId);
        assert(hardDeleteResult.success === true, 'processHardDelete executed successfully');

        const [hardDelDb] = await pool.query('SELECT account_status, email, username, deletion_completed_at FROM users WHERE user_id = ?', [deleteUserId]);
        assert(hardDelDb[0].account_status === 'deleted', 'DB account_status transitioned to deleted');
        assert(hardDelDb[0].deletion_completed_at !== null, 'deletion_completed_at is populated');
        assert(hardDelDb[0].email.includes('@deleted.sparkle.local'), `Email was anonymized: ${hardDelDb[0].email}`);
        assert(hardDelDb[0].username.startsWith('deleted_user_'), `Username was anonymized: ${hardDelDb[0].username}`);

        // ==========================================
        // SECTION 4: EMAIL ADDRESS REUSE POLICY
        // ==========================================
        console.log('\n--- 4. EMAIL ADDRESS REUSE POLICY ---');

        // 4.1 Check email of Active account (cannot reuse)
        let activeSignupErrors = [];
        try {
            await authService.signup({
                name: 'Alice Duplicate',
                username: `dup_alice_${timestamp}`,
                email: suspendEmail, // Currently active again
                password: 'Password123!',
                user_type: 'student'
            });
        } catch (e) {
            activeSignupErrors = e.validationErrors || [];
        }
        assert(activeSignupErrors.some(e => e.code === 'EMAIL_TAKEN'), 'Email reuse blocked for ACTIVE account');

        // 4.2 Check email of Terminated account (cannot reuse)
        let termSignupErrors = [];
        try {
            await authService.signup({
                name: 'Term Duplicate',
                username: `dup_term_${timestamp}`,
                email: terminateEmail, // Terminated account
                password: 'Password123!',
                user_type: 'student'
            });
        } catch (e) {
            termSignupErrors = e.validationErrors || [];
        }
        assert(termSignupErrors.some(e => e.code === 'EMAIL_TAKEN'), 'Email reuse blocked for TERMINATED account');

        // 4.3 Check email of Deleted account (after hard delete, original email CAN be reused)
        const [existingOriginal] = await pool.query('SELECT user_id FROM users WHERE email = ?', [deleteEmail]);
        assert(existingOriginal.length === 0, 'Original email was freed and is no longer tied to the user row');

        const newRegistrationResult = await authService.signup({
            name: 'New Registered User',
            username: `new_user_${timestamp}`,
            email: deleteEmail, // Freed email!
            password: 'Password123!',
            user_type: 'student'
        });
        assert(newRegistrationResult.success === true || newRegistrationResult.token !== undefined, 'Email reuse permitted after DELETED lifecycle completion');

        // Clean up new user
        if (newRegistrationResult.user?.user_id) {
            await pool.query('DELETE FROM users WHERE user_id = ?', [newRegistrationResult.user.user_id]);
        }

        // ==========================================
        // SECTION 5: LIFECYCLE WORKER INTEGRATION
        // ==========================================
        console.log('\n--- 5. BACKGROUND LIFECYCLE WORKER ---');

        // Verify that expired suspensions job does not touch terminated accounts
        const [workerTestTerm] = await pool.query('SELECT account_status FROM users WHERE user_id = ?', [terminateUserId]);
        assert(workerTestTerm[0].account_status === 'terminated', 'Terminated user has account_status=terminated before worker run');

        await accountLifecycleWorker.processExpiredSuspensions();

        const [workerTestTermAfter] = await pool.query('SELECT account_status FROM users WHERE user_id = ?', [terminateUserId]);
        assert(workerTestTermAfter[0].account_status === 'terminated', 'Suspension expiry worker NEVER restores a terminated account');

        // Cleanup test users
        await pool.query('DELETE FROM users WHERE user_id IN (?, ?, ?, ?)', [
            suspendUserId, terminateUserId, deleteUserId, adminSuspendUserId
        ]);
        await pool.query('DELETE FROM account_lifecycle_audit WHERE user_id IN (?, ?, ?, ?)', [
            suspendUserId, terminateUserId, deleteUserId, adminSuspendUserId
        ]);

        console.log(`\n========================================`);
        console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
        console.log(`========================================\n`);

        if (failed > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    } catch (err) {
        console.error('💥 Test suite crashed with error:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    runAccountLifecycleTests();
}

module.exports = runAccountLifecycleTests;
