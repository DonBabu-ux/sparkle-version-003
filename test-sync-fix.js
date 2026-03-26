require('dotenv').config();
const { query } = require('./utils/database/query');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('./config/constants');

async function testSyncFix() {
    const testId = Date.now();
    const mockReqBody = {
        type: 'email',
        value: `test_${testId}@example.com`,
        metadata: {
            name: 'Fix Test User',
            username: `fixtest_${testId}`,
            password: 'CorrectPassword123!',
            campus: 'Test University',
            major: 'Computer Science',
            year: 'Senior'
        }
    };

    console.log('--- Testing OTP Sync Fix ---');
    
    // Simulate syncVerifiedOTP logic
    try {
        const { type, value, metadata } = mockReqBody;
        const userId = crypto.randomUUID();
        const username = metadata.username;
        const passwordToHash = metadata.password;
        const hashedPassword = await bcrypt.hash(passwordToHash, 12);

        const columns = ['user_id', 'username', 'password_hash', 'email', 'email_verified', 'name', 'campus', 'major', 'year_of_study'];
        const params = [userId, username, hashedPassword, value, 1, metadata.name, metadata.campus, metadata.major, metadata.year];

        const sql = `INSERT INTO users (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
        await query(sql, params);
        
        console.log('✅ Mock Sync Insert Succeeded');

        // Verify data in DB
        const [users] = await query('SELECT * FROM users WHERE user_id = ?', [userId]);
        const user = users[0];
        
        if (!user) {
            console.error('❌ User not found after insert');
            return;
        }

        console.log('--- Verification Results ---');
        console.log('Name:', user.name === metadata.name ? '✅' : '❌');
        console.log('Username:', user.username === metadata.username ? '✅' : '❌');
        console.log('Campus:', user.campus === metadata.campus ? '✅' : '❌');
        console.log('Major:', user.major === metadata.major ? '✅' : '❌');
        console.log('Year:', user.year_of_study === metadata.year ? '✅' : '❌');
        
        const passMatch = await bcrypt.compare(metadata.password, user.password_hash);
        console.log('Password Match:', passMatch ? '✅' : '❌');

        // Cleanup
        await query('DELETE FROM users WHERE user_id = ?', [userId]);
        console.log('✅ Cleanup successful');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        process.exit(0);
    }
}

testSyncFix();
