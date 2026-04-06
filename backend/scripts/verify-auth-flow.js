require('dotenv').config();
const { query } = require('../utils/database/query');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('../utils/logger');

async function verifyAuthFlow() {
    const testUsername = `testuser_${Date.now()}`;
    const testEmail = `test_${Date.now()}@example.com`;
    const testPassword = 'Password123!';
    const newPassword = 'NewPassword456!';

    logger.info('--- Starting Auth Flow Verification ---');

    try {
        // 1. Simulate Signup (Manual insertion to avoid hitting live local server if not running)
        logger.info(`1. Simulating Signup for ${testEmail}...`);
        const userId = crypto.randomUUID();
        const hashedPassword = await bcrypt.hash(testPassword, 12);
        await query(
            'INSERT INTO users (user_id, name, username, email, password_hash, campus) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, 'Test User', testUsername, testEmail, hashedPassword, 'Test Campus']
        );

        // 2. Generate Verification Code
        logger.info('2. Generating Verification Code...');
        const code = '123456';
        const expiresAt = new Date(Date.now() + 3600000);
        await query(
            'INSERT INTO email_verifications (verification_id, user_id, email, code, expires_at) VALUES (?, ?, ?, ?, ?)',
            [crypto.randomUUID(), userId, testEmail, code, expiresAt]
        );

        // 3. Verify Email
        logger.info('3. Verifying Email...');
        const [verifications] = await query(
            'SELECT * FROM email_verifications WHERE email = ? AND code = ? AND expires_at > NOW()',
            [testEmail, code]
        );
        if (verifications.length === 0) throw new Error('Verification code not found in DB');

        await query('UPDATE users SET email_verified = 1 WHERE user_id = ?', [userId]);
        const [updatedUser] = await query('SELECT email_verified FROM users WHERE user_id = ?', [userId]);
        if (updatedUser[0].email_verified !== 1) throw new Error('Email verification state not updated');
        logger.info('✅ Email verified successfully.');

        // 4. Forgot Password Flow
        logger.info('4. Simulating Forgot Password...');
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 3600000);
        await query(
            'INSERT INTO password_resets (reset_id, user_id, email, token, expires_at) VALUES (?, ?, ?, ?, ?)',
            [crypto.randomUUID(), userId, testEmail, resetToken, resetExpires]
        );

        // 5. Reset Password
        logger.info('5. Resetting Password...');
        const [resets] = await query(
            'SELECT * FROM password_resets WHERE token = ? AND expires_at > NOW() AND used_at IS NULL',
            [resetToken]
        );
        if (resets.length === 0) throw new Error('Reset token not found in DB');

        const newHashedPassword = await bcrypt.hash(newPassword, 12);
        await query('UPDATE users SET password_hash = ? WHERE user_id = ?', [newHashedPassword, userId]);
        await query('UPDATE password_resets SET used_at = NOW() WHERE token = ?', [resetToken]);

        // 6. Verify New Password
        const [userAfterReset] = await query('SELECT password_hash FROM users WHERE user_id = ?', [userId]);
        const match = await bcrypt.compare(newPassword, userAfterReset[0].password_hash);
        if (!match) throw new Error('New password does not match hash');
        logger.info('✅ Password reset verified.');

        logger.info('--- ✅ ALL TESTS PASSED ---');

        // Cleanup
        await query('DELETE FROM users WHERE user_id = ?', [userId]);
        logger.info('Cleanup: Test user deleted.');

    } catch (error) {
        logger.error('❌ Verification failed:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

verifyAuthFlow();
